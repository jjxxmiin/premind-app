import { Mic, Presentation } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, Button, Card, StatusBadge } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

export interface LensIntroCardProps {
  /** "발표 녹음하기": go and record a practice run. */
  onRecord: () => void;
  /** "가진 자료로 평가": open the picker over every ready material. */
  onPick: () => void;
  style?: StyleProp<ViewStyle>;
}

/** What a report scores, in the order the report prints them. */
const RUBRIC_CHIPS = ['구조', '명료성', '근거', '전달력', '말하기 습관'] as const;

/**
 * The 평가 tab before the first report: what the feature does in one glance
 * and the two ways in. Replaced by the latest report once one exists.
 */
export function LensIntroCard({ onPick, onRecord, style }: LensIntroCardProps) {
  return (
    <Card style={[styles.card, style]} variant="soft">
      <View style={styles.head}>
        <View {...decorative} style={styles.iconWell}>
          <Presentation color={colors.text} size={iconSizes.section} strokeWidth={1.9} />
        </View>
        <View style={styles.copy}>
          <AppText accessibilityRole="header" variant="heading">
            내 발표를 채점해요
          </AppText>
          <AppText tone="muted" variant="meta">
            발표, 스피치, 면접 연습을 녹음하거나 올리면 대본을 근거로 점수와 먼저 고칠 것 하나를
            알려줘요
          </AppText>
        </View>
      </View>
      <View
        accessibilityLabel={`채점 항목: ${RUBRIC_CHIPS.join(', ')}`}
        accessible
        style={styles.chips}
      >
        {RUBRIC_CHIPS.map((label) => (
          <StatusBadge key={label} label={label} style={styles.chip} tone="neutral" />
        ))}
      </View>
      <View style={styles.actions}>
        <Button
          fullWidth
          leftIcon={<Mic color={colors.textInverse} size={iconSizes.inline} />}
          onPress={onRecord}
          variant="primary"
        >
          발표 녹음하기
        </Button>
        <Button fullWidth onPress={onPick} variant="outline">
          가진 자료로 평가
        </Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconWell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
});
