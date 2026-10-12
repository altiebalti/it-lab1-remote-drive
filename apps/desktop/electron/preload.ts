import { contextBridge, ipcRenderer, webUtils } from 'electron';

export interface LocalFileState {
  path: string;
  contentHash: string;
  size: number;
  mtimeMs: number;
}

export interface SyncIndexEntry {
  path: string;
  contentHash: string;
  remoteId: string;
}

export interface WatchEvent {
  kind: 'add' | 'change' | 'unlink';
  path: string;
}

const desktopApi = {

  getToken: (): Promise<string | null> => ipcRenderer.invoke('token:get'),
  setToken: (token: string | null): Promise<void> =>
    ipcRenderer.invoke('token:set', token),

  chooseFolder: (): Promise<string | null> => ipcRenderer.invoke('folder:choose'),
  scanFolder: (root: string): Promise<LocalFileState[]> =>
    ipcRenderer.invoke('folder:scan', root),

  readFile: (root: string, path: string): Promise<Uint8Array> =>
    ipcRenderer.invoke('file:read', root, path),
  writeFile: (root: string, path: string, bytes: Uint8Array): Promise<void> =>
    ipcRenderer.invoke('file:write', root, path, bytes),
  deleteFile: (root: string, path: string): Promise<void> =>
    ipcRenderer.invoke('file:delete', root, path),

  pickFiles: (): Promise<string[]> => ipcRenderer.invoke('file:pick'),
  readAbsolute: (
    absolutePath: string,
  ): Promise<{ name: string; bytes: Uint8Array }> =>
    ipcRenderer.invoke('file:readAbsolute', absolutePath),
  saveAs: (suggestedName: string, bytes: Uint8Array): Promise<string | null> =>
    ipcRenderer.invoke('file:saveAs', suggestedName, bytes),
  revealInFolder: (absolutePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:reveal', absolutePath),

  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  loadIndex: (root: string): Promise<SyncIndexEntry[]> =>
    ipcRenderer.invoke('index:load', root),
  saveIndex: (root: string, entries: SyncIndexEntry[]): Promise<void> =>
    ipcRenderer.invoke('index:save', root, entries),

  startWatching: (root: string): Promise<void> =>
    ipcRenderer.invoke('watch:start', root),
  stopWatching: (): Promise<void> => ipcRenderer.invoke('watch:stop'),
  onWatchEvent: (handler: (event: WatchEvent) => void): (() => void) => {
    const listener = (_e: unknown, payload: WatchEvent) => handler(payload);
    ipcRenderer.on('watch:event', listener);

    return () => ipcRenderer.off('watch:event', listener);
  },
};

contextBridge.exposeInMainWorld('desktop', desktopApi);

export type DesktopApi = typeof desktopApi;
