import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui';
import { formatSourcePosition } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/theme/tokens';
import type { OutlineSection, TranscriptSegment } from '@/types';

/** One line of the 대본 list: a spoken segment, or the chapter break above it. */
export type TranscriptRow =
  | { kind: 'section'; key: string; section: OutlineSection }
  | { kind: 'segment'; key: string; segment: TranscriptSegment };

/**
 * Lays the 요약 sections into the transcript at the moment each one starts.
 *
 * Placement is by timestamp, never by matching words, so it holds however the
 * model wrote the headings. A section is dropped when the list on screen has
 * no line inside it — a search or the 중요만 filter can leave a chapter with
 * nothing under it, and a heading over someone else's words reads as a lie.
 * When several sections would land on the same line, only the last one shows:
 * that is the chapter the line is actually in.
 */
export function withSectionMarkers(
  segments: readonly TranscriptSegment[],
  sections: readonly OutlineSection[],
): TranscriptRow[] {
  const ordered = [...sections].sort((a, b) => a.startMs - b.startMs);
  const rows: TranscriptRow[] = [];
  let next = 0;
  for (const segment of segments) {
    let pending: OutlineSection | undefined;
    for (
      let candidate = ordered[next];
      candidate && candidate.startMs < segment.endMs;
      candidate = ordered[next]
    ) {
      pending = candidate;
      next += 1;
    }
    if (pending) {
      rows.push({
        kind: 'section',
        key: `section-${pending.startMs}`,
        section: pending,
      });
    }
    rows.push({ kind: 'segment', key: segment.id, segment });
  }
  return rows;
}

export interface TranscriptSectionMarkerProps {
  section: OutlineSection;
  onPress: () => void;
  /** Read the position as a page number: the material is a document. */
  page?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A chapter break inside the 대본: a quiet band the width of the list, the
 * heading in small ink type, the moment it starts on the right. It is not a
 * card and it carries no controls — a long transcript just needs to say where
 * one part ends and the next begins. Pressing it opens that section in 요약.
 */
export function TranscriptSectionMarker({
  section,
  onPress,
  page = false,
  style,
  testID,
}: TranscriptSectionMarkerProps) {
  const t = useT();
  const position = formatSourcePosition(section.startMs, page);
  return (
    <Pressable
      accessibilityHint={t('요약 자세히에서 이 구간을 열어요.')}
      accessibilityLabel={t('구간 {heading}, {pos}', { heading: section.heading, pos: position })}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        style,
        pressed ? styles.pressed : null,
      ]}
      testID={testID}
    >
      <AppText numberOfLines={2} style={styles.heading} variant="badge">
        {section.heading}
      </AppText>
      <AppText tabular tone="faint" variant="badge">
        {position}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * The 20pt gutter line the transcript rows sit on, with 8 of air above and
   * below: enough for the band to read as a break, not enough for a card.
   */
  row: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm,
  },
  heading: { flex: 1, minWidth: 0 },
  pressed: { backgroundColor: colors.backgroundMuted },
});
