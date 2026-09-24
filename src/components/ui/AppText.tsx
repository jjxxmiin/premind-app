import type { PropsWithChildren } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { colors, typography } from '@/theme/tokens';

export type AppTextVariant = keyof typeof typography;
export type AppTextTone =
  | 'default'
  | 'soft'
  | 'muted'
  | 'faint'
  | 'inverse'
  | 'brand'
  | 'positive'
  | 'warning'
  | 'negative';

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  tone?: AppTextTone;
  align?: TextStyle['textAlign'];
  tabular?: boolean;
}

const toneStyles: Record<AppTextTone, TextStyle> = {
  default: { color: colors.text },
  soft: { color: colors.textSoft },
  muted: { color: colors.textMuted },
  faint: { color: colors.textFaint },
  inverse: { color: colors.textInverse },
  brand: { color: colors.brandText },
  positive: { color: colors.positiveStrong },
  warning: { color: colors.warningStrong },
  negative: { color: colors.negativeStrong },
};

/**
 * Korean wraps by character by default, so a line can break in the middle of a
 * word — "공개 기준이 / 에요". Every platform has its own opt-out and none of
 * them is the default, so all three are set here rather than remembered at
 * each call site.
 */
const koreanWordWrap = Platform.select({
  ios: { lineBreakStrategyIOS: 'hangul-word' as const },
  android: { textBreakStrategy: 'balanced' as const },
  // `word-break` is a CSS property React Native Web passes through; it is not
  // in RN's style types, which is why this one lives in `style` and not props.
  default: {},
});

const webWordWrap = Platform.OS === 'web'
  ? ({ overflowWrap: 'anywhere', wordBreak: 'keep-all' } as TextStyle)
  : null;

export function AppText({
  variant = 'body',
  tone = 'default',
  align,
  tabular = false,
  style,
  children,
  ...props
}: PropsWithChildren<AppTextProps>) {
  return (
    <Text
      {...koreanWordWrap}
      {...props}
      style={[
        typography[variant],
        toneStyles[tone],
        webWordWrap,
        align ? { textAlign: align } : null,
        tabular ? styles.tabular : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
