import type { FileRecord } from '@drive/core';

export type ColumnKey =
  | 'name'
  | 'ext'
  | 'size'
  | 'createdAt'
  | 'updatedAt'
  | 'uploadedBy'
  | 'editedBy';

export interface ColumnDefinition {
  key: ColumnKey;
  label: string;

  alwaysVisible?: boolean;

  sortable?: boolean;
  align?: 'left' | 'right';
}

export const COLUMNS: readonly ColumnDefinition[] = [
  { key: 'name', label: 'Назва', alwaysVisible: true, sortable: true },
  { key: 'ext', label: 'Тип' },
  { key: 'size', label: 'Розмір', align: 'right' },

  { key: 'createdAt', label: 'Створено', sortable: true },
  { key: 'updatedAt', label: 'Змінено', sortable: true },
  { key: 'uploadedBy', label: 'Завантажив' },
  { key: 'editedBy', label: 'Редагував' },
];

export const HIDEABLE_COLUMNS: readonly ColumnKey[] = COLUMNS.filter(
  (c) => !c.alwaysVisible,
).map((c) => c.key);

export type ColumnVisibility = Record<ColumnKey, boolean>;

export function defaultVisibility(): ColumnVisibility {
  return COLUMNS.reduce((acc, column) => {
    acc[column.key] = true;
    return acc;
  }, {} as ColumnVisibility);
}

export function toggleColumn(
  visibility: ColumnVisibility,
  key: ColumnKey,
): ColumnVisibility {
  const definition = COLUMNS.find((c) => c.key === key);
  if (!definition || definition.alwaysVisible) return visibility;

  return { ...visibility, [key]: !visibility[key] };
}

export function setAllColumns(visible: boolean): ColumnVisibility {
  return COLUMNS.reduce((acc, column) => {
    acc[column.key] = column.alwaysVisible ? true : visible;
    return acc;
  }, {} as ColumnVisibility);
}

export function visibleColumns(
  visibility: ColumnVisibility,
): ColumnDefinition[] {
  return COLUMNS.filter((c) => c.alwaysVisible || visibility[c.key]);
}

export function cellText(file: FileRecord, key: ColumnKey): string {
  switch (key) {
    case 'name':
      return file.name;
    case 'ext':
      return file.ext;
    case 'size':
      return String(file.size);
    case 'createdAt':
      return file.createdAt;
    case 'updatedAt':
      return file.updatedAt;
    case 'uploadedBy':
      return file.uploadedBy.displayName;
    case 'editedBy':
      return file.editedBy?.displayName ?? '';
  }
}
