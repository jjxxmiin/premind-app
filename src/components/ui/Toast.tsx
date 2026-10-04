import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { useScreenOverlay } from './Screen';

/** How long a toast stays before it fades out of the tree. */
const TOAST_MS = 1_800;

export interface ToastProps {
  /** Null hides it. Setting a new message restarts the timer. */
  message: string | null;
  /** Distance from the bottom of the screen, above whatever bar sits there. */
  bottom?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A short confirmation of something that just happened.
 *
 * For actions whose only other feedback is an icon changing state (saving a
 * material, copying text): without a word the tap reads as if it missed. It
 * never asks anything, so it is not a dialog and cannot be dismissed; it is
 * inert to touch so it can sit over content.
 */
export function Toast({ message, bottom = spacing.xxxl, style }: ToastProps) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { bottomInsetHandled, dockHeight } = useScreenOverlay();
  const clearance = Math.max(
    bottom,
    dockHeight > 0 ? dockHeight + spacing.md : 0,
  ) + (bottomInsetHandled ? 0 : bottomInset);
  if (!message) return null;
  return (
    <KeyboardAvoidingView
      accessibilityLiveRegion="polite"
      behavior={Platform.OS === 'web' ? undefined : 'position'}
      keyboardVerticalOffset={spacing.md}
      pointerEvents="none"
      style={[styles.positioner, { bottom: clearance }]}
    >
      <View style={[styles.toast, style]}>
        <AppText align="center" tone="inverse" variant="label">
          {message}
        </AppText>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * The message a `Toast` shows, and the one call that sets it. Clears itself,
 * and on unmount, so a screen never has to own the timer.
 */
export function useToast(): {
  message: string | null;
  show: (message: string) => void;
} {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback((next: string) => {
    setMessage(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  return { message, show };
}

const styles = StyleSheet.create({
  positioner: {
    alignSelf: 'center',
    maxWidth: '90%',
    position: 'absolute',
    zIndex: 1,
  },
  toast: {
    backgroundColor: colors.stage,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
});
