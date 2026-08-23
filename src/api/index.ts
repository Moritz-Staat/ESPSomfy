import { AuthManager } from './auth';
import { ApiClient } from './client';
import { Endpoints } from './endpoints';
import { secureStore } from './storage';

export * from './auth';
export * from './client';
export * from './endpoints';
export * from './storage';

// Lesen und Fahrbefehle laufen über den API-Server, die gesamte Verwaltung über den
// Web-UI-Server. Beide teilen sich Token und Anmeldedaten (der apiKey ist ein HMAC
// über Credentials und Client-IP, nicht über den Port).
export const API_PORT = 8081;
export const CONFIG_PORT = 80;

export interface ApiInstance {
  client: ApiClient;
  configClient: ApiClient;
  endpoints: Endpoints;
  auth: AuthManager;
}

// App-weite Singleton-Instanz; wird beim Verbinden (Verbindungs-Screen) konfiguriert.
let instance: ApiInstance | null = null;

export function configureApi(host: string): ApiInstance {
  const auth = new AuthManager(secureStore);
  const client = new ApiClient({ baseUrl: `http://${host}:${API_PORT}`, auth });
  const configClient = new ApiClient({ baseUrl: `http://${host}:${CONFIG_PORT}`, auth });
  instance = { client, configClient, endpoints: new Endpoints(client, configClient), auth };
  return instance;
}

export function getApi(): ApiInstance {
  if (!instance) throw new Error('API nicht konfiguriert — configureApi(host) zuerst aufrufen');
  return instance;
}

export function isApiConfigured(): boolean {
  return instance !== null;
}
