import { Flag, Timer, VolumeX, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

interface Tip {
  id: string;
  icon: LucideIcon;
  text: string;
}

const TIPS: readonly Tip[] = [
  { id: 'length', icon: Timer, text: '녹음은 3분 이상 해요' },
  { id: 'quiet', icon: VolumeX, text: '조용한 곳에서 녹음해요' },
  { id: 'lead', icon: Flag, text: '결론부터 말해요' },
];

export interface LensTipsCardProps {
  style?: StyleProp<ViewStyle>;
}

/** Three short rules for a recording that scores fairly. Hidden after a few reports. */
export function LensTipsCard({ style }: LensTipsCardProps) {
  const t = useT();
  return (
    <Card
      accessibilityLabel={`${t('이렇게 써요')}. ${TIPS.map((tip) => t(tip.text)).join(', ')}`}
      accessible
      padding={false}
      style={style}
    >
      {TIPS.map(({ icon: Icon, id, text }, index) => (
        <View
          key={id}
          style={[styles.row, index < TIPS.length - 1 ? styles.rowDivider : null]}
        >
          <View {...decorative} style={styles.iconWell}>
            <Icon color={colors.textSoft} size={iconSizes.inline} strokeWidth={2} />
          </View>
          <AppText style={styles.text} variant="body">
            {t(text)}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 54,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWell: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.full,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
});
