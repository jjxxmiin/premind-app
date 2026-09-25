import { Image } from 'expo-image';
import { ChevronLeft, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLayout } from '@/lib/layout';
import { colors, sizes, spacing } from '@/theme/tokens';

import { AppText } from './ui/AppText';
import { IconButton } from './ui/IconButton';

export interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  /** Renders a close glyph instead of a back chevron (modals, flows). */
  onClose?: () => void;
  right?: ReactNode;
  /** Shows the wordmark on the left instead of a title. Tab roots only. */
  brand?: boolean;
  inverse?: boolean;
  /**
   * Titles are centred by default, like a native navigation bar. Tab roots
   * that carry the wordmark, and headers with a subtitle, align left.
   */
  align?: 'center' | 'left';
  /** Draws a hairline under the bar. For scrolling content that meets it. */
  divider?: boolean;
}

/**
 * The 56pt navigation bar. Back on the left, a centred title, and at most
 * two quiet icon actions on the right.
 */
export function AppHeader({
  title,
  subtitle,
  onBack,
  onClose,
  right,
  brand = false,
  inverse = false,
  align,
  divider = false,
}: AppHeaderProps) {
  const { breakpoint } = useLayout();
  // The sidebar already carries the wordmark on laptop and desktop windows.
  const showWordmark = brand && breakpoint !== 'expanded';
  const alignment = align ?? (brand || subtitle ? 'left' : 'center');
  const leading = onBack ? (
    <IconButton
      icon={ChevronLeft}
      iconSize={24}
      label="뒤로"
      onPress={onBack}
      variant={inverse ? 'inverse' : 'ghost'}
    />
  ) : onClose ? (
    <IconButton
      icon={X}
      iconSize={22}
      label="닫기"
      onPress={onClose}
      variant={inverse ? 'inverse' : 'ghost'}
    />
  ) : null;

  const copy = showWordmark ? (
    <Image
      accessibilityLabel="PREMIND"
      contentFit="contain"
      source={require('../../assets/brand/wordmark.png')}
      style={styles.wordmark}
    />
  ) : title ? (
    <View
      style={[
        styles.titleBlock,
        alignment === 'center' ? styles.titleBlockCentered : null,
      ]}
    >
      <AppText
        accessibilityRole="header"
        align={alignment}
        numberOfLines={1}
        tone={inverse ? 'inverse' : 'default'}
        variant="heading"
      >
        {title}
      </AppText>
      {subtitle ? (
        <AppText
          align={alignment}
          numberOfLines={1}
          style={inverse ? styles.inverseSubtitle : undefined}
          tone={inverse ? 'inverse' : 'muted'}
          variant="meta"
        >
          {subtitle}
        </AppText>
      ) : null}
    </View>
  ) : null;

  return (
    <View
      style={[
        styles.container,
        inverse ? styles.inverse : null,
        divider ? (inverse ? styles.inverseDivider : styles.divider) : null,
      ]}
    >
      {leading || alignment === 'center' ? (
        <View style={styles.side}>{leading}</View>
      ) : null}
      <View
        style={[
          styles.copy,
          alignment === 'center' ? styles.copyCentered : styles.copyLeading,
          !leading && alignment !== 'center' ? styles.copyFlush : null,
        ]}
      >
        {copy}
      </View>
      <View style={[styles.side, styles.rightSide]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flexDirection: 'row',
    minHeight: sizes.mobileHeader,
    paddingHorizontal: spacing.sm,
  },
  divider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inverse: {
    backgroundColor: colors.stage,
  },
  inverseDivider: {
    borderBottomColor: colors.stageBorder,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inverseSubtitle: {
    color: colors.stageMuted,
  },
  side: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing.xxs,
    minWidth: sizes.minimumTouchTarget,
  },
  rightSide: {
    justifyContent: 'flex-end',
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  copyCentered: {
    alignItems: 'center',
  },
  copyLeading: {
    paddingLeft: spacing.xs,
  },
  copyFlush: {
    // The bar has an 8pt inset; this brings a leading wordmark or title
    // onto the 20pt content gutter.
    paddingLeft: spacing.md,
  },
  titleBlock: {
    gap: 1,
    minWidth: 0,
  },
  titleBlockCentered: {
    alignItems: 'center',
  },
  wordmark: {
    height: 22,
    width: 92,
  },
});
