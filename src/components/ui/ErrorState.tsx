import { CircleAlert, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button, type ButtonVariant } from './Button';

export interface ErrorStateProps {
  title?: string;
  description: string;
  icon?: LucideIcon;
  artwork?: ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  retryVariant?: ButtonVariant;
  retryDisabled?: boolean;
  retryLoading?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ErrorState({
  title: titleProp,
  description,
  icon: Icon = CircleAlert,
  artwork,
  retryLabel: retryLabelProp,
  onRetry,
  retryVariant = 'primary',
  retryDisabled = false,
  retryLoading = false,
  compact = false,
  style,
  testID,
}: ErrorStateProps) {
  const t = useT();
  const title = titleProp ?? t('문제가 생겼어요');
  const retryLabel = retryLabelProp ?? t('다시 시도');
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
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
            color={colors.negative}
            size={iconSizes.state}
            strokeWidth={1.7}
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
      {onRetry ? (
        <Button
          disabled={retryDisabled}
          loading={retryLoading}
          onPress={onRetry}
          variant={retryVariant}
        >
          {retryLabel}
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
    paddingVertical: spacing.huge,
  },
  compact: {
    flexGrow: 0,
    paddingVertical: spacing.xl,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: colors.negativeSoft,
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
