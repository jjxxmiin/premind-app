import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export interface AuthFormProps {
  onSubmit: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/** Native form grouping; the web implementation renders a semantic form. */
export function AuthForm({
  children,
  style,
}: PropsWithChildren<AuthFormProps>) {
  return <View style={style}>{children}</View>;
}
