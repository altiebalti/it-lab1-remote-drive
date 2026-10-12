import type { FileRecord } from '@drive/core';
import { formatDateTime, formatSize } from '../formatters.js';

export type PreviewData =
  | { kind: 'text'; content: string }
  | { kind: 'image'; url: string }
  | { kind: 'unsupported'; message: string };

export interface FilePreviewProps {
  file: FileRecord | null;
  preview: PreviewData | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
}

export function FilePreview({
  file,
  preview,
  loading,
  error,
  onClose,
}: FilePreviewProps) {
  if (!file) return null;

  return (
    <aside className="dr-preview">
      <header className="dr-preview__head">
        <div>
          <h2 className="dr-preview__title" title={file.path}>
            {file.name}
          </h2>
          <p className="dr-preview__meta">
            {formatSize(file.size)} · створено {formatDateTime(file.createdAt)}
          </p>
        </div>
        <button
          type="button"
          className="dr-preview__close"
          onClick={onClose}
          aria-label="Закрити перегляд"
        >
          ✕
        </button>
      </header>

      <dl className="dr-preview__attrs">
        <div>
          <dt>Шлях</dt>
          <dd>{file.path}</dd>
        </div>
        <div>
          <dt>Змінено</dt>
          <dd>{formatDateTime(file.updatedAt)}</dd>
        </div>
        <div>
          <dt>Завантажив</dt>
          <dd>{file.uploadedBy.displayName}</dd>
        </div>
        <div>
          <dt>Редагував</dt>
          <dd>{file.editedBy?.displayName ?? '—'}</dd>
        </div>
      </dl>

      <div className="dr-preview__body">
        {loading && <p className="dr-muted">Завантаження вмісту…</p>}
        {error && <p className="dr-error">{error}</p>}

        {!loading && !error && preview?.kind === 'text' && (
          <pre className="dr-preview__code">
            <code>{preview.content}</code>
          </pre>
        )}

        {!loading && !error && preview?.kind === 'image' && (
          <div className="dr-preview__image">
            <img src={preview.url} alt={file.name} />
          </div>
        )}

        {!loading && !error && preview?.kind === 'unsupported' && (
          <p className="dr-muted">{preview.message}</p>
        )}
      </div>
    </aside>
  );
}
