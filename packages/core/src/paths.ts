export class InvalidPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPathError';
  }
}

const FORBIDDEN = /[<>:"\\|?*\u0000-\u001f]/;

export const MAX_PATH_LENGTH = 1024;
export const MAX_SEGMENT_LENGTH = 255;

export function normalizeRelativePath(input: string): string {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new InvalidPathError('Шлях не може бути порожнім');
  }

  const unified = input.trim().replace(/\\/g, '/');
  const segments: string[] = [];

  for (const raw of unified.split('/')) {
    const segment = raw.trim();

    if (segment === '' || segment === '.') continue;

    if (segment === '..') {
      throw new InvalidPathError('Шлях не може виходити за межі кореня диска');
    }
    if (FORBIDDEN.test(segment)) {
      throw new InvalidPathError(`Недопустимі символи у назві «${segment}»`);
    }
    if (segment.length > MAX_SEGMENT_LENGTH) {
      throw new InvalidPathError('Назва файлу або папки задовга');
    }
    segments.push(segment);
  }

  if (segments.length === 0) {
    throw new InvalidPathError('Шлях не містить назви файлу');
  }

  const result = segments.join('/');
  if (result.length > MAX_PATH_LENGTH) {
    throw new InvalidPathError('Шлях задовгий');
  }
  return result;
}

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function dirName(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}
