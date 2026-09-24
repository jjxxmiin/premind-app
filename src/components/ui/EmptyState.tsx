import { Inbox, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button, type ButtonVariant } from './Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  artwork?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: Exclude<ButtonVariant, 'danger'>;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** A quiet centred state: a line icon, one title, one sentence, one action. */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  artwork,
  actionLabel,
  onAction,
  actionVariant = 'primary',
  compact = false,
  style,
  testID,
}: EmptyStateProps) {
  return (
    <View
      accessibilityLabel={`${title}. ${description}`}
      style={[styles.container, compact ? styles.compact : null, style]}
      testID={testID}
    >
      {artwork ? (
        <View {...decorative} style={styles.artwork}>
          {artwork}
        </View>
      ) : (
        <View style={styles.iconContainer}>
          <Icon
            {...decorative}
            color={colors.textFaint}
            size={iconSizes.state}
            strokeWidth={1.6}
          />
        </View>
      )}
      <View style={styles.copy}>
        <AppText accessibilityRole="header" align="center" variant="itemTitle">
          {title}
        </AppText>
        <AppText align="center" tone="muted" variant="meta">
          {description}
        </AppText>
      </View>
      {actionLabel && onAction ? (
        <Button onPress={onAction} size="medium" variant={actionVariant}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexGrow: 1,
    gap: spacing.gutter,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: spacing.xl,
    // Centred in a full-height container the block lands at about 52% down,
    // which leaves the whole upper half of a phone screen blank and reads as
    // a screen that failed to load rather than one with nothing in it. The
    // heavier bottom padding lifts it to roughly the upper third, where the
    // eye already is. `compact` overrides this: inside a card there is no
    // spare height to give away.
    paddingTop: spacing.huge,
    paddingBottom: spacing.massive * 3,
  },
  compact: {
    flexGrow: 0,
    paddingBottom: spacing.xl,
    paddingTop: spacing.xl,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.full,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  artwork: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    minHeight: 120,
    width: 160,
  },
  copy: {
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 320,
    minWidth: 0,
    width: '100%',
  },
});
