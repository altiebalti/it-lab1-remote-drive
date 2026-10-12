'use client';

import { DriveClient } from '@drive/api-client';

export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api';

const TOKEN_KEY = 'drive.token';

let onUnauthorizedHandler: (() => void) | null = null;

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {

    return null;
  }
}

export function persistToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
  }
}

export const client = new DriveClient({
  baseUrl: BASE_URL,
  onUnauthorized: () => {
    persistToken(null);
    onUnauthorizedHandler?.();
  },
});

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorizedHandler = handler;
}

export async function restoreSession(): Promise<boolean> {
  const token = readToken();
  if (!token) return false;

  client.setToken(token);
  try {
    await client.me();
    return true;
  } catch {
    persistToken(null);
    client.setToken(null);
    return false;
  }
}
