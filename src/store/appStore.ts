import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  DiscoveryResponse,
  Group,
  GroupPatch,
  MemoryStatus,
  Room,
  RoomPatch,
  SecurityType,
  Shade,
  ShadePatch,
  WifiStrengthEvent,
} from '@/models/index';
import { ConnectionStatus } from '@/socket/connection';

export interface DeviceInfo {
  serverId: string;
  version: string;
  model: string;
  hostname: string;
  authType: SecurityType;
  permissions: number;
  memory?: MemoryStatus;
  wifi?: WifiStrengthEvent;
}

// Felder, die optimistisch vorweggenommen werden dürfen — Fahrt wie Tilt.
export type OptimisticFields = Pick<
  Shade,
  'direction' | 'position' | 'target' | 'tiltDirection' | 'tiltPosition' | 'tiltTarget'
>;

interface PendingRollback {
  timer: ReturnType<typeof setTimeout>;
  snapshot: Partial<OptimisticFields>;
}

// Rollback-Timer leben außerhalb des States (nicht serialisierbar, nicht renderrelevant).
const pendingRollbacks = new Map<number, PendingRollback>();

export const OPTIMISTIC_ROLLBACK_MS = 3000;

export interface AppState {
  shadesById: Record<number, Shade>;
  groupsById: Record<number, Group>;
  roomsById: Record<number, Room>;
  device: DeviceInfo | null;
  host: string | null;
  connectionStatus: ConnectionStatus;
  hydrated: boolean;

  setHost(host: string | null): void;
  setConnectionStatus(status: ConnectionStatus): void;
  hydrate(discovery: DiscoveryResponse): void;
  replaceShades(shades: Shade[]): void;

  applyShadeState(patch: ShadePatch): void;
  removeShade(shadeId: number): void;
  applyGroupState(patch: GroupPatch): void;
  removeGroup(groupId: number): void;
  applyRoomState(patch: RoomPatch): void;
  removeRoom(roomId: number): void;
  /** Hebt die Raumzuordnung von Rollos und Gruppen auf (nach dem Löschen eines Raums). */
  clearRoomAssignment(roomId: number): void;
  /** Setzt sortOrder in Listenreihenfolge — die SortOrder-Routen senden keine Events. */
  applySortOrder(kind: 'shades' | 'rooms' | 'groups', ids: number[]): void;
  setMemory(memory: MemoryStatus): void;
  setWifi(wifi: WifiStrengthEvent): void;

  // Optimistic Update: die geänderten Felder sofort lokal setzen; kommt binnen 3 s
  // kein bestätigendes shadeState, wird der Schnappschuss zurückgerollt. Socket-Events
  // gewinnen während einer Bewegung immer (applyShadeState räumt den Rollback ab).
  applyOptimistic(shadeId: number, change: Partial<OptimisticFields>): void;
}

