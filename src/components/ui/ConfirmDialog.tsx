import { Modal, StyleSheet, Text, View } from 'react-native';

import { flat, font, radius, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

import { Button } from './Button';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Färbt die Bestätigung rot — für alles, was Daten entfernt. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Eigener Dialog statt Alert.alert: Die Systemabfrage bricht optisch aus dem
// Clay-System aus, und ein blockierender Dialog kostet die Kontrolle über den
// Fehlerfall (die Firmware lehnt manche Löschung ab, siehe deleteShade).
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Löschen',
  cancelLabel = 'Abbrechen',
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.dialog, { backgroundColor: colors.canvas }]}>
          <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.body }]}>{message}</Text>
          <View style={styles.actions}>
            <Button
              label={cancelLabel}
              variant="secondary"
              onPress={onCancel}
              disabled={busy}
              style={styles.action}
            />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              busy={busy}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  dialog: {
    ...flat,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  title: { ...type.shadeName, fontSize: 20, marginBottom: spacing.s },
  message: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.xl },
  action: { flex: 1 },
});
