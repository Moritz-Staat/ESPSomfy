import { FirmwareError } from '@/models/index';

import { AuthManager, login } from './auth';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly desc?: string
  ) {
    super(message);
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('Request timed out');
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  auth: AuthManager;
  fetchFn?: typeof fetch;
  // Der ESP32 antwortet manchmal träge — 5 s Default.
  timeoutMs?: number;
  // Backoff-Basis für GET-Retries; in Tests auf 0 setzbar.
  retryDelayMs?: number;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
}

// Der ESP32 verträgt keine parallelen Verbindungsfluten — max. 2 Requests gleichzeitig.
const MAX_CONCURRENT = 2;
// Retry nur für GETs (Kommandos dürfen sich nicht wiederholen), max. 2 Versuche gesamt.
const MAX_GET_ATTEMPTS = 2;

export class ApiClient {
  private baseUrl: string;
  private auth: AuthManager;
  private fetchFn: typeof fetch;
  private timeoutMs: number;
  private retryDelayMs: number;
  private active = 0;
  private waiting: (() => void)[] = [];

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.auth = options.auth;
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.retryDelayMs = options.retryDelayMs ?? 300;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async get<T>(path: string): Promise<T> {
    return this.requestWithRetry<T>(path, { method: 'GET' });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body });
  }

  private async requestWithRetry<T>(path: string, options: RequestOptions): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_GET_ATTEMPTS; attempt++) {
      try {
        return await this.request<T>(path, options);
      } catch (err) {
        lastError = err;
        // Nur Netzwerkfehler/Timeouts wiederholen — Firmware-Fehler (ApiError) nicht.
        if (err instanceof ApiError) throw err;
        if (attempt < MAX_GET_ATTEMPTS - 1) {
          await delay(this.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }
    throw lastError;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    await this.acquireSlot();
    try {
      let res = await this.doFetch(path, options);
      if (res.status === 401 || res.status === 403) {
        // Token wertlos (z. B. neue Client-IP) → einmal still neu einloggen.
        await login(this.baseUrl, this.auth, undefined, this.fetchFn);
        res = await this.doFetch(path, options);
      }
      return await this.parseResponse<T>(res);
    } finally {
      this.releaseSlot();
    }
  }

  private async doFetch(path: string, options: RequestOptions): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {};
      const apiKey = await this.auth.getApiKey();
      // apikey-Header bei jedem Request mitschicken.
      if (apiKey) headers.apikey = apiKey;
      if (options.body !== undefined) headers['Content-Type'] = 'application/json';
      const res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      // Die Firmware schickt in isAuthenticated() einen frischen Token zurück.
      const freshKey = res.headers.get('apikey');
      if (freshKey) await this.auth.setApiKey(freshKey);
      return res;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw new TimeoutError();
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async parseResponse<T>(res: Response): Promise<T> {
    const text = await res.text();
    if (!res.ok) {
      // Firmware-Fehler kommen als HTTP 500 mit {"status":"ERROR","desc":"..."}.
      let desc: string | undefined;
      try {
        desc = (JSON.parse(text) as FirmwareError).desc;
      } catch {
        // Kein JSON-Body (z. B. "Unauthorized API Key").
      }
      throw new ApiError(desc ?? `HTTP ${res.status}`, res.status, desc);
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }

  private acquireSlot(): Promise<void> {
    if (this.active < MAX_CONCURRENT) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waiting.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.active--;
    const next = this.waiting.shift();
    if (next) next();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
