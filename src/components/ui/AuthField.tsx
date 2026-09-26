import { useState, type ReactNode, type Ref } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { AppText } from './AppText';
import { inputReset } from '../../theme/input-reset';
import {
  colors,
  fontFamilies,
  radii,
  sizes,
  spacing,
} from '../../theme/tokens';

export interface AuthFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  inputRef?: Ref<TextInput>;
  /** Rendered inside the field's shell — a reveal-password button, usually. */
  trailing?: ReactNode;
  /** Shown under the field. Field-level rules belong here, not in a banner. */
  hint?: string;
  /**
   * Replaces the hint and reddens the field. A message about one field belongs
   * under that field: a banner at the top of a four-field form makes the reader
   * hunt for which input it meant.
   */
  error?: string | null;
}

/**
 * The labelled text field every form shares: a small caption above a 48pt
 * bordered shell, ink when focused, red with a message when invalid.
 */
export function AuthField({
  label,
  inputRef,
  trailing,
  hint,
  error,
  editable = true,
  onBlur,
  onFocus,
  ...props
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldGroup}>
      <AppText tone="soft" variant="meta">
        {label}
      </AppText>
      <View
        style={[
          styles.inputShell,
          focused ? styles.inputShellFocused : null,
          focused && Platform.OS === 'web' ? webFocusRing : null,
          error ? styles.inputShellInvalid : null,
          !editable ? styles.inputShellDisabled : null,
        ]}
      >
        <TextInput
          {...props}
          accessibilityLabel={label}
          editable={editable}
          accessibilityHint={error ?? undefined}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={colors.textFaint}
          ref={inputRef}
          selectionColor={colors.brand}
          style={[styles.input, inputReset, webFieldInput]}
        />
        {trailing}
      </View>
      {error ? (
        <AppText accessibilityRole="alert" tone="negative" variant="badge">
          {error}
        </AppText>
      ) : hint ? (
        <AppText tone="faint" variant="badge">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * On the web the shell draws the focus: an ink border plus a soft brand ring.
 * The browser's own outline on the inner input would sit inside the shell as a
 * second, offset rectangle (it did, on the search screen), so it is dropped
 * only here, where the shell's ring replaces it.
 */
const webFocusRing =
  Platform.OS === 'web'
    ? ({ boxShadow: `0 0 0 3px ${colors.focusRing}` } as unknown as object)
    : null;
const webFieldInput =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as object) : null;

const styles = StyleSheet.create({
  fieldGroup: {
    gap: spacing.sm,
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.input,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: sizes.input,
    paddingLeft: 14,
    paddingRight: spacing.xs,
  },
  inputShellFocused: {
    borderColor: colors.text,
  },
  inputShellInvalid: {
    borderColor: colors.negative,
  },
  inputShellDisabled: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 15,
    minHeight: sizes.input - 2,
    // RN Web otherwise keeps TextInput's browser intrinsic width. With the
    // password reveal button present that width is wider than a 320px card,
    // and focusing the field scrolls the whole shell sideways.
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});
