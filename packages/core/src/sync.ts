export interface LocalFileState {
  path: string;
  contentHash: string;
}

export interface RemoteFileState {
  id: string;
  path: string;
  contentHash: string;
}

export interface SyncIndexEntry {
  path: string;
  contentHash: string;
  remoteId: string;
}

export type SyncAction =
  | { type: 'upload'; path: string; reason: 'new-local' | 'local-modified' }
  | { type: 'download'; path: string; remoteId: string; reason: 'new-remote' | 'remote-modified' }
  | { type: 'delete-remote'; path: string; remoteId: string }
  | { type: 'delete-local'; path: string }
  | { type: 'conflict'; path: string; remoteId: string }
  | { type: 'up-to-date'; path: string };

export interface SyncPlan {
  actions: SyncAction[];

  changes: SyncAction[];
}

export function computeSyncPlan(
  local: readonly LocalFileState[],
  remote: readonly RemoteFileState[],
  index: readonly SyncIndexEntry[],
): SyncPlan {
  const localByPath = new Map(local.map((f) => [f.path, f]));
  const remoteByPath = new Map(remote.map((f) => [f.path, f]));
  const indexByPath = new Map(index.map((e) => [e.path, e]));

  const paths = [
    ...new Set([...localByPath.keys(), ...remoteByPath.keys(), ...indexByPath.keys()]),
  ].sort();

  const actions: SyncAction[] = [];

  for (const path of paths) {
    const l = localByPath.get(path);
    const r = remoteByPath.get(path);
    const i = indexByPath.get(path);

    if (l && !r) {

      actions.push(
        i
          ? { type: 'delete-local', path }
          : { type: 'upload', path, reason: 'new-local' },
      );
      continue;
    }

    if (!l && r) {

      actions.push(
        i
          ? { type: 'delete-remote', path, remoteId: r.id }
          : { type: 'download', path, remoteId: r.id, reason: 'new-remote' },
      );
      continue;
    }

    if (!l && !r) continue;

    const localFile = l!;
    const remoteFile = r!;

    if (localFile.contentHash === remoteFile.contentHash) {
      actions.push({ type: 'up-to-date', path });
      continue;
    }

    if (!i) {
      actions.push({ type: 'conflict', path, remoteId: remoteFile.id });
      continue;
    }

    const localChanged = localFile.contentHash !== i.contentHash;
    const remoteChanged = remoteFile.contentHash !== i.contentHash;

    if (localChanged && remoteChanged) {
      actions.push({ type: 'conflict', path, remoteId: remoteFile.id });
    } else if (localChanged) {
      actions.push({ type: 'upload', path, reason: 'local-modified' });
    } else {
      actions.push({
        type: 'download',
        path,
        remoteId: remoteFile.id,
        reason: 'remote-modified',
      });
    }
  }

  return { actions, changes: actions.filter((a) => a.type !== 'up-to-date') };
}

export function conflictCopyPath(path: string): string {
  const slash = path.lastIndexOf('/');
  const dir = slash === -1 ? '' : path.slice(0, slash + 1);
  const base = path.slice(slash + 1);
  const dot = base.lastIndexOf('.');

  return dot <= 0
    ? `${dir}${base} (конфлікт)`
    : `${dir}${base.slice(0, dot)} (конфлікт)${base.slice(dot)}`;
}
