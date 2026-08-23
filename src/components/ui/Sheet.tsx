import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { flat, radius, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

export interface SheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Zeile mit Aktionen am Fuß; bleibt beim Scrollen stehen. */
  footer?: ReactNode;
}

// Von unten einfahrendes Blatt als Träger für Eingaben. Bewusst kein eigener
// Screen: die Verwaltung setzt immer auf einem Kontext auf, der sichtbar bleiben soll.
export function Sheet({ visible, title, onClose, children, footer }: SheetProps) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        {/* Tippen neben dem Blatt schließt — Standarderwartung bei Bottom Sheets. */}
        <Pressable style={styles.backdropTouch} onPress={onClose} accessibilityLabel="Schließen" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.canvas }]}>
            <View style={[styles.grabber, { backgroundColor: colors.hairline }]} />
            <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            {footer && <View style={styles.footer}>{footer}</View>}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  sheet: {
    ...flat,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.m,
    paddingBottom: spacing.xxl,
    maxHeight: '85%',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.l,
  },
  title: { ...type.roomHeader, marginBottom: spacing.l },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: spacing.xs },
  footer: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.l },
});
