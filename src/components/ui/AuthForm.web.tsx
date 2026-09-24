import type { CSSProperties, FormEvent, PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

import type { AuthFormProps } from './AuthForm';

/**
 * Real HTML form semantics let password managers associate email/password and
 * make Enter submit reliably. React Native Web otherwise renders only divs.
 */
export function AuthForm({
  accessibilityLabel,
  children,
  onSubmit,
  style,
}: PropsWithChildren<AuthFormProps>) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      aria-label={accessibilityLabel}
      noValidate
      onSubmit={submit}
      style={{
        ...(StyleSheet.flatten(style) as CSSProperties),
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
      }}
    >
      {children}
      <button
        aria-hidden="true"
        style={styles.hiddenSubmit}
        tabIndex={-1}
        type="submit"
      />
    </form>
  );
}

const styles: Record<string, CSSProperties> = {
  hiddenSubmit: {
    height: 1,
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    width: 1,
  },
};
