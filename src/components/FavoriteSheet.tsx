import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, ErrorNotice, Sheet, Slider } from '@/components/ui/index';
import { clearsFavorite, hasFavorite, isMoving, Shade, TiltType } from '@/models/index';
import { setFavoritePosition } from '@/store/service';
import { font, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

const SLIDER_WIDTH = 260;

interface Props {
  shade: Shade;
  onClose: () => void;
}

// Favoritenposition („My") setzen und löschen. Somfy kennt dafür nur einen Befehl —
// ob gesetzt oder gelöscht wird, ergibt sich daraus, wo das Rollo steht. Deshalb
// sagt die Schaltfläche vorher an, was passieren wird.
export function FavoriteSheet({ shade, onClose }: Props) {
  const { colors } = useTheme();
  const hasTilt = shade.tiltType !== TiltType.none && shade.tiltPosition !== undefined;
  const isTiltOnly = shade.tiltType === TiltType.tiltonly;

  // Startwert ist der gespeicherte Favorit, sonst der aktuelle Stand: „hier ist mein
  // Favorit" ist der häufigste Fall, und zum Löschen muss genau der Favoritenwert
  // einstellbar sein. Der Aufrufer rendert das Blatt nur im geöffneten Zustand —
  // beim erneuten Öffnen entsteht es neu und liest die Werte frisch.
  const [pos, setPos] = useState(() => (hasFavorite(shade.myPos) ? shade.myPos : shade.position));
  const [tilt, setTilt] = useState(() =>
    hasFavorite(shade.myTiltPos) ? shade.myTiltPos! : (shade.tiltPosition ?? 0)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Die Firmware löscht, wenn der gesendete Wert dem gespeicherten Favoriten
  // entspricht — bei Rollos mit Lamellen müssen dafür beide Achsen passen.
  const clears = clearsFavorite(shade, pos, hasTilt ? tilt : undefined);

  const moving = isMoving(shade);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await setFavoritePosition(shade.shadeId, pos, hasTilt ? tilt : undefined);
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
      title="Favoritenposition"
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
            label={clears ? 'Favorit löschen' : 'Favorit setzen'}
            variant={clears ? 'danger' : 'primary'}
            onPress={submit}
            busy={busy}
            disabled={moving}
            style={styles.footerButton}
          />
        </>
      }
    >
      <ErrorNotice error={error} />

      {!isTiltOnly && (
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.muted }]}>Position</Text>
          <Slider
            value={pos}
            onCommit={setPos}
            width={SLIDER_WIDTH}
            accessibilityLabel="Favoritenposition"
          />
          <View style={styles.scale}>
            <Text style={[styles.scaleText, { color: colors.muted }]}>offen</Text>
            <Text style={[styles.scaleText, { color: colors.muted }]}>geschlossen</Text>
          </View>
        </View>
      )}

      {hasTilt && (
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.muted }]}>Lamellen</Text>
          <Slider
            value={tilt}
            onCommit={setTilt}
            width={SLIDER_WIDTH}
            accessibilityLabel="Lamellen-Favoritenposition"
          />
        </View>
      )}

      <Text style={[styles.hint, { color: colors.body }]}>
        {clears
          ? 'Der gespeicherte Favorit wird gelöscht. Somfy nutzt dafür denselben Befehl wie zum Setzen — steht das Rollo bereits auf dem Favoriten, löscht der Befehl ihn.'
          : 'Steht das Rollo noch nicht auf dieser Position, fährt es zuerst dorthin. Danach ruckelt es kurz — dieses Zucken ist die Bestätigung des Motors und kein Fehler.'}
      </Text>

      {moving && (
        <Text style={[styles.warning, { color: colors.errorText }]}>
          Das Rollo fährt gerade. Der Favorit lässt sich erst im Stillstand ändern.
        </Text>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.xl, alignItems: 'center' },
  label: { ...type.label, marginBottom: spacing.s, alignSelf: 'flex-start' },
  scale: {
    width: SLIDER_WIDTH,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  scaleText: { ...type.label, fontSize: 11 },
  hint: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  warning: { fontFamily: font.medium, fontSize: 14, marginTop: spacing.m },
  footerButton: { flex: 1 },
});
