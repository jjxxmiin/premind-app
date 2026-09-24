import { Highlighter, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, IconButton, SectionHeader } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatSourcePosition } from '@/lib/format';
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
 * revision list, each row playable and each row wipeable. It is also where a
 * learner who has painted nothing finds out that a tap paints.
 */
export function HighlightList({
  painted,
  onSeek,
  onClear,
  page = false,
  testID,
}: HighlightListProps) {
  return (
    <View style={styles.block} testID={testID}>
      <SectionHeader
        description={
          painted.length
            ? `칠한 문장 ${painted.length}개예요. 누르면 그 부분을 들어요.`
            : undefined
        }
        title="형광펜"
      />
      {painted.length === 0 ? (
        <Card style={styles.empty} variant="soft">
          <Highlighter
            {...decorative}
            color={colors.textMuted}
            size={iconSizes.section}
            strokeWidth={1.9}
          />
          <AppText style={styles.emptyCopy} tone="muted" variant="meta">
            문장을 눌러 칠하면 여기에 모여요. 암기 카드로도 나와요.
          </AppText>
        </Card>
      ) : (
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
                      ? '그 쪽으로 이동해요.'
                      : '그 시점부터 재생해요.'
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
                label="형광펜 지우기"
                onPress={() => onClear(item.sentence)}
              />
            </View>
          ))}
        </Card>
      )}
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
  empty: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  emptyCopy: { flex: 1, minWidth: 0 },
  divider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.7 },
});
