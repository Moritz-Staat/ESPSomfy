import { AuthManager } from '@/api/auth';
import { ApiClient, ApiError } from '@/api/client';
import { createMemoryStore } from '@/api/storage';

const FRESH_KEY = 'a'.repeat(64);

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function makeClient(fetchFn: typeof fetch) {
  const auth = new AuthManager(createMemoryStore());
  const client = new ApiClient({
    baseUrl: 'http://device:8081',
    auth,
    fetchFn,
    timeoutMs: 1000,
    retryDelayMs: 0,
  });
  return { auth, client };
}

describe('ApiClient', () => {
  test('schickt den gespeicherten apikey-Header mit und übernimmt frische Tokens', async () => {
    const seen: string[] = [];
    const fetchFn = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      seen.push((init?.headers as Record<string, string>)?.apikey ?? '');
      return jsonResponse(200, [], { apikey: FRESH_KEY });
    }) as unknown as typeof fetch;
    const { auth, client } = makeClient(fetchFn);
    await auth.setApiKey('alterToken');
    await client.get('/shades');
    expect(seen[0]).toBe('alterToken');
    // Die Firmware liefert in isAuthenticated() einen frischen Token im Response-Header.
    expect(await auth.getApiKey()).toBe(FRESH_KEY);
  });

  test('Auto-Relogin: bei 401 einmal still einloggen und wiederholen', async () => {
    const calls: string[] = [];
    const fetchFn = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      calls.push(u);
      if (u.endsWith('/login')) {
        return jsonResponse(200, { success: true, type: 0, apiKey: FRESH_KEY, msg: 'Success' });
      }
      const key = (init?.headers as Record<string, string>)?.apikey;
      if (key !== FRESH_KEY) return new Response('Unauthorized API Key', { status: 401 });
      return jsonResponse(200, [{ shadeId: 1 }]);
    }) as unknown as typeof fetch;
    const { auth, client } = makeClient(fetchFn);
    await auth.setApiKey('verfälschterToken');

    const result = await client.get<{ shadeId: number }[]>('/shades');
    expect(result).toEqual([{ shadeId: 1 }]);
    expect(calls).toEqual([
      'http://device:8081/shades',
      'http://device:8081/login',
      'http://device:8081/shades',
    ]);
    expect(await auth.getApiKey()).toBe(FRESH_KEY);
  });

  test('Firmware-Fehler: HTTP 500 mit desc wird zu ApiError mit Beschreibung', async () => {
    const fetchFn = jest.fn(async () =>
      jsonResponse(500, { status: 'ERROR', desc: 'Shade with the specified id not found.' })
    ) as unknown as typeof fetch;
    const { client } = makeClient(fetchFn);
    await expect(client.put('/shadeCommand', { shadeId: 99, command: 'Up' })).rejects.toThrow(
      'Shade with the specified id not found.'
    );
    try {
      await client.put('/shadeCommand', { shadeId: 99, command: 'Up' });
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(500);
      expect((err as ApiError).desc).toBe('Shade with the specified id not found.');
    }
  });

  test('GET-Retry: Netzwerkfehler wird einmal wiederholt', async () => {
    let attempt = 0;
    const fetchFn = jest.fn(async () => {
      attempt++;
      if (attempt === 1) throw new TypeError('Network request failed');
      return jsonResponse(200, []);
    }) as unknown as typeof fetch;
    const { client } = makeClient(fetchFn);
    await expect(client.get('/shades')).resolves.toEqual([]);
    expect(attempt).toBe(2);
  });

  test('Kommandos (PUT) werden bei Netzwerkfehlern NICHT wiederholt', async () => {
    let attempts = 0;
    const fetchFn = jest.fn(async () => {
      attempts++;
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const { client } = makeClient(fetchFn);
    await expect(client.put('/shadeCommand', { shadeId: 1, command: 'Up' })).rejects.toThrow();
    expect(attempts).toBe(1);
  });

  test('getText reicht die Antwort unverändert durch', async () => {
    // /backup streamt eine Datei. Durch JSON.parse und JSON.stringify gedreht käme
    // eine andere Datei heraus als die, die das Web-UI herunterlädt.
    const body = '{\n  "shades": [],\n  "rooms": []\n}\n';
    const fetchFn = jest.fn(
      async () => new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    ) as unknown as typeof fetch;
    const { client } = makeClient(fetchFn);
    expect(await client.getText('/backup')).toBe(body);
  });

  test('getText meldet einen HTTP-Fehler als ApiError', async () => {
    const fetchFn = jest.fn(
      async () => new Response('shades.cfg', { status: 500 })
    ) as unknown as typeof fetch;
    const { client } = makeClient(fetchFn);
    await expect(client.getText('/backup')).rejects.toBeInstanceOf(ApiError);
  });

  test('Request-Queue: maximal 2 Requests gleichzeitig', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchFn = jest.fn(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight--;
      return jsonResponse(200, []);
    }) as unknown as typeof fetch;
    const { client } = makeClient(fetchFn);
    await Promise.all([1, 2, 3, 4, 5].map(() => client.get('/shades')));
    expect(maxInFlight).toBe(2);
  });
});
