import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, Card, StatusBadge } from '@/components/ui';
import type { AppTextTone } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, sizes, spacing } from '@/theme/tokens';
import type { LensHistoryEntry } from '@/types';

import { formatDelta } from './lens-charts';
import { formatEvaluatedAt, historyRows } from './lens-history';

export interface LensHistoryListProps {
  /** Newest first. */
  entries: readonly LensHistoryEntry[];
  /** The entry being shown; null for the newest. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Every evaluation of one recording: date, overall score, and the change
 * against the one before. Tapping a row shows that evaluation's report in
 * place of the current one; the row being viewed is tinted and checked.
 */
export function LensHistoryList({ entries, onSelect, selectedId, style }: LensHistoryListProps) {
  const t = useT();
  const rows = historyRows(entries, selectedId);
  return (
    <Card padding={false} style={style}>
      {rows.map((row, index) => {
        const when = formatEvaluatedAt(row.evaluatedAt, t.locale);
        const deltaText =
          row.delta === null
            ? t('첫 평가')
            : row.delta === 0
              ? t.ctx('lens', '같음')
              : formatDelta(row.delta);
        const deltaTone: AppTextTone =
          row.delta === null || row.delta === 0
            ? 'faint'
            : row.delta > 0
              ? 'positive'
              : 'negative';
        const spokenDelta =
          row.delta === null
            ? t('첫 평가')
            : row.delta === 0
              ? t('지난 평가와 같아요')
              : t('지난 평가보다 {delta}점', { delta: formatDelta(row.delta) });
        return (
          <Pressable
            accessibilityHint={t('이 평가를 화면에 보여요')}
            accessibilityLabel={`${when}, ${t('{score}점', { score: row.overall.toFixed(1) })}, ${spokenDelta}${row.latest ? `, ${t.ctx('lens', '최근')}` : ''}`}
            accessibilityRole="button"
            accessibilityState={{ selected: row.selected }}
            key={row.id}
            onPress={() => onSelect(row.id)}
            style={({ pressed }) => [
              styles.row,
              index < rows.length - 1 ? styles.rowDivider : null,
              row.selected ? styles.rowSelected : null,
              pressed ? styles.rowPressed : null,
            ]}
          >
            <View style={styles.copy}>
              <View style={styles.dateLine}>
                <AppText tabular variant="itemTitle">
                  {when}
                </AppText>
                {row.latest ? <StatusBadge label={t.ctx('lens', '최근')} tone="neutral" /> : null}
              </View>
              <AppText tone={deltaTone} variant="meta">
                {deltaText}
              </AppText>
            </View>
            <View style={styles.score}>
              <AppText tabular variant="bodyStrong">
                {row.overall.toFixed(1)}
              </AppText>
              <AppText tone="faint" variant="badge">
                {t.ctx('lens-unit', '점')}
              </AppText>
            </View>
            <View style={styles.trailing}>
              {row.selected ? (
                <Check
                  {...decorative}
                  color={colors.text}
                  size={iconSizes.section}
                  strokeWidth={2.2}
                />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

/** Compact rows: 54, per the layout rules. */
const ROW_HEIGHT = 54;

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: ROW_HEIGHT,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowSelected: {
    backgroundColor: colors.backgroundSoft,
  },
  rowPressed: {
    backgroundColor: colors.backgroundMuted,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  dateLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  score: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing.xxs,
  },
  /** A row's trailing control: a fixed 44pt column so text never runs under it. */
  trailing: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
    marginRight: -spacing.md,
    width: sizes.minimumTouchTarget,
  },
});
