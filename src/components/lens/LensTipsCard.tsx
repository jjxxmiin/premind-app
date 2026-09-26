import { Flag, Timer, VolumeX, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui';
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

/**
 * Three short rules for a recording that scores fairly, as three small tiles
 * side by side (2026-09-26: a list of rows read like a settings page).
 * Hidden after a few reports.
 */
export function LensTipsCard({ style }: LensTipsCardProps) {
  const t = useT();
  return (
    <View
      accessibilityLabel={`${t('이렇게 써요')}. ${TIPS.map((tip) => t(tip.text)).join(', ')}`}
      accessible
      style={[styles.row, style]}
    >
      {TIPS.map(({ icon: Icon, id, text }) => (
        <View key={id} style={styles.tile}>
          <View {...decorative} style={styles.iconWell}>
            <Icon color={colors.brand} size={iconSizes.section} strokeWidth={2} />
          </View>
          <AppText variant="label">{t(text)}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.hero,
    flex: 1,
    gap: spacing.sm,
    minWidth: 0,
    padding: spacing.md,
  },
  iconWell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});
