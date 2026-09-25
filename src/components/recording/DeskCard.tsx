import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useLayout } from '@/lib/layout';
import { colors, radii, shadows, spacing } from '@/theme/tokens';

/**
 * The focused-task card of the recording area (record, upload, processing).
 *
 * On a phone the screen already is the card, so this is a plain column. From a
 * tablet up, the same content sits on one white card with a hairline border and
 * the faintest shadow, centred in the screen's column, so a short task does not
 * float loose across a 1000px window.
 */
export function DeskCard({
  children,
  style,
  testID,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; testID?: string }>) {
  const { isTablet } = useLayout();
  return (
    <View
      style={[styles.column, isTablet ? styles.card : null, style]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.hero,
    borderWidth: 1,
    padding: spacing.xxl,
    ...shadows.card,
  },
});
