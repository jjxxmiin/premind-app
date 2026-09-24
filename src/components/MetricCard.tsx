import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

import { AppText } from './ui/AppText';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
}

export function MetricCard({ icon: Icon, label, value, detail }: MetricCardProps) {
  return (
    <View style={styles.container}>
      <Icon color={colors.brand} size={18} strokeWidth={2} />
      <AppText tone="muted" variant="meta">{label}</AppText>
      <AppText tabular variant="pageTitle">{value}</AppText>
      {detail ? <AppText tone="faint" variant="badge">{detail}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 130,
    padding: spacing.gutter,
  },
});