function mergeById<T, P extends Partial<T>>(
  map: Record<number, T>,
  id: number,
  patch: P
): Record<number, T> {
  const existing = map[id];
  // Merge-Regel: nur die im Event enthaltenen Felder überschreiben, nie das ganze
  // Objekt ersetzen. Explizit auf undefined gesetzte Schlüssel (z. B. fehlende
  // Tilt-Felder) dürfen vorhandene Werte nicht auslöschen.
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) cleaned[key] = value;
  }
  return { ...map, [id]: { ...(existing ?? {}), ...cleaned } as T };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      shadesById: {},
      groupsById: {},
      roomsById: {},
      device: null,
      host: null,
      connectionStatus: 'offline',
      hydrated: false,

      setHost: (host) => set({ host }),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

      hydrate: (discovery) => {
        for (const pending of pendingRollbacks.values()) clearTimeout(pending.timer);
        pendingRollbacks.clear();
        set({
          shadesById: Object.fromEntries(discovery.shades.map((s) => [s.shadeId, s])),
          groupsById: Object.fromEntries(discovery.groups.map((g) => [g.groupId, g])),
          roomsById: Object.fromEntries(discovery.rooms.map((r) => [r.roomId, r])),
          device: {
            serverId: discovery.serverId,
            version: discovery.version,
            model: discovery.model,
            hostname: discovery.hostname,
            authType: discovery.authType,
            permissions: discovery.permissions,
            memory: discovery.memory,
            wifi: get().device?.wifi,
          },
          hydrated: true,
        });
      },

      // Für den Polling-Fallback (GET /shades liefert volle Objekte).
      replaceShades: (shades) =>
        set((state) => {
          let map = state.shadesById;
          for (const shade of shades) map = mergeById(map, shade.shadeId, shade);
          return { shadesById: map };
        }),

      applyShadeState: (patch) => {
        // Bestätigung vom Gerät: ein offener Optimistic-Rollback ist damit hinfällig.
        const pending = pendingRollbacks.get(patch.shadeId);
        if (pending) {
          clearTimeout(pending.timer);
          pendingRollbacks.delete(patch.shadeId);
        }
        set((state) => ({ shadesById: mergeById(state.shadesById, patch.shadeId, patch) }));
      },

      removeShade: (shadeId) =>
        set((state) => {
          const { [shadeId]: _removed, ...rest } = state.shadesById;
          return { shadesById: rest };
        }),

      applyGroupState: (patch) =>
        set((state) => ({ groupsById: mergeById(state.groupsById, patch.groupId, patch) })),

      removeGroup: (groupId) =>
        set((state) => {
          const { [groupId]: _removed, ...rest } = state.groupsById;
          return { groupsById: rest };
        }),

      applyRoomState: (patch) =>
        set((state) => ({ roomsById: mergeById(state.roomsById, patch.roomId, patch) })),

      removeRoom: (roomId) =>
        set((state) => {
          const { [roomId]: _removed, ...rest } = state.roomsById;
          return { roomsById: rest };
        }),

      // Die Firmware setzt beim Löschen eines Raums die roomId der betroffenen
      // Rollos und Gruppen zurück und schickt dafür Events. Läuft der Socket
      // gerade nicht, zieht die App denselben Schritt lokal nach — das Ergebnis
      // ist dasselbe, die Events sind damit unschädlich.
      clearRoomAssignment: (roomId) =>
        set((state) => {
          const shadesById = { ...state.shadesById };
          for (const shade of Object.values(shadesById)) {
            if (shade.roomId === roomId) shadesById[shade.shadeId] = { ...shade, roomId: 0 };
          }
          const groupsById = { ...state.groupsById };
          for (const group of Object.values(groupsById)) {
            if (group.roomId === roomId) groupsById[group.groupId] = { ...group, roomId: 0 };
          }
          return { shadesById, groupsById };
        }),

      // Die *SortOrder-Routen der Firmware setzen sortOrder nur im RAM, ohne
      // emitState — es kommt also kein Event zurück, das die App übernehmen könnte.
      applySortOrder: (kind, ids) =>
        set((state) => {
          if (kind === 'rooms') {
            const roomsById = { ...state.roomsById };
            ids.forEach((id, index) => {
              const room = roomsById[id];
              if (room) roomsById[id] = { ...room, sortOrder: index };
            });
            return { roomsById };
          }
          if (kind === 'groups') {
            const groupsById = { ...state.groupsById };
            ids.forEach((id, index) => {
              const group = groupsById[id];
              if (group) groupsById[id] = { ...group, sortOrder: index };
            });
            return { groupsById };
          }
          const shadesById = { ...state.shadesById };
          ids.forEach((id, index) => {
            const shade = shadesById[id];
            if (shade) shadesById[id] = { ...shade, sortOrder: index };
          });
          return { shadesById };
        }),

      setMemory: (memory) =>
        set((state) => (state.device ? { device: { ...state.device, memory } } : {})),

      setWifi: (wifi) =>
        set((state) => (state.device ? { device: { ...state.device, wifi } } : {})),

      applyOptimistic: (shadeId, change) => {
        const shade = get().shadesById[shadeId];
        if (!shade) return;
        const existing = pendingRollbacks.get(shadeId);
        if (existing) clearTimeout(existing.timer);
        // Nur die Felder sichern, die tatsächlich vorweggenommen werden — sonst
        // würde ein Tilt-Rollback eine zwischenzeitlich bestätigte Fahrposition
        // mit zurückdrehen. Bereits gesicherte Felder behalten ihren ersten Wert:
        // der Schnappschuss soll den Stand vor der ganzen Sequenz tragen.
        const fresh: Partial<OptimisticFields> = {};
        for (const key of Object.keys(change) as (keyof OptimisticFields)[]) {
          const value = shade[key];
          if (value !== undefined) fresh[key] = value as never;
        }
        const snapshot = { ...fresh, ...(existing?.snapshot ?? {}) };
        const timer = setTimeout(() => {
          pendingRollbacks.delete(shadeId);
          set((state) => ({ shadesById: mergeById(state.shadesById, shadeId, snapshot) }));
        }, OPTIMISTIC_ROLLBACK_MS);
        pendingRollbacks.set(shadeId, { timer, snapshot });
        set((state) => ({ shadesById: mergeById(state.shadesById, shadeId, change) }));
      },
    }),
    {
      name: 'espsomfy-app-state',
      storage: createJSONStorage(() => AsyncStorage),
      // Letzten Bestand persistieren, damit die App beim Start sofort etwas zeigt.
      // Verbindungsstatus und hydrated bleiben flüchtig.
      partialize: (state) => ({
        shadesById: state.shadesById,
        groupsById: state.groupsById,
        roomsById: state.roomsById,
        device: state.device,
        host: state.host,
      }),
    }
  )
);
