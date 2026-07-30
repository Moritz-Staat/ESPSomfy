import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { Credentials } from '@/api/auth';
import { SecurityType } from '@/models/index';
import { useAppStore } from '@/store/appStore';
import { connectToController } from '@/store/service';
import { colors, spacing } from '@/theme/index';

// Verbindungs-Screen: IP manuell eingeben, Test gegen /discovery.
// mDNS kommt später. Bei authType != 0 werden PIN- bzw. Passwortfelder eingeblendet.
export default function ConnectScreen() {
  const router = useRouter();
  const storedHost = useAppStore((s) => s.host);
  const [host, setHost] = useState(storedHost ?? '192.168.178.99');
  const [authType, setAuthType] = useState<SecurityType>(SecurityType.None);
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      // authType vorab ohne Auth ermitteln — bei gesetzter Sicherung ohne
      // ConfigOnly-Bit antwortet /discovery mit 401, dann bleibt der letzte Wert.
      try {
        const res = await fetch(`http://${host}:8081/discovery`);
        if (res.ok) {
          const type = ((await res.json()) as { authType: SecurityType }).authType;
          setAuthType(type);
          if (type !== SecurityType.None && !pin && !username) {
            setError('Dieses Gerät ist gesichert — bitte Zugangsdaten eingeben.');
            return;
          }
        }
      } catch {
        // /discovery nicht lesbar → Login versucht es trotzdem.
      }
      let credentials: Credentials = {};
      if (authType === SecurityType.PinEntry) credentials = { pin };
      else if (authType === SecurityType.Password) credentials = { username, password };
      await connectToController(host.trim(), credentials);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Verbinden' }} />
      <Text style={styles.title}>ESPSomfy-RTS</Text>
      <Text style={styles.label}>IP-Adresse des Controllers</Text>
      <TextInput
        style={styles.input}
        value={host}
        onChangeText={setHost}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        placeholder="192.168.178.99"
      />
      {authType === SecurityType.PinEntry && (
        <>
          <Text style={styles.label}>PIN</Text>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
          />
        </>
      )}
      {authType === SecurityType.Password && (
        <>
          <Text style={styles.label}>Benutzername</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <Text style={styles.label}>Passwort</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={connect} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verbinden</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.m,
    fontSize: 16,
    marginBottom: spacing.l,
    color: colors.text,
  },
  error: { color: colors.danger, marginBottom: spacing.l },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.l,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
