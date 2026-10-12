import { DriveClient } from '@drive/api-client';

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3002/api';

let onUnauthorizedHandler: (() => void) | null = null;

export const client = new DriveClient({
  baseUrl: BASE_URL,
  onUnauthorized: () => onUnauthorizedHandler?.(),
});

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorizedHandler = handler;
}

export async function restoreSession(): Promise<boolean> {
  const token = await window.desktop.getToken();
  if (!token) return false;

  client.setToken(token);
  try {
    await client.me();
    return true;
  } catch {

    await window.desktop.setToken(null);
    client.setToken(null);
    return false;
  }
}

export async function persistToken(): Promise<void> {
  await window.desktop.setToken(client.getToken());
}

export { BASE_URL };
