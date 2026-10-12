'use client';

import { conflictCopyPath, type SyncAction, type SyncPlan } from '@drive/core';
import { client } from './api';

export interface LocalEntry {
  path: string;
  contentHash: string;
  handle: FileSystemFileHandle;
}

export interface SyncIndexEntry {
  path: string;
  contentHash: string;
  remoteId: string;
}

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const SKIP = new Set(['.DS_Store', 'Thumbs.db', '.git', 'node_modules']);

export async function scanDirectory(
  root: FileSystemDirectoryHandle,
  prefix = '',
): Promise<LocalEntry[]> {
  const result: LocalEntry[] = [];

  for await (const [name, handle] of root.entries()) {
    if (SKIP.has(name)) continue;
    const path = prefix ? `${prefix}/${name}` : name;

    if (handle.kind === 'directory') {
      result.push(...(await scanDirectory(handle as FileSystemDirectoryHandle, path)));
      continue;
    }

    const file = await (handle as FileSystemFileHandle).getFile();
    result.push({
      path,
      contentHash: await sha256Hex(await file.arrayBuffer()),
      handle: handle as FileSystemFileHandle,
    });
  }

  result.sort((a, b) => a.path.localeCompare(b.path));
  return result;
}

async function resolveFileHandle(
  root: FileSystemDirectoryHandle,
  path: string,
  create: boolean,
): Promise<FileSystemFileHandle> {
  const parts = path.split('/');
  const fileName = parts.pop()!;

  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return dir.getFileHandle(fileName, { create });
}

async function writeLocal(
  root: FileSystemDirectoryHandle,
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  const handle = await resolveFileHandle(root, path, true);
  const writable = await handle.createWritable();
  await writable.write(bytes as unknown as BufferSource);
  await writable.close();
}

async function deleteLocal(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<void> {
  const parts = path.split('/');
  const fileName = parts.pop()!;

  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part);
  }
  await dir.removeEntry(fileName);
}

export async function applyAction(
  root: FileSystemDirectoryHandle,
  local: Map<string, LocalEntry>,
  action: SyncAction,
): Promise<void> {
  switch (action.type) {
    case 'upload': {
      const entry = local.get(action.path);
      if (!entry) return;
      const file = await entry.handle.getFile();
      await client.upload({
        path: action.path,
        content: new Uint8Array(await file.arrayBuffer()),
      });
      return;
    }

    case 'download': {
      const bytes = await client.downloadBytes(action.remoteId);
      await writeLocal(root, action.path, bytes);
      return;
    }

    case 'delete-local':
      await deleteLocal(root, action.path);
      return;

    case 'delete-remote': {
      const remote = await client.manifest();
      const target = remote.find((r) => r.path === action.path);
      if (target) await client.remove(target.id);
      return;
    }

    case 'conflict': {

      const remoteBytes = await client.downloadBytes(action.remoteId);
      const copyPath = conflictCopyPath(action.path);
      await writeLocal(root, copyPath, remoteBytes);

      const entry = local.get(action.path);
      if (entry) {
        const file = await entry.handle.getFile();
        await client.upload({
          path: action.path,
          content: new Uint8Array(await file.arrayBuffer()),
        });
      }
      await client.upload({ path: copyPath, content: remoteBytes });
      return;
    }

    case 'up-to-date':
      return;
  }
}

const indexKey = (folderName: string) => `drive.syncIndex.${folderName}`;

export function loadIndex(folderName: string): SyncIndexEntry[] {
  try {
    const raw = localStorage.getItem(indexKey(folderName));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveIndex(folderName: string, entries: SyncIndexEntry[]): void {
  try {
    localStorage.setItem(indexKey(folderName), JSON.stringify(entries));
  } catch {
  }
}

export type { SyncPlan };
