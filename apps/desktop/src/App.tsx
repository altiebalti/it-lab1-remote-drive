import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { BASE_URL, client, persistToken, restoreSession, setUnauthorizedHandler } from './api';
import { Dropzone, type DroppedFile } from './components/Dropzone';
import { SyncPanel } from './components/SyncPanel';
import { useSync } from './useSync';

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

export function App() {
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

  const show = useCallback((text: string, error = false) => {
    setNotice({ text, error });

    setTimeout(() => setNotice(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const sort = toApiSortField(sortKey);
      const [visible, all] = await Promise.all([
        client.listFiles({ sort, order, filter }),
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

  const sync = useSync(refresh);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession(null);
      setFiles([]);
    });

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
    await persistToken();
    setSession({ displayName: result.user.displayName, email: result.user.email });
  };

  const handleRegister = async (email: string, password: string, displayName: string) => {
    const result = await client.register({ email, password, displayName });
    await persistToken();
    setSession({ displayName: result.user.displayName, email: result.user.email });
  };

  const handleLogout = async () => {
    client.logout();
    await window.desktop.setToken(null);
    await window.desktop.stopWatching();
    setSession(null);
    setFiles([]);
    setSelected(null);
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
          await client.upload({ path: item.name, content: item.bytes }, (progress) =>
            setUploading({ name: item.name, percent: progress.percent }),
          );
          ok += 1;
        } catch (cause) {
          show(
            `${item.name}: ${cause instanceof Error ? cause.message : 'помилка'}`,
            true,
          );
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

  const handlePick = useCallback(async () => {
    const paths = await window.desktop.pickFiles();
    if (paths.length === 0) return;

    const items = await Promise.all(paths.map((p) => window.desktop.readAbsolute(p)));
    await uploadAll(items);
  }, [uploadAll]);

  const handleDrop = useCallback(
    (dropped: DroppedFile[]) => void uploadAll(dropped),
    [uploadAll],
  );

  const handleDownload = useCallback(
    async (file: FileRecord) => {
      try {
        const bytes = await client.downloadBytes(file.id);
        const saved = await window.desktop.saveAs(file.name, bytes);
        if (saved) show(`Збережено: ${saved}`);
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
        await refresh();
        if (selected?.id === file.id) setSelected(null);
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
      if (key === sortKey) {
        setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setOrder('asc');
      }
    },
    [sortKey],
  );

  const serverLabel = useMemo(() => BASE_URL.replace(/^https?:\/\//, ''), []);

  if (booting) {
    return <div className="dr-empty">Запуск…</div>;
  }

  if (!session) {
    return (
      <LoginForm
        onLogin={handleLogin}
        onRegister={handleRegister}
        subtitle={`Десктоп-клієнт · ${serverLabel}`}
      />
    );
  }

  return (
    <div className="dk-shell">
      <header className="dk-header">
        <h1 className="dk-header__title">Віддалений диск</h1>
        <span className="dk-header__badge">Десктоп</span>
        <span className="dk-header__spacer" />
        <span className="dk-header__user">
          {session.displayName} · {serverLabel}
        </span>
        <button type="button" className="dr-button" onClick={handleLogout}>
          Вийти
        </button>
      </header>

      <SyncPanel
        state={sync.state}
        onChooseFolder={sync.chooseFolder}
        onPreview={sync.preview}
        onRun={sync.run}
        onToggleWatching={sync.toggleWatching}
      />

      {uploading && (
        <div className="dk-progress">
          <span className="dk-progress__label">
            Завантаження {uploading.name}
            {uploading.percent !== null && ` — ${uploading.percent}%`}
          </span>
          <span className="dk-progress__track">
            <span
              className="dk-progress__bar"
              style={{ width: `${uploading.percent ?? 0}%` }}
            />
          </span>
        </div>
      )}

      {notice && !uploading && (
        <div className={notice.error ? 'dk-banner is-error' : 'dk-banner'}>
          {notice.text}
        </div>
      )}

      <div className="dk-body">
        <div className="dk-main">
          <Toolbar
            order={order}
            filter={filter}
            onOrderChange={setOrder}
            onFilterChange={setFilter}
            shown={files.length}
            total={total}
            busy={loading}
          >
            <button type="button" className="dr-button is-primary" onClick={handlePick}>
              Завантажити файли
            </button>
            <ColumnToggle visibility={visibility} onChange={setVisibility} />
          </Toolbar>

          <Dropzone onFiles={handleDrop}>
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
          </Dropzone>
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
