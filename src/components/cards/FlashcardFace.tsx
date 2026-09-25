import { Headphones } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnimatedReveal, AppText, StatusBadge } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { HIGHLIGHT_PROMPT, type Flashcard } from '@/lib/flashcards';
import { formatSourcePosition } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, radii, sizes, spacing } from '@/theme/tokens';

export interface FlashcardFaceProps {
  card: Flashcard;
  /** False shows the cue, true shows what it means. */
  flipped: boolean;
  onFlip: () => void;
  /** Seeks the 대본 to the moment this card came from. */
  onSeek?: (sourceStartMs: number) => void;
  /** True for an uploaded document: positions are pages, and nothing plays. */
  page?: boolean;
}

const ORIGIN_LABEL: Record<Flashcard['origin'], string> = {
  concept: '개념',
  keyPoint: '핵심 내용',
  highlight: '형광펜',
};

/**
 * One card, filling the screen: a cue on the front, its meaning on the back,
 * and a tap anywhere in between.
 *
 * The card is the tap target rather than a small "뒤집기" button — at this
 * size the whole surface reads as the thing you are holding, and a learner
 * going through twelve of them should not have to aim.
 */
export function FlashcardFace({
  card,
  flipped,
  onFlip,
  onSeek,
  page = false,
}: FlashcardFaceProps) {
  const t = useT();
  const prompt = t(HIGHLIGHT_PROMPT);
  const seekAt = card.sourceStartMs;
  const seekLabel =
    seekAt === null
      ? null
      : page
        ? t('{at} 다시 보기', { at: formatSourcePosition(seekAt, page) })
        : t('{at} 다시 듣기', { at: formatSourcePosition(seekAt, page) });

  const showChip = flipped && seekAt !== null && seekLabel !== null && onSeek !== undefined;
  const cue =
    card.origin === 'highlight' ? `${prompt} ${card.front}` : card.front;

  return (
    <View style={styles.stack}>
      <Pressable
        accessibilityHint={flipped ? t('눌러서 앞면을 봐요') : t('눌러서 뜻을 봐요')}
        accessibilityLabel={flipped ? `${card.front}. ${card.back}` : cue}
        accessibilityRole="button"
        onPress={onFlip}
        style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
        testID="flashcard-face"
      >
        <View style={styles.badgeRow}>
          <StatusBadge label={t.ctx('card-origin', ORIGIN_LABEL[card.origin])} tone="neutral" />
        </View>

        <AnimatedReveal
          distance={6}
          key={`${card.id}-${flipped ? 'back' : 'front'}`}
          style={styles.body}
        >
          {flipped ? (
            <>
              <AppText align="center" numberOfLines={2} tone="muted" variant="itemTitle">
                {card.front}
              </AppText>
              <AppText align="center" variant="heading">
                {card.back}
              </AppText>
            </>
          ) : (
            <>
              {/* A painted sentence is longer than a term, so it is asked as a
                  question and set at reading size rather than at hero size. */}
              {card.origin === 'highlight' ? (
                <AppText align="center" tone="muted" variant="meta">
                  {prompt}
                </AppText>
              ) : null}
              <AppText
                align="center"
                variant={card.origin === 'highlight' ? 'heading' : 'heroTitle'}
              >
                {card.front}
              </AppText>
            </>
          )}
        </AnimatedReveal>

        <View style={styles.footer}>
          <AppText align="center" tone="faint" variant="badge">
            {flipped ? t('눌러서 앞면을 봐요') : t('눌러서 뜻을 봐요')}
          </AppText>
        </View>
      </Pressable>

      {/* Outside the card, not inside it: a tappable within a tappable is a
          button inside a button on the web build, and a screen reader would
          have to fight the flip to reach it. The seat is held open on a card
          that has a timestamp so flipping does not resize the card under the
          reader's thumb. */}
      {showChip && seekAt !== null && seekLabel !== null ? (
        <Pressable
          accessibilityHint={t('이 내용이 나온 시점부터 대본과 함께 재생해요')}
          accessibilityLabel={seekLabel}
          accessibilityRole="button"
          onPress={() => onSeek?.(seekAt)}
          style={({ pressed }) => [styles.chip, pressed ? styles.chipPressed : null]}
        >
          <Headphones
            {...decorative}
            color={colors.textSoft}
            size={iconSizes.dense}
            strokeWidth={1.9}
          />
          <AppText tabular tone="soft" variant="buttonSmall">
            {seekLabel}
          </AppText>
        </Pressable>
      ) : seekAt !== null ? (
        <View {...decorative} style={styles.chipSeat} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    alignItems: 'stretch',
    flex: 1,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'space-between',
    // The card never squeezes below this: a phone held sideways scrolls the
    // deck area instead of stacking the meaning on top of the hint.
    minHeight: 240,
    padding: spacing.gutter,
  },
  pressed: {
    backgroundColor: colors.backgroundSoft,
  },
  badgeRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  body: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    minWidth: 0,
  },
  footer: {
    alignItems: 'center',
    minHeight: sizes.badge,
  },
  chip: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.chip,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: sizes.chip,
    paddingHorizontal: spacing.md,
  },
  chipPressed: {
    backgroundColor: colors.backgroundMuted,
  },
  chipSeat: {
    height: sizes.chip,
  },
});
