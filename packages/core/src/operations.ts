import { VARIANT_FILTER_EXTENSIONS, extensionOf } from './variant.js';

export type SortOrder = 'asc' | 'desc';
export type FileFilter = 'all' | 'variant';

export interface SortableByCreation {
  createdAt: string | Date;
  name: string;
}

export interface FilterableByExtension {
  name: string;
}

function toTime(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function sortByCreatedAt<T extends SortableByCreation>(
  files: readonly T[],
  order: SortOrder,
): T[] {
  const direction = order === 'asc' ? 1 : -1;

  return [...files].sort((a, b) => {
    const diff = toTime(a.createdAt) - toTime(b.createdAt);
    if (diff !== 0) return diff * direction;
    return a.name.localeCompare(b.name, 'uk');
  });
}

export function filterByVariant<T extends FilterableByExtension>(
  files: readonly T[],
  filter: FileFilter,
): T[] {
  if (filter === 'all') return [...files];

  const allowed = VARIANT_FILTER_EXTENSIONS as readonly string[];
  return files.filter((file) => allowed.includes(extensionOf(file.name)));
}

export function applyVariantOperation<
  T extends SortableByCreation & FilterableByExtension,
>(files: readonly T[], filter: FileFilter, order: SortOrder): T[] {
  return sortByCreatedAt(filterByVariant(files, filter), order);
}
