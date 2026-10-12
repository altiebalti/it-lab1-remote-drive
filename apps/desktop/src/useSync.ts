import { useCallback, useEffect, useRef, useState } from 'react';
import { conflictCopyPath, type SyncAction, type SyncPlan } from '@drive/core';
import { countUk } from '@drive/ui';
import { client } from './api';

export interface SyncState {
  folder: string | null;
  plan: SyncPlan | null;
  running: boolean;
  status: string;
  error: string | null;
  watching: boolean;
  lastSyncAt: Date | null;
}

const STORAGE_KEY = 'drive.syncFolder';

export function useSync(onChanged: () => void) {
  const [state, setState] = useState<SyncState>({
    folder: localStorage.getItem(STORAGE_KEY),
    plan: null,
    running: false,
    status: '',
    error: null,
    watching: false,
    lastSyncAt: null,
  });

  const folderRef = useRef(state.folder);
  folderRef.current = state.folder;

  const patch = (next: Partial<SyncState>) =>
    setState((prev) => ({ ...prev, ...next }));

  const chooseFolder = useCallback(async () => {
    const folder = await window.desktop.chooseFolder();
    if (!folder) return;

    localStorage.setItem(STORAGE_KEY, folder);
    patch({ folder, plan: null, status: '', error: null });
  }, []);

  const preview = useCallback(async (): Promise<SyncPlan | null> => {
    const root = folderRef.current;
    if (!root) return null;

    patch({ running: true, error: null, status: 'Порівняння…' });
    try {
      const local = await window.desktop.scanFolder(root);
      const index = await window.desktop.loadIndex(root);

      const plan = await client.syncDiff({
        local: local.map((f) => ({ path: f.path, contentHash: f.contentHash })),
        index,
      });

      patch({
        plan,
        running: false,
        status: plan.changes.length
          ? `${countUk(plan.changes.length, 'зміна', 'зміни', 'змін')} до застосування`
          : 'Усе синхронізовано',
      });
      return plan;
    } catch (cause) {
      patch({
        running: false,
        status: '',
        error: cause instanceof Error ? cause.message : 'Не вдалося порівняти',
      });
      return null;
    }
  }, []);

  const run = useCallback(async () => {
    const root = folderRef.current;
    if (!root) return;

    patch({ running: true, error: null, status: 'Порівняння…' });
    try {
      const local = await window.desktop.scanFolder(root);
      const index = await window.desktop.loadIndex(root);
      const plan = await client.syncDiff({
        local: local.map((f) => ({ path: f.path, contentHash: f.contentHash })),
        index,
      });
      patch({ plan });

      let done = 0;
      for (const action of plan.changes) {
        patch({ status: `${++done} з ${plan.changes.length}: ${describe(action)}` });
        await apply(root, action);
      }

      const freshLocal = await window.desktop.scanFolder(root);
      const freshRemote = await client.manifest();
      const remoteByPath = new Map(freshRemote.map((r) => [r.path, r]));

      await window.desktop.saveIndex(
        root,
        freshLocal
          .filter((f) => remoteByPath.get(f.path)?.contentHash === f.contentHash)
          .map((f) => ({
            path: f.path,
            contentHash: f.contentHash,
            remoteId: remoteByPath.get(f.path)!.id,
          })),
      );

      patch({
        running: false,
        plan: null,
        lastSyncAt: new Date(),
        status: plan.changes.length
          ? `Готово: застосовано ${countUk(plan.changes.length, 'зміну', 'зміни', 'змін')}`
          : 'Усе вже синхронізовано',
      });
      onChanged();
    } catch (cause) {
      patch({
        running: false,
        error: cause instanceof Error ? cause.message : 'Синхронізація не вдалася',
        status: '',
      });
    }
  }, [onChanged]);

  const toggleWatching = useCallback(async () => {
    const root = folderRef.current;
    if (!root) return;

    if (state.watching) {
      await window.desktop.stopWatching();
      patch({ watching: false });
    } else {
      await window.desktop.startWatching(root);
      patch({ watching: true });
    }
  }, [state.watching]);

  useEffect(() => {
    if (!state.watching) return;

    const unsubscribe = window.desktop.onWatchEvent(() => {
      void preview();
    });
    return unsubscribe;
  }, [state.watching, preview]);

  useEffect(() => () => void window.desktop.stopWatching(), []);

  return { state, chooseFolder, preview, run, toggleWatching };
}

async function apply(root: string, action: SyncAction): Promise<void> {
  switch (action.type) {
    case 'upload': {
      const bytes = await window.desktop.readFile(root, action.path);
      await client.upload({ path: action.path, content: bytes });
      return;
    }

    case 'download': {
      const bytes = await client.downloadBytes(action.remoteId);
      await window.desktop.writeFile(root, action.path, bytes);
      return;
    }

    case 'delete-local':
      await window.desktop.deleteFile(root, action.path);
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
      await window.desktop.writeFile(root, copyPath, remoteBytes);

      const localBytes = await window.desktop.readFile(root, action.path);
      await client.upload({ path: action.path, content: localBytes });
      await client.upload({ path: copyPath, content: remoteBytes });
      return;
    }

    case 'up-to-date':
      return;
  }
}

export function describe(action: SyncAction): string {
  switch (action.type) {
    case 'upload':
      return `завантаження ${action.path}`;
    case 'download':
      return `отримання ${action.path}`;
    case 'delete-local':
      return `видалення локально ${action.path}`;
    case 'delete-remote':
      return `видалення на сервері ${action.path}`;
    case 'conflict':
      return `конфлікт ${action.path}`;
    case 'up-to-date':
      return action.path;
  }
}
