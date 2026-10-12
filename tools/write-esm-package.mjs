import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const target = resolve(process.argv[2] ?? 'dist/esm');
await mkdir(target, { recursive: true });
await writeFile(
  join(target, 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
  'utf8',
);
console.log(`✓ ${target}/package.json → type: module`);
