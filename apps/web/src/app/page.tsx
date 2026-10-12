'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileFilter, FileRecord, SortOrder } from '@drive/core';
import {
  ColumnToggle,
  FilePreview,
  FileTable,
  LoginForm,
  Toolbar,
  countUk,
  defaultVisibility,
  type ColumnKey,
  type ColumnVisibility,
  type PreviewData,
} from '@drive/ui';
import {
  BASE_URL,
  client,
  persistToken,
  restoreSession,
  setUnauthorizedHandler,
} from '@/lib/api';
import {
  applyAction,
  isSupported,
  loadIndex,
  saveIndex,
  scanDirectory,
  type LocalEntry,
} from '@/lib/webSync';
import { WebDropzone, type DroppedFile } from '@/components/WebDropzone';
import { WebSyncPanel, type WebSyncState } from '@/components/WebSyncPanel';

interface Session {
  displayName: string;
  email: string;
}

const API_SORT_FIELDS = ['name', 'createdAt', 'updatedAt'] as const;
type ApiSortField = (typeof API_SORT_FIELDS)[number];

function toApiSortField(key: ColumnKey): ApiSortField {
  return (API_SORT_FIELDS as readonly string[]).includes(key)
    ? (key as ApiSortField)
    : 'name';
}

export default function DrivePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  const [files, setFiles] = useState<FileRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [uploading, setUploading] = useState<{ name: string; percent: number | null } | null>(null);

  const [sortKey, setSortKey] = useState<ColumnKey>('createdAt');
  const [order, setOrder] = useState<SortOrder>('desc');
  const [filter, setFilter] = useState<FileFilter>('all');

  const [visibility, setVisibility] = useState<ColumnVisibility>(defaultVisibility);

  const [selected, setSelected] = useState<FileRecord | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);

  const folderHandle = useRef<FileSystemDirectoryHandle | null>(null);
  const [sync, setSync] = useState<WebSyncState>({
    supported: false,
    folderName: null,
    plan: null,
    running: false,
    status: '',
    error: null,
  });

  const show = useCallback((text: string, error = false) => {
    setNotice({ text, error });
    setTimeout(() => setNotice(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [visible, all] = await Promise.all([
        client.listFiles({ sort: toApiSortField(sortKey), order, filter }),
        client.listFiles({ filter: 'all' }),
      ]);
      setFiles(visible);
      setTotal(all.length);
    } catch (cause) {
      show(cause instanceof Error ? cause.message : 'Не вдалося отримати список', true);
    } finally {
      setLoading(false);
    }
  }, [sortKey, order, filter, show]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession(null);
      setFiles([]);
    });
    setSync((s) => ({ ...s, supported: isSupported() }));

    void (async () => {
      if (await restoreSession()) {
        const me = await client.me();
        setSession({ displayName: me.displayName, email: me.email });
      }
      setBooting(false);
    })();
  }, []);

  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);

  const handleLogin = async (email: string, password: string) => {
    const result = await client.login({ email, password });
    persistToken(result.accessToken);
    setSession({ displayName: result.user.displayName, email: result.user.email });
  };

  const handleRegister = async (email: string, password: string, displayName: string) => {
    const result = await client.register({ email, password, displayName });
    persistToken(result.accessToken);
    setSession({ displayName: result.user.displayName, email: result.user.email });
  };

  const handleLogout = () => {
    client.logout();
    persistToken(null);
    folderHandle.current = null;
    setSession(null);
    setFiles([]);
    setSelected(null);
    setSync((s) => ({ ...s, folderName: null, plan: null, status: '' }));
  };

  const handleSelect = useCallback(async (file: FileRecord) => {
    setSelected(file);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      setPreview((await client.preview(file.id)) as PreviewData);
    } catch (cause) {
      setPreviewError(cause instanceof Error ? cause.message : 'Не вдалося показати вміст');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const uploadAll = useCallback(
    async (items: Array<{ name: string; bytes: Uint8Array }>) => {
      let ok = 0;
      for (const item of items) {
        try {
          setUploading({ name: item.name, percent: 0 });
          await client.upload({ path: item.name, content: item.bytes }, (p) =>
            setUploading({ name: item.name, percent: p.percent }),
          );
          ok += 1;
        } catch (cause) {
          show(`${item.name}: ${cause instanceof Error ? cause.message : 'помилка'}`, true);
        }
      }
      setUploading(null);
      if (ok > 0) {
        show(`Завантажено ${countUk(ok, 'файл', 'файли', 'файлів')}`);
        await refresh();
      }
    },
    [refresh, show],
  );

  const handlePick = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);

    event.target.value = '';
    if (picked.length === 0) return;

    const items = await Promise.all(
      picked.map(async (f) => ({
        name: f.name,
        bytes: new Uint8Array(await f.arrayBuffer()),
      })),
    );
    await uploadAll(items);
  }, [uploadAll]);

  const handleDrop = useCallback((dropped: DroppedFile[]) => void uploadAll(dropped), [uploadAll]);

  const handleDownload = useCallback(
    async (file: FileRecord) => {
      try {

        const url = await client.downloadUrl(file.id);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (cause) {
        show(cause instanceof Error ? cause.message : 'Не вдалося вивантажити', true);
      }
    },
    [show],
  );

  const handleRename = useCallback(
    async (file: FileRecord) => {
      const next = window.prompt('Новий шлях файлу:', file.path);
      if (!next || next === file.path) return;
      try {
        await client.rename(file.id, next);
        show('Перейменовано');
        if (selected?.id === file.id) setSelected(null);
        await refresh();
      } catch (cause) {
        show(cause instanceof Error ? cause.message : 'Не вдалося перейменувати', true);
      }
    },
    [refresh, selected, show],
  );

  const handleDelete = useCallback(
    async (file: FileRecord) => {
      if (!window.confirm(`Видалити «${file.path}»? Дію не можна скасувати.`)) return;
      try {
        await client.remove(file.id);
        show('Видалено');
        if (selected?.id === file.id) setSelected(null);
        await refresh();
      } catch (cause) {
        show(cause instanceof Error ? cause.message : 'Не вдалося видалити', true);
      }
    },
    [refresh, selected, show],
  );

  const handleSort = useCallback(
    (key: ColumnKey) => {
      if (key === sortKey) setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      else {
        setSortKey(key);
        setOrder('asc');
      }
    },
    [sortKey],
  );

  const chooseFolder = useCallback(async () => {
    try {

      const handle = await (window as unknown as {
        showDirectoryPicker: (o?: unknown) => Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker({ mode: 'readwrite' });

      folderHandle.current = handle;
      setSync((s) => ({ ...s, folderName: handle.name, plan: null, status: '', error: null }));
    } catch {
    }
  }, []);

  const buildPlan = useCallback(async () => {
    const root = folderHandle.current;
    if (!root) return null;

    const local = await scanDirectory(root);
    const plan = await client.syncDiff({
      local: local.map((f) => ({ path: f.path, contentHash: f.contentHash })),
      index: loadIndex(root.name),
    });
    return { plan, local };
  }, []);

  const previewSync = useCallback(async () => {
    setSync((s) => ({ ...s, running: true, error: null, status: 'Порівняння…' }));
    try {
      const result = await buildPlan();
      if (!result) return;
      setSync((s) => ({
        ...s,
        plan: result.plan,
        running: false,
        status: result.plan.changes.length
          ? `${countUk(result.plan.changes.length, 'зміна', 'зміни', 'змін')} до застосування`
          : 'Усе синхронізовано',
      }));
    } catch (cause) {
      setSync((s) => ({
        ...s,
        running: false,
        status: '',
        error: cause instanceof Error ? cause.message : 'Не вдалося порівняти',
      }));
    }
  }, [buildPlan]);

  const runSync = useCallback(async () => {
    const root = folderHandle.current;
    if (!root) return;

    setSync((s) => ({ ...s, running: true, error: null, status: 'Порівняння…' }));
    try {
      const result = await buildPlan();
      if (!result) return;

      const byPath = new Map<string, LocalEntry>(result.local.map((f) => [f.path, f]));
      let done = 0;
      for (const action of result.plan.changes) {
        setSync((s) => ({
          ...s,
          status: `${++done} з ${result.plan.changes.length}: ${action.path}`,
        }));
        await applyAction(root, byPath, action);
      }

      const freshLocal = await scanDirectory(root);
      const freshRemote = await client.manifest();
      const remoteByPath = new Map(freshRemote.map((r) => [r.path, r]));
      saveIndex(
        root.name,
        freshLocal
          .filter((f) => remoteByPath.get(f.path)?.contentHash === f.contentHash)
          .map((f) => ({
            path: f.path,
            contentHash: f.contentHash,
            remoteId: remoteByPath.get(f.path)!.id,
          })),
      );

      setSync((s) => ({
        ...s,
        running: false,
        plan: null,
        status: result.plan.changes.length
          ? `Готово: застосовано ${countUk(result.plan.changes.length, 'зміну', 'зміни', 'змін')}`
          : 'Усе вже синхронізовано',
      }));
      await refresh();
    } catch (cause) {
      setSync((s) => ({
        ...s,
        running: false,
        error: cause instanceof Error ? cause.message : 'Синхронізація не вдалася',
        status: '',
      }));
    }
  }, [buildPlan, refresh]);

  const serverLabel = useMemo(() => BASE_URL.replace(/^https?:\/\//, ''), []);

  if (booting) return <div className="dr-empty">Завантаження…</div>;

  if (!session) {
    return (
      <LoginForm
        onLogin={handleLogin}
        onRegister={handleRegister}
        subtitle={`Вебверсія · ${serverLabel}`}
      />
    );
  }

  return (
    <div className="wb-shell">
      <header className="wb-header">
        <h1 className="wb-header__title">Віддалений диск</h1>
        <span className="wb-header__badge">Веб</span>
        <span className="wb-header__spacer" />
        <span className="wb-header__user">
          {session.displayName} · {serverLabel}
        </span>
        <button type="button" className="dr-button" onClick={handleLogout}>
          Вийти
        </button>
      </header>

      <WebSyncPanel
        state={sync}
        onChooseFolder={chooseFolder}
        onPreview={previewSync}
        onRun={runSync}
      />

      {uploading && (
        <div className="wb-progress">
          <span className="wb-progress__label">
            Завантаження {uploading.name}
            {uploading.percent !== null && ` — ${uploading.percent}%`}
          </span>
          <span className="wb-progress__track">
            <span className="wb-progress__bar" style={{ width: `${uploading.percent ?? 0}%` }} />
          </span>
        </div>
      )}

      {notice && !uploading && (
        <div className={notice.error ? 'wb-banner is-error' : 'wb-banner'}>{notice.text}</div>
      )}

      <div className="wb-body">
        <div className="wb-main">
          <Toolbar
            order={order}
            filter={filter}
            onOrderChange={setOrder}
            onFilterChange={setFilter}
            shown={files.length}
            total={total}
            busy={loading}
          >
            <button
              type="button"
              className="dr-button is-primary"
              onClick={() => fileInput.current?.click()}
            >
              Завантажити файли
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="wb-fileinput"
              onChange={handlePick}
            />
            <ColumnToggle visibility={visibility} onChange={setVisibility} />
          </Toolbar>

          <WebDropzone onFiles={handleDrop}>
            <FileTable
              files={files}
              visibility={visibility}
              sortKey={sortKey}
              order={order}
              onSort={handleSort}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
              onDownload={handleDownload}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          </WebDropzone>
        </div>

        {selected && (
          <FilePreview
            file={selected}
            preview={preview}
            loading={previewLoading}
            error={previewError}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}
