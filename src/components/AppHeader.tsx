import { ChevronLeft, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { colors, sizes, spacing } from '@/theme/tokens';

import { AppText } from './ui/AppText';
import { IconButton } from './ui/IconButton';
import { Wordmark } from './ui/Wordmark';

export interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  /** Renders a close glyph instead of a back chevron (modals, flows). */
  onClose?: () => void;
  right?: ReactNode;
  /** Shows the wordmark on the left instead of a title. The home tab only. */
  brand?: boolean;
  /**
   * A tab root's page name (복습, 연습, MY): left-aligned at page-title size,
   * so each tab says where you are instead of repeating the wordmark.
   */
  large?: boolean;
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
  large = false,
  inverse = false,
  align,
  divider = false,
}: AppHeaderProps) {
  const t = useT();
  const { breakpoint } = useLayout();
  // The sidebar already carries the wordmark on laptop and desktop windows.
  const showWordmark = brand && breakpoint !== 'expanded';
  const alignment = align ?? (brand || large || subtitle ? 'left' : 'center');
  const leading = onBack ? (
    <IconButton
      icon={ChevronLeft}
      iconSize={24}
      label={t('뒤로')}
      onPress={onBack}
      variant={inverse ? 'stage' : 'ghost'}
    />
  ) : onClose ? (
    <IconButton
      icon={X}
      iconSize={22}
      label={t('닫기')}
      onPress={onClose}
      variant={inverse ? 'stage' : 'ghost'}
    />
  ) : null;

  const copy = showWordmark ? (
    <Wordmark inverse={inverse} width={92} />
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
        // Two lines for a long 자료 title (2026-10-04 QA: a title cut with "…"
        // could not be read in full anywhere). A tab name or a titled
        // subtitle pair stays on one.
        numberOfLines={large || subtitle ? 1 : 2}
        tone={inverse ? 'inverse' : 'default'}
        variant={large ? 'pageTitle' : 'heading'}
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
    // 화면 바탕을 따른다(회색 바탕 + 흰 카드 화면에서 머리가 흰 띠로 떠 보이던 것, 2026-09-26).
    backgroundColor: 'transparent',
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
});
