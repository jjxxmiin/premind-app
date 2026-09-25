import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { HighlightableText } from '@/components/study/HighlightableText';
import { TimeChip } from '@/components/study/TimeChip';
import { AppText, Card } from '@/components/ui';
import { formatSourcePosition } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/theme/tokens';
import type { OutlineSection } from '@/types';

export interface SummaryOutlineProps {
  /** The server's sections, already in lecture order. */
  sections: readonly OutlineSection[];
  /** `studyNotes[materialId].highlights`. */
  highlights: readonly string[];
  onToggleHighlight: (sentence: string) => void;
  onSeek: (timestampMs: number) => void;
  /** Positions are page numbers: the material is an uploaded document. */
  page?: boolean;
  /**
   * Where a section sits inside this card, by its `startMs`. The 마인드팩
   * screen keeps these so a 구간 tapped in the 대본 can be scrolled to here.
   */
  onSectionLayout?: (startMs: number, y: number) => void;
}

/**
 * 자세히: the lecture written out section by section. Each section names the
 * moment it starts at, and the chip seeks there, so a paragraph that reads
 * oddly can be heard in one tap. A tap on a sentence paints it.
 */
export function SummaryOutline({
  sections,
  highlights,
  onToggleHighlight,
  onSeek,
  page = false,
  onSectionLayout,
}: SummaryOutlineProps) {
  const t = useT();
  if (!sections.length) {
    return null;
  }

  return (
    <Card padding={false} testID="summary-outline">
      {sections.map((section, index) => (
        <View
          key={`${section.startMs}-${section.heading}`}
          onLayout={(event: LayoutChangeEvent) =>
            onSectionLayout?.(section.startMs, event.nativeEvent.layout.y)
          }
          style={[
            styles.section,
            index < sections.length - 1 ? styles.divider : null,
          ]}
        >
          <View style={styles.head}>
            <TimeChip
              accessibilityLabel={
                page
                  ? t('{pos}으로 이동', { pos: formatSourcePosition(section.startMs, true) })
                  : t('{pos}부터 재생', { pos: formatSourcePosition(section.startMs, false) })
              }
              onPress={() => onSeek(section.startMs)}
              page={page}
              timestampMs={section.startMs}
            />
            <AppText accessibilityRole="header" style={styles.heading} variant="heading">
              {section.heading}
            </AppText>
          </View>
          <HighlightableText
            highlights={highlights}
            onToggle={onToggleHighlight}
            tapToPaint
            text={section.body}
            variant="body"
          />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  /** A content card's padding, and 12 from the section head to its prose. */
  section: { gap: spacing.md, padding: spacing.gutter },
  divider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  head: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  heading: { flex: 1, minWidth: 0 },
});
