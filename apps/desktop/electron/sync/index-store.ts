import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface SyncIndexEntry {
  path: string;
  contentHash: string;
  remoteId: string;
}

export class SyncIndexStore {
  constructor(private readonly baseDir: string) {}

  private fileFor(root: string): string {
    const key = createHash('sha1').update(root).digest('hex').slice(0, 16);
    return join(this.baseDir, `sync-index-${key}.json`);
  }

  async load(root: string): Promise<SyncIndexEntry[]> {
    try {
      const raw = await readFile(this.fileFor(root), 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.entries) ? parsed.entries : [];
    } catch {

      return [];
    }
  }

  async save(root: string, entries: SyncIndexEntry[]): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    await writeFile(
      this.fileFor(root),
      JSON.stringify({ root, savedAt: new Date().toISOString(), entries }, null, 2),
      'utf8',
    );
  }
}
