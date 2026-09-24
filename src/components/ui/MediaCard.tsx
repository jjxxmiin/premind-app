import {
  AudioLines,
  FileText,
  MoreHorizontal,
  Play,
  Video,
  type LucideIcon,
} from 'lucide-react-native';
import { Image, type ImageProps } from 'expo-image';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Card } from './Card';
import { type StatusTone, StatusBadge } from './Chip';
import { IconButton } from './IconButton';
import { ProgressBar } from './ProgressBar';

export type MediaKind = 'video' | 'audio' | 'document';

export interface MediaCardProps {
  title: string;
  subtitle?: string;
  metadata?: string;
  duration?: string;
  kind?: MediaKind;
  thumbnailSource?: ImageProps['source'];
  thumbnailFit?: ImageProps['contentFit'];
  thumbnailBackgroundColor?: string;
  thumbnailAccessibilityLabel?: string;
  statusLabel?: string;
  statusTone?: StatusTone;
  progress?: number;
  progressLabel?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onMorePress?: () => void;
  moreLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const kindIcons: Record<MediaKind, LucideIcon> = {
  video: Video,
  audio: AudioLines,
  document: FileText,
};

export function MediaCard({
  title,
  subtitle,
  metadata,
  duration,
  kind = 'video',
  thumbnailSource,
  thumbnailFit = 'cover',
  thumbnailBackgroundColor,
  thumbnailAccessibilityLabel,
  statusLabel,
  statusTone = 'neutral',
  progress,
  progressLabel,
  selected = false,
  disabled = false,
  onPress,
  onMorePress,
  moreLabel = '더보기',
  style,
  testID,
}: MediaCardProps) {
  const KindIcon = kindIcons[kind];
  const accessibilitySummary = [title, subtitle, statusLabel, progressLabel]
    .filter(Boolean)
    .join('. ');

  return (
    <Card
      disabled={disabled}
      padding={false}
      selected={selected}
      style={style}
      testID={testID}
    >
      <Pressable
        accessibilityLabel={`${accessibilitySummary}. 미리보기 열기`}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityState={{ disabled: disabled || !onPress }}
        disabled={disabled || !onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.thumbnail,
          thumbnailBackgroundColor
            ? { backgroundColor: thumbnailBackgroundColor }
            : null,
          pressed ? styles.pressed : null,
        ]}
      >
        {thumbnailSource ? (
          <Image
            accessibilityLabel={thumbnailAccessibilityLabel}
            accessible={Boolean(thumbnailAccessibilityLabel)}
            cachePolicy="memory-disk"
            contentFit={thumbnailFit}
            recyclingKey={title}
            source={thumbnailSource}
            style={styles.thumbnailImage}
            transition={180}
          />
        ) : (
          <View style={styles.fallback}>
            <KindIcon
              {...decorative}
              color={colors.textMuted}
              size={28}
              strokeWidth={1.7}
            />
          </View>
        )}
        {kind === 'video' ? (
          <View {...decorative} style={styles.playBadge}>
            <Play
              color={colors.textInverse}
              fill={colors.textInverse}
              size={iconSizes.inline}
              strokeWidth={1.8}
            />
          </View>
        ) : null}
        {statusLabel ? (
          <View style={styles.status}>
            <StatusBadge label={statusLabel} tone={statusTone} />
          </View>
        ) : null}
        {duration ? (
          <View style={styles.duration}>
            <AppText tabular tone="inverse" variant="badge">
              {duration}
            </AppText>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Pressable
            accessibilityLabel={accessibilitySummary}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityState={{ disabled: disabled || !onPress }}
            disabled={disabled || !onPress}
            onPress={onPress}
            style={({ pressed }) => [
              styles.copy,
              pressed ? styles.pressed : null,
            ]}
          >
            <AppText numberOfLines={2} variant="itemTitle">
              {title}
            </AppText>
            {subtitle ? (
              <AppText numberOfLines={1} tone="muted" variant="meta">
                {subtitle}
              </AppText>
            ) : null}
            {metadata ? (
              <AppText numberOfLines={1} tone="faint" variant="meta">
                {metadata}
              </AppText>
            ) : null}
          </Pressable>
          {onMorePress ? (
            <IconButton
              disabled={disabled}
              icon={MoreHorizontal}
              label={moreLabel}
              onPress={onMorePress}
              variant="ghost"
            />
          ) : null}
        </View>
        {typeof progress === 'number' ? (
          <ProgressBar
            label={progressLabel}
            showValue
            tone="brand"
            value={progress}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.backgroundMuted,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  thumbnailImage: {
    height: '100%',
    width: '100%',
  },
  fallback: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  playBadge: {
    alignItems: 'center',
    backgroundColor: colors.stage,
    borderColor: colors.stageBorder,
    borderRadius: radii.full,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
    position: 'absolute',
    top: '50%',
    width: 40,
  },
  status: {
    left: spacing.md,
    position: 'absolute',
    top: spacing.md,
  },
  duration: {
    backgroundColor: colors.stage,
    borderRadius: radii.badge,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    position: 'absolute',
    right: spacing.sm,
  },
  content: {
    gap: spacing.md,
    padding: spacing.gutter,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  pressed: {
    opacity: 0.82,
  },
});
