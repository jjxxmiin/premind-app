import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal as NativeModal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import { colors, radii, shadows, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button, type ButtonVariant } from './Button';

export interface DialogAction {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}

export interface DialogProps {
  visible: boolean;
  title: string;
  description?: string;
  /** Optional body rendered between the copy and the actions. */
  children?: ReactNode;
  /** The quiet left action. Omit for a single-button dialog. */
  cancel?: DialogAction;
  /** The confirming right action. Defaults to a filled ink button. */
  confirm: DialogAction;
  onRequestClose?: () => void;
  testID?: string;
}

/**
 * A centred confirmation. Two buttons at most; the destructive one is
 * still ink, not red — the copy carries the warning, the button carries the
 * decision.
 */
export function Dialog({
  visible,
  title,
  description,
  children,
  cancel,
  confirm,
  onRequestClose,
  testID,
}: DialogProps) {
  const close = onRequestClose ?? cancel?.onPress;

  return (
    <NativeModal
      animationType="fade"
      onRequestClose={close}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      {/* Edge-to-edge Android never resizes the window, so both platforms pad. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
        style={styles.overlay}
      >
        <Pressable {...decorative} onPress={close} style={styles.backdrop} />
        <View
          accessibilityLabel={title}
          accessibilityViewIsModal
          role={Platform.OS === 'web' ? undefined : 'dialog'}
          style={styles.card}
          testID={testID}
        >
          <View style={styles.copy}>
            <AppText accessibilityRole="header" align="center" variant="heading">
              {title}
            </AppText>
            {description ? (
              <AppText align="center" tone="muted" variant="meta">
                {description}
              </AppText>
            ) : null}
          </View>
          {children ? <View style={styles.body}>{children}</View> : null}
          <View style={styles.actions}>
            {cancel ? (
              <Button
                disabled={cancel.disabled}
                loading={cancel.loading}
                onPress={cancel.onPress}
                style={styles.action}
                variant={cancel.variant ?? 'secondary'}
              >
                {cancel.label}
              </Button>
            ) : null}
            <Button
              disabled={confirm.disabled}
              loading={confirm.loading}
              onPress={confirm.onPress}
              style={styles.action}
              variant={confirm.variant ?? 'primary'}
            >
              {confirm.label}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </NativeModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  backdrop: {
    backgroundColor: colors.overlay,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.modal,
    gap: spacing.lg,
    maxWidth: 360,
    padding: spacing.xl,
    width: '100%',
    ...shadows.floating,
  },
  copy: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  body: {
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
