import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { describeError } from './ErrorNotice';
import { flat, font, radius, spacing } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

export type ToastTone = 'error' | 'info';

export interface ToastApi {
  show(message: string, tone?: ToastTone): void;
  /** Fehler aus Client und Firmware über describeError verständlich machen. */
  showError(error: unknown): void;
  dismiss(): void;
}

// Fehler brauchen Lesezeit, Fortschrittsmeldungen dürfen schnell verschwinden.
const DURATION: Record<ToastTone, number> = { error: 6000, info: 3000 };

// Absichtlich funktionslose Vorbelegung statt eines Fehlers: Eine Karte, die in
// einem Test oder einer Vorschau ohne Provider gerendert wird, soll nicht daran
// scheitern, dass sie im Fehlerfall etwas melden möchte.
const noop: ToastApi = { show: () => {}, showError: () => {}, dismiss: () => {} };

const ToastContext = createContext<ToastApi>(noop);

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

interface ToastState {
  message: string;
  tone: ToastTone;
}

// Ein Toast zur Zeit, die neue Meldung ersetzt die alte. Eine Warteschlange wäre
// hier falsch: Wenn zwölf Rollos derselbe Fehler trifft, will niemand zwölf
// Meldungen nacheinander weglesen.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const api = useMemo<ToastApi>(() => {
    const show = (message: string, tone: ToastTone = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });
      timer.current = setTimeout(() => {
        timer.current = null;
        setToast(null);
      }, DURATION[tone]);
    };
    return {
      show,
      showError: (error: unknown) => show(describeError(error), 'error'),
      dismiss: () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        setToast(null);
      },
    };
  }, []);

  useEffect(() => clear, [clear]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <ToastBar message={toast.message} tone={toast.tone} onPress={api.dismiss} /> : null}
    </ToastContext.Provider>
  );
}

function ToastBar({
  message,
  tone,
  onPress,
}: {
  message: string;
  tone: ToastTone;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  // error/onError und action/onAction sind beide in der Kontrastsuite geprüft.
  const bg = tone === 'error' ? colors.error : colors.action;
  const fg = tone === 'error' ? colors.onError : colors.onAction;
  return (
    <View style={styles.host} pointerEvents="box-none">
      <Pressable
        style={[styles.bar, { backgroundColor: bg }]}
        onPress={onPress}
        accessibilityRole="alert"
        accessibilityLabel={message}
        accessibilityLiveRegion="polite"
      >
        <Text style={[styles.text, { color: fg }]}>{message}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Fester Abstand statt Safe-Area-Insets: Der Provider dafür hängt an der
    // Navigation, und der Toast soll auch außerhalb eines Screens funktionieren.
    bottom: spacing.xxl,
    paddingHorizontal: spacing.l,
    alignItems: 'stretch',
  },
  bar: {
    ...flat,
    borderRadius: radius.md,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
  },
  text: { fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
});
