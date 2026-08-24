import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GroupMembersSheet } from '@/components/GroupMembersSheet';
import { NameSheet } from '@/components/NameSheet';
import { Button, ConfirmDialog, ErrorNotice } from '@/components/ui/index';
import { Group, LIMITS, Room, Shade } from '@/models/index';
import { useAppStore } from '@/store/appStore';
import {
  createGroup,
  createRoom,
  deleteGroup,
  deleteRoom,
  saveGroupSettings,
  saveRoomSettings,
} from '@/store/management';
import { compareGroups } from '@/store/selectors';
import { flat, font, radius, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

type Dialog =
  | { kind: 'addRoom' }
  | { kind: 'renameRoom'; room: Room }
  | { kind: 'deleteRoom'; room: Room }
  | { kind: 'addGroup' }
  | { kind: 'renameGroup'; group: Group }
  | { kind: 'deleteGroup'; group: Group }
  | { kind: 'members'; group: Group }
  | null;

export default function Settings() {
  const shadesById = useAppStore((s) => s.shadesById);
  const roomsById = useAppStore((s) => s.roomsById);
  const groupsById = useAppStore((s) => s.groupsById);
  const { colors } = useTheme();
  const router = useRouter();

  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const rooms = useMemo(
    () => (Object.values(roomsById) as Room[]).sort((a, b) => a.sortOrder - b.sortOrder),
    [roomsById]
  );
  const groups = useMemo(
    () => (Object.values(groupsById) as Group[]).sort(compareGroups),
    [groupsById]
  );
  const shades = useMemo(
    () => (Object.values(shadesById) as Shade[]).sort((a, b) => a.sortOrder - b.sortOrder),
    [shadesById]
  );

  const close = () => setDialog(null);

  const runDelete = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      close();
    } catch (err) {
      setError(err);
      close();
    } finally {
      setBusy(false);
    }
  };

  // Beim Löschen eines Raums setzt die Firmware die Zuordnung der betroffenen
  // Rollos zurück. Der Dialog nennt vorher, wie viele das sind.
  const affectedBy = (room: Room) =>
    shades.filter((shade) => shade.roomId === room.roomId).length;

  const roomsFull = rooms.length >= LIMITS.maxRooms;
  const groupsFull = groups.length >= LIMITS.maxGroups;

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <Stack.Screen options={{ title: 'Einstellungen' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ErrorNotice error={error} />

        <Text style={[styles.sectionHeader, { color: colors.ink }]}>Räume</Text>
        {rooms.length === 0 && (
          <Text style={[styles.empty, { color: colors.muted }]}>
            Noch kein Raum angelegt. Ohne Räume erscheinen alle Rollos unter „Ohne Raum“.
          </Text>
        )}
        {rooms.map((room) => (
          <View key={room.roomId} style={[styles.row, { backgroundColor: colors.surfaceCard }]}>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>{room.name}</Text>
              <Text style={[styles.rowMeta, { color: colors.body }]}>
                {affectedBy(room)} {affectedBy(room) === 1 ? 'Rollo' : 'Rollos'}
              </Text>
            </View>
            <View style={styles.rowActions}>
              <Button
                label="Umbenennen"
                variant="secondary"
                compact
                onPress={() => setDialog({ kind: 'renameRoom', room })}
              />
              <Button
                label="Löschen"
                variant="danger"
                compact
                onPress={() => setDialog({ kind: 'deleteRoom', room })}
              />
            </View>
          </View>
        ))}
        <Pressable
          onPress={() => setDialog({ kind: 'addRoom' })}
          disabled={roomsFull}
          accessibilityRole="button"
          style={styles.add}
        >
          <Text style={[styles.addText, { color: roomsFull ? colors.muted : colors.ink }]}>
            {roomsFull ? `Höchstzahl erreicht (${LIMITS.maxRooms} Räume)` : '+ Raum anlegen'}
          </Text>
        </Pressable>

        <Text style={[styles.sectionHeader, styles.secondSection, { color: colors.ink }]}>
          Gruppen
        </Text>
        {groups.length === 0 && (
          <Text style={[styles.empty, { color: colors.muted }]}>
            Noch keine Gruppe angelegt. Eine Gruppe erreicht alle ihre Motoren mit einem
            einzigen Funkbefehl.
          </Text>
        )}
        {groups.map((group) => (
          <View key={group.groupId} style={[styles.row, { backgroundColor: colors.surfaceCard }]}>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>{group.name}</Text>
              <Text style={[styles.rowMeta, { color: colors.body }]}>
                {group.shades.length} {group.shades.length === 1 ? 'Rollo' : 'Rollos'}
              </Text>
            </View>
            <View style={styles.rowActions}>
              <Button
                label="Mitglieder"
                variant="secondary"
                compact
                onPress={() => setDialog({ kind: 'members', group })}
              />
              <Button
                label="Umbenennen"
                variant="secondary"
                compact
                onPress={() => setDialog({ kind: 'renameGroup', group })}
              />
              <Button
                label="Löschen"
                variant="danger"
                compact
                onPress={() => setDialog({ kind: 'deleteGroup', group })}
              />
            </View>
          </View>
        ))}
        <Pressable
          onPress={() => setDialog({ kind: 'addGroup' })}
          disabled={groupsFull}
          accessibilityRole="button"
          style={styles.add}
        >
          <Text style={[styles.addText, { color: groupsFull ? colors.muted : colors.ink }]}>
            {groupsFull ? `Höchstzahl erreicht (${LIMITS.maxGroups} Gruppen)` : '+ Gruppe anlegen'}
          </Text>
        </Pressable>

        <Text style={[styles.sectionHeader, styles.secondSection, { color: colors.ink }]}>
          Reihenfolge
        </Text>
        <Text style={[styles.empty, { color: colors.muted }]}>
          Rollos, Räume und Gruppen lassen sich neu anordnen. Die Reihenfolge liegt im
          Gerät und gilt damit auch für das Web-UI.
        </Text>
        <Button
          label="Reihenfolge ändern"
          variant="secondary"
          onPress={() => router.push('/sort')}
        />
      </ScrollView>

      {dialog?.kind === 'addRoom' && (
        <NameSheet
          title="Raum anlegen"
          label="Name"
          confirmLabel="Anlegen"
          onSubmit={async (name) => {
            await createRoom(name);
          }}
          onClose={close}
        />
      )}
      {dialog?.kind === 'renameRoom' && (
        <NameSheet
          title="Raum umbenennen"
          label="Name"
          initialValue={dialog.room.name}
          confirmLabel="Speichern"
          onSubmit={(name) => saveRoomSettings(dialog.room.roomId, { name })}
          onClose={close}
        />
      )}
      {dialog?.kind === 'addGroup' && (
        <NameSheet
          title="Gruppe anlegen"
          label="Name"
          confirmLabel="Anlegen"
          hint={'Mitglieder lassen sich anschließend über „Mitglieder“ zuordnen.'}
          onSubmit={async (name) => {
            await createGroup(name);
          }}
          onClose={close}
        />
      )}
      {dialog?.kind === 'renameGroup' && (
        <NameSheet
          title="Gruppe umbenennen"
          label="Name"
          initialValue={dialog.group.name}
          confirmLabel="Speichern"
          onSubmit={(name) => saveGroupSettings(dialog.group.groupId, { name })}
          onClose={close}
        />
      )}
      {dialog?.kind === 'members' && (
        <GroupMembersSheet group={dialog.group} shades={shades} onClose={close} />
      )}

      <ConfirmDialog
        visible={dialog?.kind === 'deleteRoom'}
        title="Raum löschen?"
        message={
          dialog?.kind === 'deleteRoom'
            ? affectedBy(dialog.room) === 0
              ? `„${dialog.room.name}" wird entfernt. Diesem Raum ist kein Rollo zugeordnet.`
              : `„${dialog.room.name}" wird entfernt. ${affectedBy(dialog.room)} ${
                  affectedBy(dialog.room) === 1 ? 'Rollo wandert' : 'Rollos wandern'
                } danach unter „Ohne Raum" — die Rollos selbst bleiben erhalten.`
            : ''
        }
        busy={busy}
        onConfirm={() =>
          dialog?.kind === 'deleteRoom' && runDelete(() => deleteRoom(dialog.room.roomId))
        }
        onCancel={close}
      />

      <ConfirmDialog
        visible={dialog?.kind === 'deleteGroup'}
        title="Gruppe löschen?"
        message={
          dialog?.kind === 'deleteGroup'
            ? `„${dialog.group.name}" wird entfernt. Die zugeordneten Rollos bleiben erhalten und lassen sich weiter einzeln steuern.`
            : ''
        }
        busy={busy}
        onConfirm={() =>
          dialog?.kind === 'deleteGroup' && runDelete(() => deleteGroup(dialog.group.groupId))
        }
        onCancel={close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.l, paddingBottom: spacing.xxxl },
  sectionHeader: { ...type.roomHeader, marginBottom: spacing.m },
  secondSection: { marginTop: spacing.xxl },
  empty: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginBottom: spacing.m },
  row: {
    ...flat,
    borderRadius: radius.lg,
    padding: spacing.l,
    marginBottom: spacing.s,
  },
  rowInfo: { marginBottom: spacing.m },
  rowTitle: type.shadeName,
  rowMeta: { ...type.positionValue, fontSize: 13, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: spacing.s, flexWrap: 'wrap' },
  add: { paddingVertical: spacing.m },
  addText: { fontFamily: font.medium, fontSize: 15 },
});
