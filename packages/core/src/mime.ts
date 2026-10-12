import { extensionOf } from './variant.js';

const BY_EXTENSION: Record<string, string> = {

  '.cs': 'text/x-csharp',
  '.xml': 'application/xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',

  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
};

const GENERIC = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'application/x-msdownload',
]);

export function resolveMimeType(fileName: string, clientMimeType?: string): string {
  const known = BY_EXTENSION[extensionOf(fileName)];

  if (clientMimeType && !GENERIC.has(clientMimeType.toLowerCase())) {
    return clientMimeType;
  }
  return known ?? 'application/octet-stream';
}
