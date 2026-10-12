import type { FileRecord, SortOrder } from '@drive/core';
import { detectPreviewKind } from '@drive/core';
import { visibleColumns, type ColumnKey, type ColumnVisibility } from '../columns.js';
import { formatDateTime, formatExtension, formatSize } from '../formatters.js';

export interface FileTableProps {
  files: FileRecord[];
  visibility: ColumnVisibility;

  sortKey: ColumnKey;
  order: SortOrder;
  onSort: (key: ColumnKey) => void;
  selectedId?: string | null;

  onSelect: (file: FileRecord) => void;
  onDownload?: (file: FileRecord) => void;
  onRename?: (file: FileRecord) => void;
  onDelete?: (file: FileRecord) => void;
  emptyMessage?: string;
}

function fileIcon(file: FileRecord): string {
  const kind = detectPreviewKind(file.name);
  if (kind === 'image') return '🖼';
  if (kind === 'text') return '📄';
  return '📦';
}

export function FileTable({
  files,
  visibility,
  sortKey,
  order,
  onSort,
  selectedId,
  onSelect,
  onDownload,
  onRename,
  onDelete,
  emptyMessage = 'Файлів немає. Завантажте перший — або перетягніть його сюди.',
}: FileTableProps) {
  const columns = visibleColumns(visibility);
  const hasActions = Boolean(onDownload || onRename || onDelete);

  if (files.length === 0) {
    return <div className="dr-empty">{emptyMessage}</div>;
  }

  return (
    <div className="dr-table__wrap">
      <table className="dr-table">
        <thead>
          <tr>
            <th className="dr-table__icon" aria-hidden="true" />
            {columns.map((column) => {
              const active = column.sortable && sortKey === column.key;
              return (
                <th
                  key={column.key}
                  className={[
                    column.align === 'right' ? 'is-right' : '',
                    column.sortable ? 'is-sortable' : '',
                    active ? 'is-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={column.sortable ? () => onSort(column.key) : undefined}
                  aria-sort={
                    active ? (order === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  {column.label}
                  {active && <span className="dr-table__arrow">{order === 'asc' ? '↑' : '↓'}</span>}
                </th>
              );
            })}
            {hasActions && <th className="dr-table__actions">Дії</th>}
          </tr>
        </thead>

        <tbody>
          {files.map((file) => (
            <tr
              key={file.id}
              className={file.id === selectedId ? 'is-selected' : ''}
              onClick={() => onSelect(file)}
            >
              <td className="dr-table__icon">{fileIcon(file)}</td>

              {columns.map((column) => (
                <td
                  key={column.key}
                  className={column.align === 'right' ? 'is-right' : ''}
                >
                  {renderCell(file, column.key)}
                </td>
              ))}

              {hasActions && (
                <td
                  className="dr-table__actions"

                  onClick={(event) => event.stopPropagation()}
                >
                  {onDownload && (
                    <button type="button" title="Вивантажити" onClick={() => onDownload(file)}>
                      ⬇
                    </button>
                  )}
                  {onRename && (
                    <button type="button" title="Перейменувати" onClick={() => onRename(file)}>
                      ✎
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      title="Видалити"
                      className="is-danger"
                      onClick={() => onDelete(file)}
                    >
                      🗑
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(file: FileRecord, key: ColumnKey): React.ReactNode {
  switch (key) {
    case 'name':

      return (
        <span className="dr-table__name" title={file.path}>
          {file.name}
          {file.path !== file.name && (
            <span className="dr-table__dir">{file.path.slice(0, -file.name.length)}</span>
          )}
        </span>
      );
    case 'ext':
      return <span className="dr-badge">{formatExtension(file.ext)}</span>;
    case 'size':
      return formatSize(file.size);
    case 'createdAt':
      return formatDateTime(file.createdAt);
    case 'updatedAt':
      return formatDateTime(file.updatedAt);
    case 'uploadedBy':
      return file.uploadedBy.displayName;
    case 'editedBy':
      return file.editedBy?.displayName ?? <span className="dr-muted">—</span>;
  }
}
