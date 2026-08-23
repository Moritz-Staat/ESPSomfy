import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ConfirmDialog, ErrorNotice, OptionList, TextField } from '@/components/ui/index';
import { LIMITS, Room, validateDuration, validateName } from '@/models/index';
import { useAppStore } from '@/store/appStore';
import { deleteShade, saveShadeSettings } from '@/store/management';
import { UNASSIGNED_ROOM_ID } from '@/store/selectors';
import { font, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

// Fahrzeiten in Millisekunden. Sie bestimmen, wie die Firmware die Position
// schätzt — falsche Werte verschieben jede Positionsanzeige.
const TIME_FIELDS = [
  { key: 'upTime', label: 'Fahrzeit hoch (ms)' },
  { key: 'downTime', label: 'Fahrzeit runter (ms)' },
  { key: 'tiltTime', label: 'Lamellenzeit (ms)' },
] as const;

export default function ShadeEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shadeId = Number(id);
  const shade = useAppStore((s) => s.shadesById[shadeId]);
  const roomsById = useAppStore((s) => s.roomsById);
  const router = useRouter();
  const { colors } = useTheme();

  const [name, setName] = useState(shade?.name ?? '');
  const [roomId, setRoomId] = useState(shade?.roomId ?? UNASSIGNED_ROOM_ID);
  const [times, setTimes] = useState<Record<string, string>>({
    upTime: String(shade?.upTime ?? ''),
    downTime: String(shade?.downTime ?? ''),
    tiltTime: String(shade?.tiltTime ?? ''),
  });
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!shade) {
    return (
      <View style={[styles.container, { backgroundColor: colors.canvas }]}>
        <Stack.Screen options={{ title: 'Rollo bearbeiten' }} />
        <Text style={[styles.empty, { color: colors.muted }]}>Rollo nicht gefunden.</Text>
      </View>
    );
  }

  const trimmed = name.trim();
  const nameError = validateName(name);
  const timeError = TIME_FIELDS.map(({ key }) => validateDuration(times[key])).find(Boolean) ?? null;

  const roomOptions = [
    { value: UNASSIGNED_ROOM_ID, label: 'Ohne Raum' },
    ...(Object.values(roomsById) as Room[])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((room) => ({ value: room.roomId, label: room.name })),
  ];

  const save = async () => {
    if (nameError || timeError) return;
    setBusy(true);
    setError(null);
    try {
      const patch: Parameters<typeof saveShadeSettings>[1] = { name: trimmed, roomId };
      for (const { key } of TIME_FIELDS) {
        if (times[key] !== '') patch[key] = Number(times[key]);
      }
      await saveShadeSettings(shadeId, patch);
      router.back();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteShade(shadeId);
      // Zurück auf das Dashboard — die Detailansicht zeigte sonst ins Leere.
      router.dismissTo('/dashboard');
    } catch (err) {
      // Häufigster Fall: HTTP 400, weil das Rollo in einer Gruppe ist.
      setError(err);
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Rollo bearbeiten' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorNotice error={error} />

        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          error={nameError}
          maxLength={LIMITS.maxNameLength}
          autoCapitalize="sentences"
        />

        <OptionList label="Raum" options={roomOptions} selected={roomId} onSelect={setRoomId} />

        <Pressable
          onPress={() => setAdvanced((open) => !open)}
          accessibilityRole="button"
          style={styles.advancedToggle}
        >
          <Text style={[styles.advancedToggleText, { color: colors.muted }]}>
            {advanced ? 'Fortgeschritten ausblenden' : 'Fortgeschritten anzeigen'}
          </Text>
        </Pressable>

        {advanced && (
          <View>
            <Text style={[styles.warning, { color: colors.errorText }]}>
              Die Fahrzeiten bestimmen, wie das Gerät die Position berechnet. Falsche Werte
              verfälschen jede Positionsanzeige. Nur ändern, wenn die angezeigte Position
              dauerhaft von der tatsächlichen abweicht.
            </Text>
            {TIME_FIELDS.map(({ key, label }) => (
              <TextField
                key={key}
                label={label}
                value={times[key]}
                onChangeText={(value) => setTimes((prev) => ({ ...prev, [key]: value }))}
                keyboardType="number-pad"
              />
            ))}
            {timeError && <Text style={[styles.warning, { color: colors.errorText }]}>{timeError}</Text>}
          </View>
        )}

        {/* Funkadresse, Rolling Code, verknüpfte Fernbedienungen und Radio-Einstellungen
            bleiben bewusst außen vor: ein falscher Rolling Code trennt die Verbindung
            zum Motor, und die Wiederherstellung verlangt den Prog-Knopf am Motor selbst. */}
        <Text style={[styles.note, { color: colors.muted }]}>
          Funkadresse, Rolling Code und verknüpfte Fernbedienungen lassen sich hier bewusst
          nicht ändern — ein falscher Wert trennt die Verbindung zum Motor und erfordert den
          Prog-Knopf am Motor. Diese Einstellungen bleiben der Web-Oberfläche des Geräts
          vorbehalten.
        </Text>

        <Button
          label="Speichern"
          onPress={save}
          busy={busy}
          disabled={nameError !== null || timeError !== null}
          block
          style={styles.save}
        />
        <Button
          label="Rollo löschen"
          variant="danger"
          onPress={() => setConfirmDelete(true)}
          disabled={busy}
          block
          style={styles.delete}
        />
      </ScrollView>

      <ConfirmDialog
        visible={confirmDelete}
        title="Rollo löschen?"
        message={`„${shade.name}" wird vom Gerät entfernt. Der Motor selbst behält seine Programmierung — das Rollo lässt sich später erneut anlernen.`}
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  empty: { textAlign: 'center', fontFamily: font.regular, marginTop: spacing.xxxl },
  advancedToggle: { paddingVertical: spacing.s, marginBottom: spacing.m },
  advancedToggleText: type.label,
  warning: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, marginBottom: spacing.l },
  note: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, marginTop: spacing.m },
  save: { marginTop: spacing.xl },
  delete: { marginTop: spacing.m },
});
