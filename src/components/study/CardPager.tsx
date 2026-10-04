import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, IconButton } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { spacing } from '@/theme/tokens';

/**
 * The header over a card read one at a time (a document's 쪽 요약): a title,
 * "3 / 12" and two arrows. Swiping the panel turns it too — the screen's tab
 * swipe offers the gesture first (`useTabSwipe` `onSwipe`) — so the arrows
 * are for a mouse and for anyone who would rather tap.
 */
export interface CardPagerHeaderProps {
  index: number;
  count: number;
  /** What this card is: a 구간 heading, a page, a time range. */
  title?: string;
  onChange: (index: number) => void;
  testID?: string;
}

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
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  title: { flex: 1, minWidth: 0 },
  position: { fontVariant: ['tabular-nums'], marginRight: spacing.xs },
});
