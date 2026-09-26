import { Highlighter, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, IconButton, SectionHeader } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatSourcePosition } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { SentenceSource } from '@/lib/highlights';
import { colors, iconSizes, radii, sizes, spacing } from '@/theme/tokens';

export interface HighlightListProps {
  /** The painted sentences, already in reading order. */
  painted: readonly SentenceSource[];
  /** Plays the lecture from the moment a painted sentence was said. */
  onSeek: (timestampMs: number) => void;
  /** Wipes one stroke. */
  onClear: (sentence: string) => void;
  /** Positions are page numbers: the material is an uploaded document. */
  page?: boolean;
  testID?: string;
}

/**
 * 형광펜 — every sentence the learner painted, in reading order, with the
 * moment it was said.
 *
 * This is what makes painting worth doing: the strokes come back as one short
 * revision list, each row playable and each row wipeable. With nothing
 * painted it renders nothing.
 */
export function HighlightList({
  painted,
  onSeek,
  onClear,
  page = false,
  testID,
}: HighlightListProps) {
  const t = useT();
  // Nothing painted, nothing shown (2026-09-26 declutter): the how-to card
  // that sat here was a tip on a screen that already had too many words.
  if (painted.length === 0) return null;
  return (
    <View style={styles.block} testID={testID}>
      <SectionHeader title={t('형광펜')} />
      <Card padding={false}>
        {painted.map((item, index) => (
          <View
            key={`${index}-${item.sentence}`}
            style={[
              styles.row,
              index < painted.length - 1 ? styles.divider : null,
            ]}
          >
            {/* Two controls side by side rather than one inside the other:
                a button nested in a button is invalid on the web build. */}
            <Pressable
              accessibilityHint={
                item.startMs === null
                  ? undefined
                  : page
                    ? t('그 쪽으로 이동해요.')
                    : t('그 시점부터 재생해요.')
              }
              accessibilityLabel={item.sentence}
              accessibilityRole={item.startMs === null ? 'text' : 'button'}
              disabled={item.startMs === null}
              onPress={() => item.startMs !== null && onSeek(item.startMs)}
              style={({ pressed }) => [
                styles.body,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.mark}>
                <Highlighter
                  {...decorative}
                  color={colors.brand}
                  size={iconSizes.dense}
                  strokeWidth={2}
                />
                {item.startMs === null ? null : (
                  <AppText tabular tone="brand" variant="meta">
                    {formatSourcePosition(item.startMs, page)}
                  </AppText>
                )}
              </View>
              <AppText style={styles.sentence} variant="body">
                {item.sentence}
              </AppText>
            </Pressable>
            <IconButton
              icon={X}
              label={t('형광펜 지우기')}
              onPress={() => onClear(item.sentence)}
            />
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Section title → its content: 12. */
  block: { gap: spacing.md },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    paddingLeft: spacing.gutter,
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
  },
  /** The tappable half of the row: the stroke, when it was said, what it says. */
  body: {
    flex: 1,
    gap: spacing.xs,
    minHeight: sizes.minimumTouchTarget,
    minWidth: 0,
    paddingVertical: spacing.xxs,
  },
  mark: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.brandSoft,
    borderRadius: radii.chip,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  sentence: { minWidth: 0 },
  /** Nothing painted yet: one quiet line saying what the pen is for. */
  divider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.7 },
});
