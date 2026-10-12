import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  safeStorage,
  shell,
} from 'electron';
import { pathToFileURL } from 'node:url';
import { watch, type FSWatcher } from 'chokidar';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { scanFolder } from './sync/scanner';
import { SyncIndexStore } from './sync/index-store';

const isDev = process.env.DRIVE_DEV === '1';
const DEV_URL = 'http://localhost:5273';

const APP_SCHEME = 'app';
const APP_ORIGIN = `${APP_SCHEME}://local`;
const RENDERER_DIR = join(__dirname, '../dist');

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

function registerAppProtocol(): void {
  protocol.handle(APP_SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const relativePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = resolve(RENDERER_DIR, `.${relativePath}`);

    if (!filePath.startsWith(RENDERER_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

let mainWindow: BrowserWindow | null = null;
let watcher: FSWatcher | null = null;
let indexStore!: SyncIndexStore;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 560,
    title: 'Віддалений диск',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    void mainWindow.loadURL(DEV_URL);
  } else {
    void mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function resolveInside(root: string, relativePath: string): string {
  const absolute = resolve(root, normalize(relativePath));
  const rel = relative(root, absolute);

  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Шлях виходить за межі папки: ${relativePath}`);
  }
  return absolute;
}

app.whenReady().then(() => {
  registerAppProtocol();
  indexStore = new SyncIndexStore(app.getPath('userData'));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  void watcher?.close();
  if (process.platform !== 'darwin') app.quit();
});

const tokenFile = () => join(app.getPath('userData'), 'session.bin');

ipcMain.handle('token:get', async (): Promise<string | null> => {
  try {
    const raw = await readFile(tokenFile());
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(raw);
    }
    return raw.toString('utf8');
  } catch {
    return null;
  }
});

ipcMain.handle('token:set', async (_event, token: string | null): Promise<void> => {
  if (!token) {
    await rm(tokenFile(), { force: true });
    return;
  }
  const payload = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(token)
    : Buffer.from(token, 'utf8');
  await writeFile(tokenFile(), payload);
});

ipcMain.handle('folder:choose', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    title: 'Виберіть папку для синхронізації',
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle('folder:scan', async (_event, root: string) => scanFolder(root));

ipcMain.handle('file:read', async (_event, root: string, path: string) => {
  const content = await readFile(resolveInside(root, path));

  return new Uint8Array(content);
});

ipcMain.handle(
  'file:write',
  async (_event, root: string, path: string, bytes: Uint8Array) => {
    const absolute = resolveInside(root, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, Buffer.from(bytes));
  },
);

ipcMain.handle('file:delete', async (_event, root: string, path: string) => {
  await rm(resolveInside(root, path), { force: true });
});

ipcMain.handle('file:readAbsolute', async (_event, absolutePath: string) => {
  const content = await readFile(absolutePath);
  return {
    name: absolutePath.split(sep).pop() ?? 'file',
    bytes: new Uint8Array(content),
  };
});

ipcMain.handle('file:pick', async (): Promise<string[]> => {
  const result = await dialog.showOpenDialog({
    title: 'Виберіть файли для завантаження',
    properties: ['openFile', 'multiSelections'],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle(
  'file:saveAs',
  async (_event, suggestedName: string, bytes: Uint8Array): Promise<string | null> => {
    const result = await dialog.showSaveDialog({
      title: 'Зберегти файл',
      defaultPath: suggestedName,
    });
    if (result.canceled || !result.filePath) return null;

    await writeFile(result.filePath, Buffer.from(bytes));
    return result.filePath;
  },
);

ipcMain.handle('index:load', async (_event, root: string) => indexStore.load(root));

ipcMain.handle('index:save', async (_event, root: string, entries) =>
  indexStore.save(root, entries),
);

ipcMain.handle('watch:start', async (_event, root: string): Promise<void> => {
  await watcher?.close();

  watcher = watch(root, {
    ignoreInitial: true,

    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
    ignored: (path) => /(^|[/\\])(\.DS_Store|\.git|node_modules)([/\\]|$)/.test(path),
  });

  const notify = (kind: string) => (path: string) => {
    mainWindow?.webContents.send('watch:event', {
      kind,
      path: relative(root, path).split(sep).join('/'),
    });
  };

  watcher
    .on('add', notify('add'))
    .on('change', notify('change'))
    .on('unlink', notify('unlink'));
});

ipcMain.handle('watch:stop', async (): Promise<void> => {
  await watcher?.close();
  watcher = null;
});

ipcMain.handle('shell:reveal', async (_event, absolutePath: string): Promise<void> => {
  shell.showItemInFolder(absolutePath);
});
