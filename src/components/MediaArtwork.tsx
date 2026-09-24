import { AudioLines, FileText, FileVideo2, Sparkles } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { decorative } from '@/lib/a11y';
import type { MaterialKind, MaterialStatus } from '@/types';
import { colors, radii, spacing } from '@/theme/tokens';

import { AppText } from './ui/AppText';

interface MediaArtworkProps {
  kind: MaterialKind;
  status?: MaterialStatus;
  label?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Fixed bar heights so every thumbnail draws the same quiet waveform. */
const WAVEFORM = [10, 18, 26, 14, 22, 32, 18, 12, 24, 16, 28, 12] as const;

/**
 * The thumbnail for a recording. A flat grey tile with a kind glyph; a small
 * waveform when there is room, and an "AI 정리 중" caption while processing.
 * Deliberately not illustrated, so a list of thirty rows stays calm.
 */
export function MediaArtwork({ kind, status, label, compact = false, style }: MediaArtworkProps) {
  const Icon =
    kind === 'video' ? FileVideo2 : kind === 'document' ? FileText : AudioLines;
  const processing = status && !['ready', 'failed', 'imported'].includes(status);
  const failed = status === 'failed';
  const ready = status === 'ready';

  return (
    <View
      style={[
        styles.container,
        compact ? styles.compact : null,
        failed ? styles.failed : null,
        style,
      ]}
    >
      <View style={[styles.iconDisc, compact ? styles.iconDiscCompact : null]}>
        <Icon
          {...decorative}
          color={failed ? colors.negative : ready ? colors.brand : colors.text}
          size={compact ? 20 : 26}
          strokeWidth={1.8}
        />
      </View>
      {!compact ? (
        <View style={styles.waveform} {...decorative}>
          {WAVEFORM.map((height, index) => (
            <View
              key={`${height}-${index}`}
              style={[
                styles.bar,
                { height },
                ready ? styles.barReady : null,
              ]}
            />
          ))}
        </View>
      ) : null}
      {!compact && processing ? (
        <View accessibilityLiveRegion="polite" style={styles.processing}>
          <Sparkles color={colors.brandText} size={12} />
          <AppText tone="brand" variant="badge">AI 정리 중</AppText>
        </View>
      ) : !compact && label ? (
        <View style={styles.processing}>
          <AppText numberOfLines={1} tone="muted" variant="badge">{label}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    aspectRatio: 16 / 9,
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.tile,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  compact: {
    aspectRatio: 1,
    borderRadius: radii.input,
    height: 56,
    width: 56,
  },
  failed: {
    backgroundColor: colors.negativeSoft,
  },
  iconDisc: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  iconDiscCompact: {
    backgroundColor: colors.transparent,
    height: 32,
    width: 32,
  },
  waveform: {
    alignItems: 'center',
    bottom: spacing.md,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  bar: {
    backgroundColor: colors.borderStrong,
    borderRadius: radii.full,
    width: 3,
  },
  barReady: {
    backgroundColor: colors.brand,
    opacity: 0.55,
  },
  processing: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.badge,
    flexDirection: 'row',
    gap: spacing.xs,
    left: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    position: 'absolute',
    top: spacing.md,
  },
});
