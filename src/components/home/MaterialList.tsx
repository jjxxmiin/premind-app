import { memo, useCallback, type ReactElement } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';

import { MediaCard } from '@/components/ui';
import {
  formatBytes,
  formatMaterialLength,
  formatRelativeDate,
} from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/theme/tokens';
import type { Project, StudyMaterial } from '@/types';

import { MaterialRow } from './MaterialRow';
import { libraryStatusPresentation, youtubeThumbnail, type LibraryView } from './library';

export interface MaterialListProps {
  materials: readonly StudyMaterial[];
  projectById: ReadonlyMap<string, Project>;
  processingMaterialIds: readonly string[];
  evaluatingMaterialIds: readonly string[];
  view: LibraryView;
  /** The page width; each page of the pager is exactly one window wide. */
  width: number;
  gutter: number;
  columns: number;
  cardWidth?: number;
  header: ReactElement;
  empty: ReactElement;
  onOpen: (material: StudyMaterial) => void;
  onMore: (material: StudyMaterial) => void;
}

/**
 * One page of the home pager: a vertical list of the subject's materials with
 * the toolbar (and, on 전체, the onboarding card) as its header. The list
 * itself decides nothing; filtering and sorting happen above it.
 */
export const MaterialList = memo(function MaterialList({
  materials,
  projectById,
  processingMaterialIds,
  evaluatingMaterialIds,
  view,
  width,
  gutter,
  columns,
  cardWidth,
  header,
  empty,
  onOpen,
  onMore,
}: MaterialListProps) {
  const t = useT();
  const grid = view === 'card' && columns > 1;

  const renderItem: ListRenderItem<StudyMaterial> = useCallback(
    ({ item, index }) => {
      const isRunning = processingMaterialIds.includes(item.id);
      const isEvaluating = evaluatingMaterialIds.includes(item.id);
      const projectTitle = projectById.get(item.projectId)?.title ?? t('폴더 없음');

      if (view === 'card') {
        const status = libraryStatusPresentation(item, isRunning, t);
        const thumbnail = youtubeThumbnail(item);
        const card = (
          <MediaCard
            duration={formatMaterialLength(
              item.source.kind,
              item.source.durationMs,
              item.transcript.length,
            )}
            kind={item.source.kind}
            metadata={
              thumbnail
                ? `${formatRelativeDate(item.updatedAt)}, ${t('유튜브')}`
                : `${formatRelativeDate(item.updatedAt)}, ${formatBytes(item.source.sizeBytes)}`
            }
            moreLabel={t('{title} 메뉴', { title: item.title })}
            onPress={() => onOpen(item)}
            onMorePress={() => onMore(item)}
            progress={isRunning ? item.progress * 100 : undefined}
            progressLabel={status.detail}
            statusLabel={status.label}
            statusTone={status.tone}
            style={grid && cardWidth ? { width: cardWidth } : styles.fullCard}
            subtitle={projectTitle}
            thumbnailBackgroundColor={colors.backgroundSoft}
            thumbnailSource={thumbnail ? { uri: thumbnail } : undefined}
            title={item.title}
          />
        );
        if (grid) return card;
        return (
          <View style={[styles.cardCell, { paddingHorizontal: gutter }]}>{card}</View>
        );
      }

      return (
        <MaterialRow
          divider={index < materials.length - 1}
          gutter={gutter}
          isEvaluating={isEvaluating}
          isRunning={isRunning}
          material={item}
          onMorePress={onMore}
          onPress={onOpen}
          projectTitle={projectTitle}
        />
      );
    },
    [
      cardWidth,
      evaluatingMaterialIds,
      grid,
      gutter,
      materials.length,
      onMore,
      onOpen,
      processingMaterialIds,
      projectById,
      t,
      view,
    ],
  );

  return (
    <FlatList
      columnWrapperStyle={
        grid ? [styles.gridRow, { paddingHorizontal: gutter }] : undefined
      }
      contentContainerStyle={styles.content}
      data={materials}
      // numColumns cannot change on a mounted list; remount when it does.
      key={grid ? `grid-${columns}` : view}
      keyExtractor={keyExtractor}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={empty}
      ListHeaderComponent={header}
      ListHeaderComponentStyle={[styles.header, { paddingHorizontal: gutter }]}
      nestedScrollEnabled
      numColumns={grid ? columns : 1}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      style={[styles.list, { width }]}
    />
  );
});

function keyExtractor(material: StudyMaterial) {
  return material.id;
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  // Strip → toolbar 12; toolbar → first row 12 (the row adds its own 12
  // vertical padding, so the header contributes nothing below).
  header: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  cardCell: {
    paddingBottom: spacing.md,
  },
  fullCard: {
    width: '100%',
  },
  gridRow: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
});
