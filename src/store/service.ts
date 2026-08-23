import { configureApi, Credentials, getApi, login } from '@/api/index';
import { hasFavorite, Shade, SomfyCommand, TiltType } from '@/models/index';
import { bindAppState, SomfySocket } from '@/socket/index';

import { OptimisticFields, useAppStore } from './appStore';
import { dispatchSocketFrame } from './socketBridge';

let socket: SomfySocket | null = null;
let unbindAppState: (() => void) | null = null;

// Verbindet die App mit einem Controller: API konfigurieren, Login (liefert auch
// bei authType 0 einen Token), Hydration über /discovery, dann Socket starten.
export async function connectToController(host: string, credentials?: Credentials): Promise<void> {
  const { endpoints, client, auth } = configureApi(host);
  await login(client.getBaseUrl(), auth, credentials);
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

// Tilt ist eine eigene Achse mit eigenen Befehlen und eigenen Feldern. Die Firmware
// wertet in /tiltCommand ENTWEDER command ODER target aus (target nur, wenn kein
// command mitkommt) — beides zusammen zu schicken hieße, das Ziel zu verlieren.
export async function sendTiltTarget(shadeId: number, target: number): Promise<void> {
  const store = useAppStore.getState();
  const shade = store.shadesById[shadeId];
  if (shade && shade.tiltPosition !== undefined) {
    store.applyOptimistic(shadeId, {
      tiltTarget: target,
      tiltDirection: Math.sign(target - shade.tiltPosition),
    });
  }
  await getApi().endpoints.tiltCommand({ shadeId, target });
}

export async function sendTiltCommand(shadeId: number, command: SomfyCommand): Promise<void> {
  const store = useAppStore.getState();
  const shade = store.shadesById[shadeId];
  if (shade) store.applyOptimistic(shadeId, predictTiltEffect(shade, command));
  await getApi().endpoints.tiltCommand({ shadeId, command });
}

// Erwartete Wirkung eines Tilt-Befehls. Gleiche Semantik wie bei der Fahrt:
// 0 = offen, 100 = geschlossen; myTiltPos außerhalb 0–100 heißt „kein Favorit".
export function predictTiltEffect(
  shade: Shade,
  command: SomfyCommand
): Partial<Pick<Shade, 'tiltDirection' | 'tiltTarget'>> {
  switch (command) {
    case 'Up':
      return { tiltDirection: -1, tiltTarget: 0 };
    case 'Down':
      return { tiltDirection: 1, tiltTarget: 100 };
    case 'My': {
      if (shade.tiltDirection !== 0) return { tiltDirection: 0 };
      const position = shade.tiltPosition;
      if (hasFavorite(shade.myTiltPos) && position !== undefined) {
        return {
          tiltDirection: Math.sign(shade.myTiltPos! - position),
          tiltTarget: shade.myTiltPos,
        };
      }
      return {};
    }
    default:
      return {};
  }
}

// Erwartete Wirkung eines Befehls (Positionslogik: 0 = offen/oben, 100 = geschlossen).
// Bei tiltonly gibt es keine Fahrposition: die Firmware lenkt Up/Down/My dort intern
// auf das Tilt-Ziel um (Somfy.cpp, sendCommand). Die Vorhersage muss demselben Weg
// folgen, sonst rollt der Store nach 3 s die falschen Felder zurück.
export function predictCommandEffect(
  shade: Shade,
  command: SomfyCommand
): Partial<OptimisticFields> {
  if (shade.tiltType === TiltType.tiltonly) {
    return predictTiltEffect(shade, command);
  }
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
