import { AuthManager } from './auth';
import { ApiClient } from './client';
import { Endpoints } from './endpoints';
import { secureStore } from './storage';

export * from './auth';
export * from './client';
export * from './endpoints';
export * from './storage';

// App-weite Singleton-Instanz; wird beim Verbinden (Verbindungs-Screen) konfiguriert.
let instance: { client: ApiClient; endpoints: Endpoints; auth: AuthManager } | null = null;

export function configureApi(baseUrl: string): { client: ApiClient; endpoints: Endpoints } {
  const auth = new AuthManager(secureStore);
  const client = new ApiClient({ baseUrl, auth });
  instance = { client, endpoints: new Endpoints(client), auth };
  return instance;
}

export function getApi(): { client: ApiClient; endpoints: Endpoints; auth: AuthManager } {
  if (!instance) throw new Error('API nicht konfiguriert — configureApi(baseUrl) zuerst aufrufen');
  return instance;
}

export function isApiConfigured(): boolean {
  return instance !== null;
}
