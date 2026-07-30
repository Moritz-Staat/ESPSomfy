import { configureApi, getApi, login } from '@/api/index';
import { hasFavorite, Shade, SomfyCommand } from '@/models/index';
import { bindAppState, SomfySocket } from '@/socket/index';

import { useAppStore } from './appStore';
import { dispatchSocketFrame } from './socketBridge';

let socket: SomfySocket | null = null;
let unbindAppState: (() => void) | null = null;

// Verbindet die App mit einem Controller: API konfigurieren, Login (liefert auch
// bei authType 0 einen Token), Hydration über /discovery, dann Socket starten.
export async function connectToController(host: string): Promise<void> {
  const { endpoints } = configureApi(`http://${host}:8081`);
  const { auth } = getApi();
  await login(`http://${host}:8081`, auth);
  const discovery = await endpoints.getDiscovery();
  const store = useAppStore.getState();
  store.setHost(host);
  store.hydrate(discovery);

  disconnect();
  socket = new SomfySocket({
    host,
    onFrame: dispatchSocketFrame,
    onStatus: (status) => useAppStore.getState().setConnectionStatus(status),
    // Während einer Trennung gingen Events verloren → einmal komplett neu laden.
    onResync: () => {
      endpoints
        .getDiscovery()
        .then((d) => useAppStore.getState().hydrate(d))
        .catch(() => {});
    },
    // Polling-Fallback: alle 10 s GET /shades, solange der Socket nicht lebt.
    onPollTick: () => {
      endpoints
        .getShades()
        .then((shades) => useAppStore.getState().replaceShades(shades))
        .catch(() => {});
    },
  });
  socket.start();
  unbindAppState = bindAppState(socket);
}

export function disconnect(): void {
  unbindAppState?.();
  unbindAppState = null;
  socket?.stop();
  socket = null;
}

export function getSocket(): SomfySocket | null {
  return socket;
}

// Kommando mit Optimistic Update: direction/target sofort lokal setzen,
// Rollback übernimmt der Store, falls binnen 3 s kein shadeState bestätigt.
export async function sendShadeCommand(shadeId: number, command: SomfyCommand): Promise<void> {
  const store = useAppStore.getState();
  const shade = store.shadesById[shadeId];
  if (shade) store.applyOptimistic(shadeId, predictCommandEffect(shade, command));
  // Schlägt das Kommando fehl, bestätigt der Socket nichts und der Rollback greift.
  await getApi().endpoints.shadeCommand({ shadeId, command });
}

export async function sendShadeTarget(shadeId: number, target: number): Promise<void> {
  const store = useAppStore.getState();
  const shade = store.shadesById[shadeId];
  if (shade) {
    store.applyOptimistic(shadeId, {
      target,
      direction: Math.sign(target - shade.position),
    });
  }
  await getApi().endpoints.shadeCommand({ shadeId, target });
}

// Erwartete Wirkung eines Befehls (Positionslogik: 0 = offen/oben, 100 = geschlossen).
export function predictCommandEffect(
  shade: Shade,
  command: SomfyCommand
): Partial<Pick<Shade, 'direction' | 'target'>> {
  switch (command) {
    case 'Up':
      return { direction: -1, target: 0 };
    case 'Down':
      return { direction: 1, target: 100 };
    case 'My':
      // Doppelbelegung: während der Fahrt Stopp, im Stillstand Fahrt zum Favoriten.
      if (shade.direction !== 0) return { direction: 0 };
      if (hasFavorite(shade.myPos)) {
        return { direction: Math.sign(shade.myPos - shade.position), target: shade.myPos };
      }
      return {};
    default:
      return {};
  }
}
