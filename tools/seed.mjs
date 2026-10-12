import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DriveClient } from '../packages/api-client/dist/esm/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');

const email = process.argv[2] ?? 'olena@example.com';
const password = process.argv[3] ?? 'superSecret123';
const baseUrl = process.env.API_URL ?? 'http://localhost:3002/api';

const FILES = [
  { src: 'Program.cs', path: 'src/Program.cs' },
  { src: 'FileService.cs', path: 'src/FileService.cs' },
  { src: 'schema.xml', path: 'docs/schema.xml' },
  { src: 'config.xml', path: 'docs/config.xml' },
  { src: 'photo.jpg', path: 'images/photo.jpg' },
  { src: 'icon.png', path: 'images/icon.png' },
  { src: 'notes.txt', path: 'notes.txt' },
];

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const client = new DriveClient({ baseUrl });

try {
  await client.login({ email, password });
} catch {
  await client.register({ email, password, displayName: 'Олена Тимченко' });
  console.log('  користувача створено');
}

for (const file of await client.listFiles()) {
  await client.remove(file.id);
}
console.log('  диск очищено');

for (const { src, path } of FILES) {
  const content = new Uint8Array(await readFile(join(FIXTURES, src)));
  const record = await client.upload({ path, content });
  console.log(`  ${record.path.padEnd(22)} ${String(record.size).padStart(6)} Б  ${record.mimeType}`);

  await sleep(1100);
}

const target = (await client.listFiles()).find((f) => f.path === 'docs/config.xml');
if (target) {
  const renamed = await client.rename(target.id, 'docs/settings.xml');
  console.log(`  перейменовано → ${renamed.path} (редагував: ${renamed.editedBy?.displayName})`);
}

const all = await client.listFiles({ order: 'desc' });
console.log(`\n  файлів на диску: ${all.length}`);
