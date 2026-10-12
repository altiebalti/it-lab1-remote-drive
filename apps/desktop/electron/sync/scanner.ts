import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

export interface LocalFileState {
  path: string;
  contentHash: string;
  size: number;
  mtimeMs: number;
}

const SKIP = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.git',
  'node_modules',
  '.drive-index.json',
]);

export function hashContent(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function scanFolder(root: string): Promise<LocalFileState[]> {
  const result: LocalFileState[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {

      return;
    }

    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue;

      const absolute = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }

      if (!entry.isFile()) continue;

      try {
        const info = await stat(absolute);
        const content = await readFile(absolute);
        result.push({
          path: relative(root, absolute).split(sep).join('/'),
          contentHash: hashContent(content),
          size: info.size,
          mtimeMs: info.mtimeMs,
        });
      } catch {
      }
    }
  }

  await walk(root);
  result.sort((a, b) => a.path.localeCompare(b.path));
  return result;
}
