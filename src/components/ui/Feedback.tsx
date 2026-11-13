import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, TextInputInstance, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';
import { radius, typography } from '../../theme/tokens';
import { Button } from './Button';
import { elevation } from './elevation';
import { Txt } from './Txt';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PromptOptions {
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  keyboardType?: 'default' | 'url';
}

interface FeedbackContextValue {
  /** Message bref en bas d'écran. */
  toast(message: string): void;
  confirm(options: ConfirmOptions): Promise<boolean>;
  /** Demande une saisie ; renvoie `null` si l'utilisateur annule. */
  prompt(options: PromptOptions): Promise<string | null>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

type DialogState =
  | { kind: 'confirm'; options: ConfirmOptions; resolve(value: boolean): void }
  | { kind: 'prompt'; options: PromptOptions; resolve(value: string | null): void };

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [text, setText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptInput = useRef<TextInputInstance>(null);

  // `autoFocus` est peu fiable dans une fenêtre modale (Android) : on donne le focus une fois le dialogue affiché.
  const promptOpen = dialog?.kind === 'prompt';
  useEffect(() => {
    if (!promptOpen) return;
    // Deuxième tentative : une feuille modale en cours de fermeture peut reprendre le focus.
    const timers = [150, 500].map((delay) =>
      setTimeout(() => {
        if (!promptInput.current?.isFocused()) promptInput.current?.focus();
      }, delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [promptOpen]);

  const toast = useCallback(
    (message: string) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToastMessage(message);
      Animated.timing(toastOpacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToastMessage(null));
      }, 2600);
    },
    [toastOpacity],
  );

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ kind: 'confirm', options, resolve })),
    [],
  );

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setText(options.initialValue ?? '');
        setDialog({ kind: 'prompt', options, resolve });
      }),
    [],
  );

  const close = (accepted: boolean) => {
    if (!dialog) return;
    if (dialog.kind === 'confirm') dialog.resolve(accepted);
    else dialog.resolve(accepted ? text : null);
    setDialog(null);
  };

  const value = useMemo(() => ({ toast, confirm, prompt }), [toast, confirm, prompt]);
  const options = dialog?.options;

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {toastMessage ? (
        <Animated.View pointerEvents="none" style={[styles.toastWrap, { bottom: insets.bottom + 96, opacity: toastOpacity }]}>
          <View style={[styles.toast, { backgroundColor: colors.inverseSurface }, elevation(3)]}>
            <Txt variant="bodySmall" color={colors.inverseOnSurface} style={{ fontWeight: '500' }}>
              {toastMessage}
            </Txt>
          </View>
        </Animated.View>
      ) : null}

      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent navigationBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.dialogRoot}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={() => close(false)} accessibilityLabel="Annuler" />
          {options ? (
            <View style={[styles.dialog, { backgroundColor: colors.surfaceHigh }, elevation(4)]} accessibilityViewIsModal>
              <Txt variant="titleLarge">{options.title}</Txt>
              {options.message ? (
                <Txt variant="body" muted style={{ marginTop: 10 }}>
                  {options.message}
                </Txt>
              ) : null}
              {dialog?.kind === 'prompt' ? (
                <TextInput
                  value={text}
                  ref={promptInput}
                  onChangeText={setText}
                  selectTextOnFocus
                  placeholder={dialog.options.placeholder}
                  placeholderTextColor={colors.outline}
                  keyboardType={dialog.options.keyboardType === 'url' ? 'url' : 'default'}
                  autoCapitalize={dialog.options.keyboardType === 'url' ? 'none' : 'sentences'}
                  autoCorrect={dialog.options.keyboardType !== 'url'}
                  returnKeyType="done"
                  onSubmitEditing={() => close(true)}
                  style={[styles.input, typography.body, { color: colors.onSurface, borderColor: colors.primary, backgroundColor: colors.surfaceLowest }]}
                />
              ) : null}
              <View style={styles.actions}>
                <Button variant="text" label={(dialog?.kind === 'confirm' && dialog.options.cancelLabel) || 'Annuler'} onPress={() => close(false)} compact />
                <Button
                  variant={dialog?.kind === 'confirm' && dialog.options.destructive ? 'danger' : 'filled'}
                  label={options.confirmLabel ?? 'OK'}
                  onPress={() => close(true)}
                  disabled={dialog?.kind === 'prompt' && text.trim() === ''}
                  compact
                />
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback doit être utilisé dans FeedbackProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md, maxWidth: 480 },
  dialogRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 400, borderRadius: 28, padding: 24 },
  input: { marginTop: 18, outlineWidth: 0, borderWidth: 2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 22 },
});
