import { Image } from 'expo-image';
import { MoreHorizontal } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MediaArtwork } from '@/components/MediaArtwork';
import { AppText, IconButton, ProgressBar, StatusBadge } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatMaterialLength, formatRelativeDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radii, sizes, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

import { libraryStatusPresentation, youtubeThumbnail } from './library';

export interface MaterialRowProps {
  material: StudyMaterial;
  projectTitle: string;
  isRunning: boolean;
  isEvaluating: boolean;
  onPress: (material: StudyMaterial) => void;
  /** Omit to render the row without its menu column. */
  onMorePress?: (material: StudyMaterial) => void;
  /** Horizontal inset of the row content. Defaults to the screen gutter. */
  gutter?: number;
  divider?: boolean;
}

/**
 * One material in the library: a 56pt thumbnail, a two-line title, a meta
 * line and the status badges. The menu sits in its own fixed 44pt column so
 * it can never overlap the copy, however long the title.
 */
export const MaterialRow = memo(function MaterialRow({
  material,
  projectTitle,
  isRunning,
  isEvaluating,
  onPress,
  onMorePress,
  gutter = spacing.gutter,
  divider = true,
}: MaterialRowProps) {
  const t = useT();
  const status = libraryStatusPresentation(material, isRunning, t);
  const thumbnail = youtubeThumbnail(material);
  // The 40pt icon well sits centred in its 44pt touch column; pulling the
  // column in by the 2pt difference puts the well's edge on the gutter line.
  const menuGutter = Math.max(gutter - spacing.xxs, spacing.xs);

  return (
    <View style={[styles.row, divider ? styles.divider : null]}>
      <View style={styles.head}>
        <Pressable
          accessibilityHint={t('자료를 열어요')}
          accessibilityLabel={`${material.title}, ${status.label}. ${status.detail}`}
          accessibilityRole="button"
          onPress={() => onPress(material)}
          style={({ pressed }) => [
            styles.main,
            { paddingLeft: gutter, paddingRight: onMorePress ? spacing.md : gutter },
            pressed ? styles.pressed : null,
          ]}
        >
          {thumbnail ? (
            <Image
              {...decorative}
              cachePolicy="memory-disk"
              contentFit="cover"
              recyclingKey={material.id}
              source={{ uri: thumbnail }}
              style={styles.thumbnail}
              transition={120}
            />
          ) : (
            <MediaArtwork
              compact
              kind={material.source.kind}
              status={material.status}
            />
          )}
          <View style={styles.copy}>
            <AppText numberOfLines={2} variant="itemTitle">
              {material.title}
            </AppText>
            <AppText numberOfLines={1} tone="muted" variant="meta">
              {projectTitle} /{' '}
              {formatMaterialLength(
                material.source.kind,
                material.source.durationMs,
                material.transcript.length,
              )}{' '}
              /{' '}
              {formatRelativeDate(material.updatedAt)}
            </AppText>
            {material.status !== 'ready' || isEvaluating ? (
              <View style={styles.badges}>
                {material.status !== 'ready' ? (
                  <StatusBadge label={status.label} tone={status.tone} />
                ) : null}
                {isEvaluating ? (
                  <StatusBadge label={t('평가 중')} showDot tone="brand" />
                ) : null}
              </View>
            ) : null}
          </View>
        </Pressable>
        {onMorePress ? (
          <View style={[styles.menuColumn, { marginRight: menuGutter }]}>
            <IconButton
              icon={MoreHorizontal}
              label={t('{title} 메뉴', { title: material.title })}
              onPress={() => onMorePress(material)}
            />
          </View>
        ) : null}
      </View>
      {isRunning ? (
        <View style={[styles.progress, { paddingHorizontal: gutter }]}>
          <ProgressBar
            label={status.detail}
            showValue
            value={material.progress * 100}
          />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
  },
  divider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  head: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  main: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minWidth: 0,
    paddingVertical: spacing.md,
  },
  pressed: {
    backgroundColor: colors.backgroundSoft,
  },
  copy: {
    flex: 1,
    flexShrink: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  badges: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  menuColumn: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
    width: sizes.minimumTouchTarget,
  },
  progress: {
    paddingBottom: spacing.md,
  },
  thumbnail: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.input,
    flexShrink: 0,
    height: 56,
    width: 56,
  },
});
