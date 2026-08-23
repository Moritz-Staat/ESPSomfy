import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { Credentials } from '@/api/auth';
import { Button, ErrorNotice, TextField } from '@/components/ui/index';
import { SecurityType } from '@/models/index';
import { useAppStore } from '@/store/appStore';
import { connectToController } from '@/store/service';
import { spacing, type } from '@/theme/index';
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
  const [error, setError] = useState<unknown>(null);

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
            setError(new Error('Dieses Gerät ist gesichert — bitte Zugangsdaten eingeben.'));
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
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const { colors } = useTheme();

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
      <TextField
        label="IP-Adresse des Controllers"
        value={host}
        onChangeText={setHost}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        placeholder="192.168.178.99"
      />
      {authType === SecurityType.PinEntry && (
        <TextField
          label="PIN"
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          keyboardType="number-pad"
        />
      )}
      {authType === SecurityType.Password && (
        <>
          <TextField
            label="Benutzername"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextField label="Passwort" value={password} onChangeText={setPassword} secureTextEntry />
        </>
      )}
      <ErrorNotice error={error} />
      <Button label="Verbinden" onPress={connect} busy={busy} block />
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
});
