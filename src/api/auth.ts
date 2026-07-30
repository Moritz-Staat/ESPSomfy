import { LoginResponse } from '@/models/index';

import { KeyValueStore } from './storage';

// Login-Payloads: {} bei authType None, {pin} bei PinEntry, {username, password} bei Password.
export type Credentials = { pin: string } | { username: string; password: string } | {};

const KEY_API_KEY = 'espsomfy.apiKey';
const KEY_CREDENTIALS = 'espsomfy.credentials';

// Der apiKey ist ein HMAC über Credentials PLUS Client-IP (createAPIToken(remoteIP, ...)).
// Wechselt das Handy das Netz oder die DHCP-Lease, wird der Token wertlos → der
// Client muss bei 401/403 still neu einloggen (Auto-Relogin in client.ts).
export class AuthManager {
  constructor(private store: KeyValueStore) {}

  getApiKey(): Promise<string | null> {
    return this.store.get(KEY_API_KEY);
  }

  async setApiKey(apiKey: string): Promise<void> {
    await this.store.set(KEY_API_KEY, apiKey);
  }

  async getCredentials(): Promise<Credentials> {
    const raw = await this.store.get(KEY_CREDENTIALS);
    return raw ? (JSON.parse(raw) as Credentials) : {};
  }

  async setCredentials(credentials: Credentials): Promise<void> {
    await this.store.set(KEY_CREDENTIALS, JSON.stringify(credentials));
  }

  async clear(): Promise<void> {
    await this.store.delete(KEY_API_KEY);
    await this.store.delete(KEY_CREDENTIALS);
  }
}

export class LoginError extends Error {}

// POST /login. Liefert auch bei authType 0 (ohne Credentials) sofort einen Token.
export async function login(
  baseUrl: string,
  auth: AuthManager,
  credentials?: Credentials,
  fetchFn: typeof fetch = fetch
): Promise<LoginResponse> {
  const body = credentials ?? (await auth.getCredentials());
  const res = await fetchFn(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as LoginResponse;
  if (!res.ok || !data.success) {
    throw new LoginError(data.msg || `Login fehlgeschlagen (HTTP ${res.status})`);
  }
  await auth.setApiKey(data.apiKey);
  if (credentials) await auth.setCredentials(credentials);
  return data;
}
