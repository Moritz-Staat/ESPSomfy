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
import { flat, font, radius, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

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

  const { colors } = useTheme();
  const labelStyle = [styles.label, { color: colors.muted }];
  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surfaceSoft,
      borderColor: colors.hairline,
      color: colors.ink,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Verbinden', headerShown: false }} />
      <Text style={[styles.title, { color: colors.ink }]}>ESPSomfy-RTS</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Rollos steuern im lokalen Netzwerk
      </Text>
      <Text style={labelStyle}>IP-Adresse des Controllers</Text>
      <TextInput
        style={inputStyle}
        value={host}
        onChangeText={setHost}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        placeholder="192.168.178.99"
        placeholderTextColor={colors.muted}
      />
      {authType === SecurityType.PinEntry && (
        <>
          <Text style={labelStyle}>PIN</Text>
          <TextInput
            style={inputStyle}
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
          />
        </>
      )}
      {authType === SecurityType.Password && (
        <>
          <Text style={labelStyle}>Benutzername</Text>
          <TextInput
            style={inputStyle}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <Text style={labelStyle}>Passwort</Text>
          <TextInput
            style={inputStyle}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </>
      )}
      {error && <Text style={[styles.error, { color: colors.errorText }]}>{error}</Text>}
      <Pressable
        style={[styles.button, { backgroundColor: colors.action }, busy && styles.buttonDisabled]}
        onPress={connect}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.onAction} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.onAction }]}>Verbinden</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  title: {
    ...type.screenTitle,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...type.positionValue,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  label: { ...type.label, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.m,
    fontFamily: font.regular,
    fontSize: 16,
    marginBottom: spacing.l,
  },
  error: { fontFamily: font.regular, marginBottom: spacing.l },
  button: {
    ...flat,
    borderRadius: radius.md,
    padding: spacing.l,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: type.button,
});
