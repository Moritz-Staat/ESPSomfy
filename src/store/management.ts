import { getApi } from '@/api/index';
import { Group, Room, Shade } from '@/models/index';

import { useAppStore } from './appStore';

// Verwaltungsaktionen. Alle laufen über den Konfigurations-Client auf Port 80.
//
// Kein Optimistic Update wie bei den Fahrbefehlen: Die Antwort der Firmware ist
// bereits das vollständige Objekt, und sie kommt sofort — es gibt keine Fahrzeit
// zu überbrücken. Der Store übernimmt schlicht die Antwort; die Socket-Events
// (roomState, groupState, shadeState) tragen denselben Stand nach und sind damit
// unschädlich.

export async function saveShadeSettings(
  shadeId: number,
  patch: Partial<Shade>
): Promise<void> {
  const shade = await getApi().endpoints.saveShade({ ...patch, shadeId });
  useAppStore.getState().applyShadeState({ ...shade, shadeId });
}

export async function deleteShade(shadeId: number): Promise<void> {
  // Wirft ApiError mit HTTP 400, wenn das Rollo Mitglied einer Gruppe ist.
  await getApi().endpoints.deleteShade(shadeId);
  useAppStore.getState().removeShade(shadeId);
}

export async function createRoom(name: string): Promise<Room> {
  // sortOrder gleich mitgeben, sonst landen neue Räume alle auf 0 und die
  // Reihenfolge im Dashboard hängt von der Objektreihenfolge ab.
  const sortOrder = Object.keys(useAppStore.getState().roomsById).length;
  const room = await getApi().endpoints.addRoom({ name, sortOrder });
  useAppStore.getState().applyRoomState(room);
  return room;
}

export async function saveRoomSettings(roomId: number, patch: Partial<Room>): Promise<void> {
  const room = await getApi().endpoints.saveRoom({ ...patch, roomId });
  useAppStore.getState().applyRoomState({ ...room, roomId });
}

export async function deleteRoom(roomId: number): Promise<void> {
  await getApi().endpoints.deleteRoom(roomId);
  const store = useAppStore.getState();
  // Die Firmware hebt die Zuordnung der betroffenen Rollos und Gruppen selbst auf
  // und schickt dafür Events — hier nachgezogen, damit die Ansicht auch dann
  // stimmt, wenn der Socket gerade nicht lebt.
  store.clearRoomAssignment(roomId);
  store.removeRoom(roomId);
}

export async function createGroup(name: string): Promise<Group> {
  const sortOrder = Object.keys(useAppStore.getState().groupsById).length;
  const group = await getApi().endpoints.addGroup({ name, sortOrder });
  useAppStore.getState().applyGroupState(group);
  return group;
}

export async function saveGroupSettings(groupId: number, patch: Partial<Group>): Promise<void> {
  const group = await getApi().endpoints.saveGroup({ ...patch, groupId });
  useAppStore.getState().applyGroupState({ ...group, groupId });
}

export async function deleteGroup(groupId: number): Promise<void> {
  await getApi().endpoints.deleteGroup(groupId);
  useAppStore.getState().removeGroup(groupId);
}

export async function linkShadeToGroup(shadeId: number, groupId: number): Promise<void> {
  const group = await getApi().endpoints.linkToGroup({ shadeId, groupId });
  useAppStore.getState().applyGroupState({ ...group, groupId });
}

export async function unlinkShadeFromGroup(shadeId: number, groupId: number): Promise<void> {
  const group = await getApi().endpoints.unlinkFromGroup({ shadeId, groupId });
  useAppStore.getState().applyGroupState({ ...group, groupId });
}

// Die drei Sortierrouten senden KEINE Events zurück (die Handler setzen sortOrder
// ohne emitState). Die neue Reihenfolge muss die App deshalb selbst übernehmen.
export async function reorderShades(shadeIds: number[]): Promise<void> {
  await getApi().endpoints.shadeSortOrder(shadeIds);
  useAppStore.getState().applySortOrder('shades', shadeIds);
}

export async function reorderRooms(roomIds: number[]): Promise<void> {
  await getApi().endpoints.roomSortOrder(roomIds);
  useAppStore.getState().applySortOrder('rooms', roomIds);
}

export async function reorderGroups(groupIds: number[]): Promise<void> {
  await getApi().endpoints.groupSortOrder(groupIds);
  useAppStore.getState().applySortOrder('groups', groupIds);
}
