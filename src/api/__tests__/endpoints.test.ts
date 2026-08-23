import { AuthManager } from '@/api/auth';
import { ApiClient, ApiError } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import { createMemoryStore } from '@/api/storage';

interface SeenRequest {
  url: string;
  method: string;
  body: unknown;
}

function makeEndpoints(respond: (url: string) => Response) {
  const seen: SeenRequest[] = [];
  const fetchFn = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    seen.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return respond(String(url));
  }) as unknown as typeof fetch;

  const auth = new AuthManager(createMemoryStore());
  const opts = { auth, fetchFn, timeoutMs: 1000, retryDelayMs: 0 };
  const client = new ApiClient({ baseUrl: 'http://device:8081', ...opts });
  const config = new ApiClient({ baseUrl: 'http://device:80', ...opts });
  return { endpoints: new Endpoints(client, config), seen };
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe('Endpoints — Portverteilung', () => {
  test('Lesen und Fahrbefehle gehen an den API-Server auf 8081', async () => {
    const { endpoints, seen } = makeEndpoints(() => ok([]));
    await endpoints.getShades();
    await endpoints.shadeCommand({ shadeId: 3, command: 'Up' });
    await endpoints.setPositions({ shadeId: 3, myPos: 40 });
    expect(seen.map((r) => r.url)).toEqual([
      'http://device:8081/shades',
      'http://device:8081/shadeCommand',
      'http://device:8081/setPositions',
    ]);
  });

  // Die Verwaltungsrouten sind auf 8081 nicht registriert (dort ist /shade etwa nur
  // als HTTP_GET gebunden) — sie müssen zwingend auf Port 80 landen.
  test('Verwaltung geht an den Web-UI-Server auf Port 80', async () => {
    const { endpoints, seen } = makeEndpoints(() => ok({}));
    await endpoints.saveShade({ shadeId: 3, name: 'Küche' });
    await endpoints.saveRoom({ roomId: 2, name: 'Bad' });
    await endpoints.saveGroup({ groupId: 1, name: 'Erdgeschoss' });
    await endpoints.addRoom({ name: 'Flur' });
    await endpoints.addGroup({ name: 'Süden' });
    await endpoints.deleteRoom(2);
    await endpoints.deleteGroup(1);
    await endpoints.deleteShade(3);
    await endpoints.linkToGroup({ shadeId: 3, groupId: 1 });
    await endpoints.unlinkFromGroup({ shadeId: 3, groupId: 1 });

    expect(seen.map((r) => r.url)).toEqual([
      'http://device:80/saveShade',
      'http://device:80/saveRoom',
      'http://device:80/saveGroup',
      'http://device:80/addRoom',
      'http://device:80/addGroup',
      'http://device:80/deleteRoom',
      'http://device:80/deleteGroup',
      'http://device:80/deleteShade',
      'http://device:80/linkToGroup',
      'http://device:80/unlinkFromGroup',
    ]);
    expect(seen.every((r) => r.method === 'PUT')).toBe(true);
  });

  // Die Firmware liest den Rumpf als JsonArray — ein Objekt würde still nichts bewirken.
  test('SortOrder schickt ein nacktes Array', async () => {
    const { endpoints, seen } = makeEndpoints(() => ok({ status: 'OK', desc: 'Successfully set' }));
    await endpoints.shadeSortOrder([3, 1, 2]);
    await endpoints.roomSortOrder([2, 1]);
    await endpoints.groupSortOrder([1]);
    expect(seen.map((r) => r.body)).toEqual([[3, 1, 2], [2, 1], [1]]);
    expect(seen.map((r) => r.url)).toEqual([
      'http://device:80/shadeSortOrder',
      'http://device:80/roomSortOrder',
      'http://device:80/groupSortOrder',
    ]);
  });
});

describe('Endpoints — Fehlerfälle der Firmware', () => {
  // Eigenheit der *SortOrder-Routen: abgelehnt wird mit einem 2xx-Status.
  test('HTTP 201 mit status ERROR gilt als Fehler, nicht als Erfolg', async () => {
    const { endpoints } = makeEndpoints(() =>
      ok({ status: 'ERROR', desc: 'Invalid HTTP Method: ' }, 201)
    );
    await expect(endpoints.shadeSortOrder([1, 2])).rejects.toThrow(ApiError);
    await expect(endpoints.shadeSortOrder([1, 2])).rejects.toThrow('Invalid HTTP Method: ');
  });

  test('status SUCCESS und OK gelten als Erfolg', async () => {
    const { endpoints } = makeEndpoints(() => ok({ status: 'SUCCESS', desc: 'Room deleted.' }));
    await expect(endpoints.deleteRoom(2)).resolves.toBeDefined();
  });

  // /deleteShade weicht vom sonstigen 500er-Schema ab.
  test('HTTP 400 beim Löschen eines gruppierten Rollos trägt die Begründung', async () => {
    const { endpoints } = makeEndpoints(() =>
      ok(
        {
          status: 'ERROR',
          desc: 'This shade is a member of a group and cannot be deleted.',
        },
        400
      )
    );
    await expect(endpoints.deleteShade(3)).rejects.toMatchObject({
      status: 400,
      desc: 'This shade is a member of a group and cannot be deleted.',
    });
  });

  test('Nutzlast ohne status-Feld bleibt unangetastet', async () => {
    const { endpoints } = makeEndpoints(() => ok({ shadeId: 3, name: 'Küche', position: 40 }));
    await expect(endpoints.saveShade({ shadeId: 3, name: 'Küche' })).resolves.toEqual({
      shadeId: 3,
      name: 'Küche',
      position: 40,
    });
  });
});
