import type { FileFilter, FileRecord, SortOrder, SyncPlan } from '@drive/core';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ListFilesQuery {
  sort?: 'createdAt' | 'name' | 'updatedAt';
  order?: SortOrder;
  filter?: FileFilter;
}

export type PreviewResult =
  | { kind: 'text'; content: string }
  | { kind: 'image'; url: string }
  | { kind: 'unsupported'; message: string };

export interface ManifestEntry {
  id: string;
  path: string;
  contentHash: string;
}

export type { FileRecord, SyncPlan };

export interface SyncDiffInput {
  local: Array<{ path: string; contentHash: string }>;
  index?: Array<{ path: string; contentHash: string; remoteId: string }>;
}

export interface ProgressEvent {
  loaded: number;

  total: number | null;

  percent: number | null;
}

export type ProgressHandler = (event: ProgressEvent) => void;

export interface UploadInput {

  path: string;

  content: Blob | Uint8Array;

  fileName?: string;
  mimeType?: string;
}
