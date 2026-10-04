import { Maximize2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AnimatedReveal, AppText, Button, Card, EmptyState } from '@/components/ui';
import { pageNumberOf } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, spacing } from '@/theme/tokens';
import type { TranscriptSegment } from '@/types';

import { CardPagerHeader } from './CardPager';

/**
 * A document's 대본 tab, read like a book (2026-10-04, CEO): the page pinned
 * above and its summary here turn together — by the arrows, a swipe on this
 * panel, or a swipe on the pages. The full page text is no longer printed out
 * here: a 100-slide deck as one long script was slow and hard to read. A page
 * the server did not summarise (its own text was already short) shows that
 * text instead, and the page itself is one tap away full screen.
 */
export function DocumentPageSummary({
  segments,
  index,
  onChange,
  onOpenPage,
}: {
  segments: readonly TranscriptSegment[];
  /** Position in `segments` of the page on screen. */
  index: number;
  onChange: (index: number) => void;
  /** Opens the page full screen. Receives the page number, counting from 1. */
  onOpenPage: (page: number) => void;
}) {
  const t = useT();
  const segment = segments[index];
  if (!segment) {
    return (
      <EmptyState compact description={t('글자를 찾지 못한 문서예요.')} title={t('읽은 쪽이 없어요')} />
    );
  }
  const page = pageNumberOf(segment.startMs);
  const summary = segment.summary?.trim();
  return (
    <View style={styles.root}>
      <CardPagerHeader
        count={segments.length}
        index={index}
        onChange={onChange}
        testID="page-summary"
        title={t('{n}쪽', { n: page })}
      />
      <AnimatedReveal distance={6} key={segment.id}>
        <Card style={styles.card}>
          <AppText selectable variant="body">
            {summary || segment.text}
          </AppText>
          <Button
            leftIcon={<Maximize2 color={colors.textSoft} size={iconSizes.inline} />}
            onPress={() => onOpenPage(page)}
            size="small"
            style={styles.open}
            variant="ghost"
          >
            {t('이 쪽 크게 보기')}
          </Button>
        </Card>
      </AnimatedReveal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  card: { gap: spacing.md },
  open: { alignSelf: 'flex-start' },
});
