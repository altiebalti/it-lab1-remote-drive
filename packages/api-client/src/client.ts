import axios, {
  AxiosError,
  AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ApiError, NetworkError, TimeoutError } from './errors.js';
import type {
  AuthResult,
  FileRecord,
  ListFilesQuery,
  LoginInput,
  ManifestEntry,
  PreviewResult,
  ProgressHandler,
  PublicUser,
  RegisterInput,
  SyncDiffInput,
  SyncPlan,
  UploadInput,
} from './types.js';

export interface DriveClientOptions {

  baseUrl: string;

  token?: string | null;

  onUnauthorized?: () => void;

  timeoutMs?: number;

  instance?: AxiosInstance;
}

const DEFAULT_TIMEOUT_MS = 30_000;

const UPLOAD_TIMEOUT_MS = 5 * 60_000;

export class DriveClient {

  private static readonly PUBLIC_PATHS = ['/auth/login', '/auth/register'];

  private static readonly SENDABLE_TOKEN = /^[\x21-\x7e]+$/;

  private token: string | null;
  private readonly http: AxiosInstance;

  private readonly plain: AxiosInstance;
  private readonly onUnauthorized?: () => void;
  private readonly timeoutMs: number;

  constructor(options: DriveClientOptions) {
    this.token = options.token ?? null;
    this.onUnauthorized = options.onUnauthorized;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    this.http =
      options.instance ??
      axios.create({

        baseURL: options.baseUrl.replace(/\/+$/, ''),
        timeout: this.timeoutMs,
      });

    this.plain = axios.create({ timeout: this.timeoutMs });

    this.http.interceptors.request.use((config) => this.attachToken(config));
    this.http.interceptors.response.use(
      (response) => response,
      (error: unknown) => this.handleError(error),
    );
    this.plain.interceptors.response.use(
      (response) => response,
      (error: unknown) => this.handleError(error),
    );
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const { data } = await this.http.post<AuthResult>('/auth/register', input);
    this.token = data.accessToken;
    return data;
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const { data } = await this.http.post<AuthResult>('/auth/login', input);
    this.token = data.accessToken;
    return data;
  }

  async me(): Promise<PublicUser> {
    const { data } = await this.http.get<PublicUser>('/auth/me');
    return data;
  }

  logout(): void {
    this.token = null;
  }

  async listFiles(query: ListFilesQuery = {}): Promise<FileRecord[]> {
    const { data } = await this.http.get<FileRecord[]>('/files', {
      params: query,
    });
    return data;
  }

  async upload(input: UploadInput, onProgress?: ProgressHandler): Promise<FileRecord> {
    const form = new FormData();
    form.set('path', input.path);

    const fileName = input.fileName ?? input.path.split('/').pop() ?? 'file';
    const blob =
      input.content instanceof Uint8Array
        ? new Blob([input.content as unknown as BlobPart], {
            type: input.mimeType ?? 'application/octet-stream',
          })
        : input.content;

    form.set('file', blob, fileName);

    const { data } = await this.http.post<FileRecord>('/files', form, {
      timeout: UPLOAD_TIMEOUT_MS,
      onUploadProgress: onProgress
        ? (event) => {

            const percent = event.total
              ? Math.round((event.loaded / event.total) * 100)
              : null;
            onProgress({ loaded: event.loaded, total: event.total ?? null, percent });
          }
        : undefined,
    });
    return data;
  }

  async preview(id: string): Promise<PreviewResult> {
    const { data } = await this.http.get<PreviewResult>(`/files/${id}/preview`);
    return data;
  }

  async downloadUrl(id: string): Promise<string> {
    const { data } = await this.http.get<{ url: string }>(`/files/${id}/download`);
    return data.url;
  }

  async downloadBytes(id: string, onProgress?: ProgressHandler): Promise<Uint8Array> {
    const url = await this.downloadUrl(id);

    const { data } = await this.plain.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: UPLOAD_TIMEOUT_MS,
      onDownloadProgress: onProgress
        ? (event) => {
            const percent = event.total
              ? Math.round((event.loaded / event.total) * 100)
              : null;
            onProgress({ loaded: event.loaded, total: event.total ?? null, percent });
          }
        : undefined,
    });
    return new Uint8Array(data);
  }

  async rename(id: string, path: string): Promise<FileRecord> {
    const { data } = await this.http.patch<FileRecord>(`/files/${id}`, { path });
    return data;
  }

  async remove(id: string): Promise<void> {
    await this.http.delete(`/files/${id}`);
  }

  async manifest(): Promise<ManifestEntry[]> {
    const { data } = await this.http.get<ManifestEntry[]>('/files/manifest');
    return data;
  }

  async syncDiff(input: SyncDiffInput): Promise<SyncPlan> {
    const { data } = await this.http.post<SyncPlan>('/sync/diff', input);
    return data;
  }

  private isPublic(url?: string): boolean {
    if (!url) return false;
    return DriveClient.PUBLIC_PATHS.some(
      (path) => url === path || url.startsWith(`${path}?`),
    );
  }

  private attachToken(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    if (!this.token || this.isPublic(config.url)) return config;

    if (DriveClient.SENDABLE_TOKEN.test(this.token)) {
      config.headers.set('Authorization', `Bearer ${this.token}`);
      return config;
    }

    this.token = null;
    this.onUnauthorized?.();
    throw new ApiError(401, 'Сесія недійсна. Увійдіть заново.');
  }

  private handleError(error: unknown): never {

    if (error instanceof ApiError) throw error;

    if (!axios.isAxiosError(error)) {
      throw new NetworkError(error);
    }

    const axiosError = error as AxiosError;

    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      throw new TimeoutError(this.timeoutMs);
    }

    if (!axiosError.response) {
      throw new NetworkError(axiosError);
    }

    const apiError = ApiError.fromAxios(axiosError);

    if (apiError.isUnauthorized && !this.isPublic(axiosError.config?.url)) {
      this.token = null;
      this.onUnauthorized?.();
    }
    throw apiError;
  }
}

export type { AxiosRequestConfig };
