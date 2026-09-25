import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { inputReset } from '@/theme/input-reset';
import { colors, fontFamilies, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export interface TextAreaProps extends Omit<TextInputProps, 'style' | 'multiline'> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Visible height before the field scrolls. */
  minHeight?: number;
}

/**
 * The multi-line sibling of `AuthField`: same caption, shell and focus ink,
 * for text longer than a line (a cover letter, a question, a note).
 */
export function TextArea({ label, hint, error, minHeight = 120, editable = true, onBlur, onFocus, ...props }: TextAreaProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.group}>
      <AppText tone="soft" variant="meta">
        {label}
      </AppText>
      <TextInput
        {...props}
        accessibilityLabel={label}
        editable={editable}
        multiline
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.brand}
        style={[
          styles.input,
          inputReset,
          { minHeight },
          focused ? styles.focused : null,
          error ? styles.invalid : null,
          !editable ? styles.disabled : null,
        ]}
        textAlignVertical="top"
      />
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

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.input,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: 15,
    lineHeight: 22,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
  },
  focused: { borderColor: colors.text },
  invalid: { borderColor: colors.negative },
  disabled: { backgroundColor: colors.backgroundSoft, borderColor: colors.border },
});
