import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { formatSourcePosition } from '@/lib/format';
import { colors, radii, spacing } from '@/theme/tokens';

/**
 * Where something came from, in a quiet grey pill: a timestamp for a
 * recording, a page number for an uploaded document. With `onPress` it is its
 * own control (hit slop brings the 24pt pill up to a 44pt target); without
 * it, the row around it is the control.
 */
export function TimeChip({
  accessibilityLabel,
  onPress,
  timestampMs,
  page = false,
}: {
  accessibilityLabel?: string;
  onPress?: () => void;
  timestampMs: number;
  /** Read the position as a page number: the material is a document. */
  page?: boolean;
}) {
  const label = (
    <AppText tabular tone="soft" variant="meta">
      {formatSourcePosition(timestampMs, page)}
    </AppText>
  );
  if (!onPress) {
    return <View style={styles.timeChip}>{label}</View>;
  }
  return (
    <Pressable
      accessibilityHint={page ? '그 쪽으로 이동해요.' : '그 시점부터 재생해요.'}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.timeChip, pressed ? styles.pressed : null]}
    >
      {label}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  timeChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.chip,
    justifyContent: 'center',
    minWidth: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  pressed: { opacity: 0.7 },
});
