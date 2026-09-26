import { Image } from 'expo-image';
import { AudioLines, FileText, FileVideo2, MoreHorizontal } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, IconButton, ProgressBar, StatusBadge } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatMaterialLength, formatRelativeDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, illustration, radii, shadows, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

import { libraryStatusPresentation, youtubeThumbnail } from './library';

export interface MaterialCardProps {
  material: StudyMaterial;
  projectTitle: string;
  isRunning: boolean;
  isEvaluating: boolean;
  onPress: (material: StudyMaterial) => void;
  onMorePress: (material: StudyMaterial) => void;
  style?: StyleProp<ViewStyle>;
}

/** A quiet wash per kind, so a grid of icon-only covers is not one grey wall. */
const KIND_WASH = {
  audio: illustration.tones.apricot,
  video: illustration.tones.lavender,
  document: illustration.tones.sky,
} as const;

/**
 * One material in the card grid (tablet and desktop). A short cover — the
 * YouTube frame when there is one, otherwise the kind glyph on a tinted
 * wash — then the title and two meta lines. The grid row stretches every
 * card to the tallest one, so the covers line up whatever the title length.
 *
 * The menu is its own button beside the card's main press target rather than
 * nested inside it, so the web build never puts a button inside a button.
 */
export const MaterialCard = memo(function MaterialCard({
  material,
  projectTitle,
  isRunning,
  isEvaluating,
  onPress,
  onMorePress,
  style,
}: MaterialCardProps) {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const status = libraryStatusPresentation(material, isRunning, t);
  const thumbnail = youtubeThumbnail(material);
  const kind = material.source.kind;
  const Icon = kind === 'video' ? FileVideo2 : kind === 'document' ? FileText : AudioLines;
  const ready = material.status === 'ready';
  const failed = material.status === 'failed';

  return (
    <View style={[styles.card, hovered ? styles.cardHover : null, style]}>
      <Pressable
        accessibilityHint={t('자료를 열어요')}
        accessibilityLabel={`${material.title}, ${status.label}. ${status.detail}`}
        accessibilityRole="button"
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={() => onPress(material)}
        style={({ pressed }) => [styles.main, pressed ? styles.pressed : null]}
      >
        <View style={[styles.cover, { backgroundColor: KIND_WASH[kind] ?? colors.backgroundSoft }]}>
          {thumbnail ? (
            <Image
              {...decorative}
              cachePolicy="memory-disk"
              contentFit="cover"
              recyclingKey={material.id}
              source={{ uri: thumbnail }}
              style={styles.coverImage}
              transition={120}
            />
          ) : (
            <View {...decorative} style={styles.iconDisc}>
              <Icon
                color={failed ? colors.negative : ready ? colors.brand : colors.textSoft}
                size={22}
                strokeWidth={1.8}
              />
            </View>
          )}
          {material.status !== 'ready' || isEvaluating ? (
            <View style={styles.badges}>
              {material.status !== 'ready' ? (
                <StatusBadge label={status.label} tone={status.tone} />
              ) : null}
              {isEvaluating ? <StatusBadge label={t('평가 중')} showDot tone="brand" /> : null}
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <AppText numberOfLines={2} style={styles.title} variant="itemTitle">
            {material.title}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="meta">
            {projectTitle}
          </AppText>
          <AppText numberOfLines={1} tabular tone="faint" variant="meta">
            {formatMaterialLength(kind, material.source.durationMs, material.transcript.length)}
            {' / '}
            {formatRelativeDate(material.updatedAt)}
          </AppText>
          {isRunning ? (
            <View style={styles.progress}>
              <ProgressBar label={status.detail} showValue tone="brand" value={material.progress * 100} />
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.more}>
        <IconButton
          icon={MoreHorizontal}
          label={t('{title} 메뉴', { title: material.title })}
          onPress={() => onMorePress(material)}
          variant="ghost"
        />
      </View>
    </View>
  );
});

const COVER_HEIGHT = 112;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHover: {
    borderColor: colors.borderHover,
    ...shadows.card,
  },
  main: {
    flex: 1,
  },
  pressed: {
    opacity: 0.9,
  },
  cover: {
    alignItems: 'center',
    height: COVER_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImage: {
    height: '100%',
    width: '100%',
  },
  iconDisc: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.tile,
    height: 48,
    justifyContent: 'center',
    width: 48,
    ...shadows.subtle,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
    left: spacing.md,
    position: 'absolute',
    top: spacing.md,
  },
  body: {
    gap: spacing.xxs,
    paddingBottom: spacing.md,
    paddingLeft: spacing.md,
    // Room for the menu button that sits over the body's top-right corner.
    paddingRight: spacing.xxxl + spacing.xs,
    paddingTop: spacing.md,
  },
  title: {
    marginBottom: spacing.xxs,
  },
  progress: {
    paddingTop: spacing.sm,
  },
  more: {
    position: 'absolute',
    right: spacing.xxs,
    top: COVER_HEIGHT + spacing.xxs,
  },
});
