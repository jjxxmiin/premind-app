import { Highlighter, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, IconButton } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

export interface HighlightHintProps {
  /** The one line to say. */
  children: string;
  onDismiss: () => void;
  testID?: string;
}

/**
 * One line telling the learner how the 형광펜 works here, shown until they
 * have painted something or waved it away.
 *
 * 대본 needs it because painting is a long press there — the row's timestamp
 * already answers a tap — and a gesture nobody mentions is a gesture nobody
 * finds. The line is itself tappable so a thumb anywhere on it dismisses.
 */
export function HighlightHint({ children, onDismiss, testID }: HighlightHintProps) {
  return (
    <View style={styles.hint} testID={testID}>
      <Pressable
        accessibilityHint="이 안내를 닫아요."
        accessibilityLabel={children}
        accessibilityRole="button"
        onPress={onDismiss}
        style={({ pressed }) => [styles.body, pressed ? styles.pressed : null]}
      >
        <Highlighter
          {...decorative}
          color={colors.textMuted}
          size={iconSizes.dense}
          strokeWidth={2}
        />
        <AppText style={styles.copy} tone="muted" variant="meta">
          {children}
        </AppText>
      </Pressable>
      <IconButton icon={X} label="안내 닫기" onPress={onDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.card,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  body: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minWidth: 0,
    paddingVertical: spacing.xs,
  },
  copy: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
});
