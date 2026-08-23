import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, ErrorNotice, Sheet, TextField } from '@/components/ui/index';
import { LIMITS, validateName } from '@/models/index';
import { font } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

interface Props {
  title: string;
  label: string;
  /** Vorbelegung; leer beim Anlegen. */
  initialValue?: string;
  confirmLabel: string;
  hint?: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}

// Ein Name, ein Knopf — für Räume und Gruppen, beim Anlegen wie beim Umbenennen.
// Der Aufrufer rendert das Blatt nur im geöffneten Zustand, damit die Vorbelegung
// bei jedem Öffnen frisch gelesen wird.
export function NameSheet({
  title,
  label,
  initialValue = '',
  confirmLabel,
  hint,
  onSubmit,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const [name, setName] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const nameError = validateName(name);

  const submit = async () => {
    if (nameError) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button
            label="Abbrechen"
            variant="secondary"
            onPress={onClose}
            disabled={busy}
            style={styles.footerButton}
          />
          <Button
            label={confirmLabel}
            onPress={submit}
            busy={busy}
            disabled={nameError !== null}
            style={styles.footerButton}
          />
        </>
      }
    >
      <ErrorNotice error={error} />
      <TextField
        label={label}
        value={name}
        onChangeText={setName}
        error={name.length > 0 ? nameError : null}
        maxLength={LIMITS.maxNameLength}
        autoCapitalize="sentences"
        autoFocus
      />
      {hint && <Text style={[styles.hint, { color: colors.body }]}>{hint}</Text>}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  footerButton: { flex: 1 },
});
