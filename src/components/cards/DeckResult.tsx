import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, StatusBadge } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import type { SessionResult } from '@/lib/flashcards';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, radii, sizes, spacing } from '@/theme/tokens';

export interface DeckResultProps {
  result: SessionResult;
}

/**
 * The end of a pass: how many cards the learner knew, and how many are
 * waiting. The count is over the cards this pass actually showed, so it can
 * never claim more than the 마인드팩 had to give.
 */
export function DeckResult({ result }: DeckResultProps) {
  const t = useT();
  const clean = result.againCount === 0;

  return (
    <Card
      accessibilityLabel={result.headline}
      style={styles.card}
      testID="deck-result"
      variant="soft"
    >
      <StatusBadge
        label={clean ? t('다 외웠어요') : t('한 번 더')}
        tone={clean ? 'positive' : 'warning'}
      />
      <View style={styles.scoreLine}>
        <AppText tabular variant="display">
          {result.knownCount}
        </AppText>
        <AppText tone="muted" variant="bodyStrong">
          {`/ ${result.total}`}
        </AppText>
      </View>
      <AppText align="center" variant="itemTitle">
        {result.headline}
      </AppText>
      <AppText align="center" tone="muted" variant="meta">
        {clean
          ? t('오늘은 여기까지 해도 좋아요. 내일 한 번 더 보면 오래 남아요.')
          : t('다시 볼 카드가 {n}개 있어요. 이어서 복습해 보세요.', { n: result.againCount })}
      </AppText>
      {clean ? (
        <View style={styles.cleanIcon}>
          <Check
            {...decorative}
            color={colors.positive}
            size={iconSizes.section}
            strokeWidth={2.4}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreLine: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cleanIcon: {
    alignItems: 'center',
    backgroundColor: colors.positiveSoft,
    borderRadius: radii.full,
    height: sizes.iconButton,
    justifyContent: 'center',
    marginTop: spacing.xs,
    width: sizes.iconButton,
  },
});
