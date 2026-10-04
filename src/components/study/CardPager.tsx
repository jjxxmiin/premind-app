import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedReveal, AppText, IconButton } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { spacing } from '@/theme/tokens';

/**
 * One card of 요약 or 대본 at a time (2026-10-04): a title, "3 / 12" and the
 * two arrows above it, the card below. Swiping the panel turns it too — the
 * screen's tab swipe offers the gesture here first (`useTabSwipe` `onSwipe`) —
 * so the arrows are for a mouse and for anyone who would rather tap.
 */
export function CardPager({
  children,
  index,
  ...header
}: CardPagerHeaderProps & { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <CardPagerHeader index={index} {...header} />
      {/* Keyed by card, so turning one replays a short slide-in. */}
      <AnimatedReveal distance={6} key={index}>
        {children}
      </AnimatedReveal>
    </View>
  );
}

export interface CardPagerHeaderProps {
  index: number;
  count: number;
  /** What this card is: a 구간 heading, a page, a time range. */
  title?: string;
  onChange: (index: number) => void;
  testID?: string;
}

/**
 * The header alone, for a card whose rows report their own positions (the
 * 대본 follows playback by them) and so must not sit inside another wrapper.
 */
export function CardPagerHeader({ index, count, title, onChange, testID }: CardPagerHeaderProps) {
  const t = useT();
  return (
    <View style={styles.head} testID={testID}>
      <AppText numberOfLines={1} style={styles.title} variant="heading">
        {title ?? ''}
      </AppText>
      <AppText
        accessibilityLiveRegion="polite"
        style={styles.position}
        testID={testID ? `${testID}-position` : undefined}
        tone="muted"
        variant="meta"
      >
        {t('{i} / {n}', { i: index + 1, n: count })}
      </AppText>
      <IconButton
        disabled={index <= 0}
        icon={ChevronLeft}
        label={t('이전 카드')}
        onPress={() => onChange(index - 1)}
        size="small"
        variant="soft"
      />
      <IconButton
        disabled={index >= count - 1}
        icon={ChevronRight}
        label={t('다음 카드')}
        onPress={() => onChange(index + 1)}
        size="small"
        variant="soft"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  title: { flex: 1, minWidth: 0 },
  position: { fontVariant: ['tabular-nums'], marginRight: spacing.xs },
});
