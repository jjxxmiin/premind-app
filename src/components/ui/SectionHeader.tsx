import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import { colors, iconSizes, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  /** A custom trailing control. Prefer `actionLabel` + `onAction`. */
  action?: ReactNode;
  /** A quiet text link on the right, e.g. "전체 보기". */
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SectionHeader({
  title,
  description,
  action,
  actionLabel,
  onAction,
  style,
  testID,
}: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.copy}>
        <AppText accessibilityRole="header" variant="heading">
          {title}
        </AppText>
        {description ? (
          <AppText tone="muted" variant="meta">
            {description}
          </AppText>
        ) : null}
      </View>
      {action ? (
        <View style={styles.action}>{action}</View>
      ) : actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={`${title} ${actionLabel}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAction}
          style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
        >
          <AppText tone="muted" variant="label">
            {actionLabel}
          </AppText>
          <ChevronRight
            {...decorative}
            color={colors.textFaint}
            size={iconSizes.inline}
            strokeWidth={2}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 32,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  action: {
    flexShrink: 0,
  },
  link: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 2,
    minHeight: 32,
  },
  pressed: {
    opacity: 0.6,
  },
});
