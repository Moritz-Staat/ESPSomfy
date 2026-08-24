import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getApi, isApiConfigured } from '@/api/index';
import { RssiChart } from '@/components/RssiChart';
import { Button, ConfirmDialog, ErrorNotice } from '@/components/ui/index';
import {
  formatBytes,
  fragmentation,
  heapLevel,
  HEAP_CRITICAL_BYTES,
  HEAP_WARN_BYTES,
  SIGNAL_LABELS,
  signalLevel,
  updateAvailable,
} from '@/models/index';
import { useAppStore } from '@/store/appStore';
import { downloadBackup, openWebUi, rebootDevice, webUiUrl } from '@/store/diagnostics';
import { flat, font, radius, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.body }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.ink }]} selectable>
        {value}
      </Text>
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceCard }]}>
      <Text style={[styles.cardTitle, { color: colors.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function Diagnostics() {
  const device = useAppStore((s) => s.device);
  const host = useAppStore((s) => s.host);
  const wifiHistory = useAppStore((s) => s.wifiHistory);
  const hydrate = useAppStore((s) => s.hydrate);
  const { colors } = useTheme();

  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<'backup' | 'reboot' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmReboot, setConfirmReboot] = useState(false);

  // Version, latest und der Heap-Stand kommen aus /discovery. memStatus-Events
  // sendet die Firmware nur bei größeren Sprüngen — ohne dieses Nachladen zeigte
  // der Screen den Stand vom letzten Verbinden.
  useEffect(() => {
    if (!isApiConfigured()) return;
    let cancelled = false;
    getApi()
      .endpoints.getDiscovery()
      .then((discovery) => {
        if (!cancelled) hydrate(discovery);
      })
      .catch(() => {
        // Kein Fehlerkasten: Der Screen zeigt dann eben den zuletzt bekannten Stand.
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  if (!device) {
    return (
      <View style={[styles.container, { backgroundColor: colors.canvas }]}>
        <Stack.Screen options={{ title: 'Diagnose' }} />
        <Text style={[styles.empty, { color: colors.muted }]}>
          Noch keine Gerätedaten. Erst verbinden.
        </Text>
      </View>
    );
  }

  const memory = device.memory;
  const level = memory ? heapLevel(memory.free) : 'ok';
  const heapColor =
    level === 'critical' ? colors.error : level === 'warn' ? colors.warning : colors.success;
  const ethernet = device.connType === 'Ethernet';
  const wifi = device.wifi;

  const run = async (kind: 'backup' | 'reboot', action: () => Promise<string | null>) => {
    setBusy(kind);
    setError(null);
    setNote(null);
    try {
      setNote(await action());
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <Stack.Screen options={{ title: 'Diagnose' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ErrorNotice error={error} />
        {note && <Text style={[styles.note, { color: colors.body }]}>{note}</Text>}

        <Card title="Gerät">
          <Row label="Hostname" value={device.hostname} />
          <Row label="Adresse" value={host ?? '—'} />
          <Row label="Modell" value={device.model} />
          <Row label="Chip" value={device.chipModel || 'nicht gemeldet'} />
          <Row label="Verbindung" value={ethernet ? 'Ethernet' : 'WLAN'} />
          <Row label="Server-Id" value={device.serverId} />
          <Row label="Firmware" value={device.version} />
        </Card>

        <Card title="Firmware-Aktualisierung">
          {updateAvailable(device) ? (
            <>
              <Text style={[styles.body, { color: colors.ink }]}>
                Version {device.latest} ist verfügbar (installiert: {device.version}).
              </Text>
              <Text style={[styles.body, { color: colors.body }]}>
                Das Einspielen läuft bewusst nur über das Web-UI: Ein Update, das
                unterwegs abbricht, kann das Gerät unbrauchbar machen — dafür sollte man
                am selben Netz und in Reichweite sein.
              </Text>
            </>
          ) : (
            <Text style={[styles.body, { color: colors.body }]}>
              {device.checkForUpdate
                ? `Die Firmware ist aktuell (${device.version}).`
                : 'Die Update-Prüfung ist am Gerät abgeschaltet — ob eine neuere Version vorliegt, weiß die App nicht.'}
            </Text>
          )}
          <Button label="Web-UI öffnen" variant="secondary" onPress={openWebUi} />
          <Text style={[styles.hint, { color: colors.muted }]}>{webUiUrl()}</Text>
        </Card>

        <Card title="Arbeitsspeicher">
          {memory ? (
            <>
              <View style={[styles.gaugeTrack, { backgroundColor: colors.surfaceStrong }]}>
                <View
                  style={[
                    styles.gaugeFill,
                    {
                      width: `${Math.max(2, Math.min(100, (memory.free / memory.total) * 100))}%`,
                      backgroundColor: heapColor,
                    },
                  ]}
                />
              </View>
              <Row
                label="Frei"
                value={`${formatBytes(memory.free)} von ${formatBytes(memory.total)}`}
              />
              <Row label="Größter Block" value={formatBytes(memory.max)} />
              <Row label="Tiefstand seit Start" value={formatBytes(memory.min)} />
              <Row label="Fragmentierung" value={`${Math.round(fragmentation(memory) * 100)} %`} />
              {level !== 'ok' && (
                <Text style={[styles.body, { color: colors.errorText }]}>
                  {level === 'critical'
                    ? `Unter ${formatBytes(HEAP_CRITICAL_BYTES)} freiem Speicher startet der ESP32 erfahrungsgemäß von selbst neu. Weniger Socket-Clients gleichzeitig verbinden, sonst hilft nur ein Neustart.`
                    : `Unter ${formatBytes(HEAP_WARN_BYTES)} wird es eng. Im Auge behalten — fällt der Wert weiter, wird das Gerät instabil.`}
                </Text>
              )}
            </>
          ) : (
            <Text style={[styles.body, { color: colors.body }]}>
              Noch keine Speichermeldung empfangen.
            </Text>
          )}
        </Card>

        {ethernet ? (
          <Card title="Ethernet">
            <Row
              label="Status"
              value={device.ethernet?.connected ? 'Verbunden' : 'Nicht verbunden'}
            />
            <Row label="Geschwindigkeit" value={`${device.ethernet?.speed ?? 0} Mbit/s`} />
            <Row label="Duplex" value={device.ethernet?.fullduplex ? 'Vollduplex' : 'Halbduplex'} />
          </Card>
        ) : (
          <Card title="WLAN">
            <Row label="Netz" value={wifi?.ssid || 'unbekannt'} />
            <Row label="Kanal" value={wifi ? String(wifi.channel) : '—'} />
            <Row
              label="Signal"
              value={
                wifi ? `${wifi.strength} dBm · ${SIGNAL_LABELS[signalLevel(wifi.strength)]}` : '—'
              }
            />
            <View style={styles.chart}>
              <RssiChart history={wifiHistory} />
            </View>
          </Card>
        )}

        <Card title="Sicherung und Neustart">
          <Text style={[styles.body, { color: colors.body }]}>
            Die Sicherung enthält Rollos, Räume, Gruppen und die Funkadressen. Das
            Zurückspielen bietet die App bewusst nicht an: Es ersetzt die gesamte
            Konfiguration und startet das Gerät neu — das gehört vor das Gerät, nicht
            auf ein Handy unterwegs. Dafür ist das Web-UI da.
          </Text>
          <Button
            label="Sicherung herunterladen"
            variant="secondary"
            busy={busy === 'backup'}
            onPress={() =>
              run('backup', async () => {
                const result = await downloadBackup();
                return result.shared
                  ? null
                  : `Gespeichert als ${result.filename} — diese Plattform bietet kein Teilen-Menü an.`;
              })
            }
          />
          <Button
            label="Gerät neu starten"
            variant="danger"
            busy={busy === 'reboot'}
            onPress={() => setConfirmReboot(true)}
          />
        </Card>
      </ScrollView>

      <ConfirmDialog
        visible={confirmReboot}
        title="Gerät neu starten?"
        message="Der Controller ist etwa eine halbe Minute nicht erreichbar. Laufende Fahrten brechen ab; die Rollos selbst bleiben, wo sie sind."
        busy={busy === 'reboot'}
        onConfirm={() => {
          setConfirmReboot(false);
          run('reboot', async () => {
            await rebootDevice();
            return 'Neustart angestoßen. Die App verbindet sich von selbst wieder, sobald das Gerät antwortet.';
          });
        }}
        onCancel={() => setConfirmReboot(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.l, paddingBottom: spacing.xxxl },
  empty: { fontFamily: font.regular, fontSize: 15, padding: spacing.l },
  note: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginBottom: spacing.m },
  card: {
    ...flat,
    borderRadius: radius.lg,
    padding: spacing.l,
    marginBottom: spacing.m,
    gap: spacing.s,
  },
  cardTitle: { ...type.roomHeader, fontSize: 18, marginBottom: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.m },
  rowLabel: { fontFamily: font.regular, fontSize: 14 },
  rowValue: { fontFamily: font.medium, fontSize: 14, flexShrink: 1, textAlign: 'right' },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  hint: { fontFamily: font.regular, fontSize: 12 },
  gaugeTrack: { height: 10, borderRadius: radius.xs, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: radius.xs },
  chart: { marginTop: spacing.s },
});
