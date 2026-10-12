export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 Б';

  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const power = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** power;

  const text = power === 0 ? String(bytes) : value.toFixed(1).replace('.', ',');
  return `${text} ${units[power]}`;
}

export function formatDateTime(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatExtension(ext: string): string {
  return ext.startsWith('.') ? ext.slice(1).toUpperCase() : ext.toUpperCase();
}

export function pluralUk(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const absolute = Math.abs(count) % 100;
  if (absolute >= 11 && absolute <= 14) return many;

  switch (absolute % 10) {
    case 1:
      return one;
    case 2:
    case 3:
    case 4:
      return few;
    default:
      return many;
  }
}

export function countUk(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  return `${count} ${pluralUk(count, one, few, many)}`;
}
