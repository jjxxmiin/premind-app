import { router } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { MaterialRow } from '@/components/home/MaterialRow';
import { matchesQuery, normalizeQuery, sortMaterials } from '@/components/home/library';
import { AppText, AuthField, EmptyState, IconButton, Screen } from '@/components/ui';
import { useLayout } from '@/lib/layout';
import { goBackOrReplace } from '@/lib/navigation';
import { useAppStore } from '@/state/app-store';
import { iconSizes, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

/**
 * Search across the whole library — title, file name and subject — on its
 * own screen so the home list keeps its first screen for the list.
 */
export default function SearchScreen() {
  const { evaluatingMaterialIds, materials, processingMaterialIds, projects } =
    useAppStore();
  const { gutter } = useLayout();
  const [query, setQuery] = useState('');
  const normalized = normalizeQuery(query);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const results = useMemo(
    () =>
      normalized
        ? sortMaterials(
            materials.filter((material) =>
              matchesQuery(material, projectById.get(material.projectId), normalized),
            ),
            'recent',
          )
        : [],
    [materials, normalized, projectById],
  );

  const openMaterial = useCallback((material: StudyMaterial) => {
    router.push(
      material.status === 'ready'
        ? { pathname: '/material/[id]', params: { id: material.id } }
        : { pathname: '/processing/[id]', params: { id: material.id } },
    );
  }, []);

  const renderItem: ListRenderItem<StudyMaterial> = useCallback(
    ({ item, index }) => (
      <MaterialRow
        divider={index < results.length - 1}
        gutter={gutter}
        isEvaluating={evaluatingMaterialIds.includes(item.id)}
        isRunning={processingMaterialIds.includes(item.id)}
        material={item}
        onPress={openMaterial}
        projectTitle={projectById.get(item.projectId)?.title ?? '폴더 없음'}
      />
    ),
    [
      evaluatingMaterialIds,
      gutter,
      openMaterial,
      processingMaterialIds,
      projectById,
      results.length,
    ],
  );

  return (
    <Screen padded={false}>
      <AppHeader onBack={() => goBackOrReplace('/(tabs)')} title="검색" />
      <View style={[styles.field, { paddingHorizontal: gutter }]}>
        <AuthField
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          label="검색어"
          onChangeText={setQuery}
          placeholder="제목, 파일명, 폴더"
          returnKeyType="search"
          trailing={
            query ? (
              <IconButton
                icon={X}
                iconSize={iconSizes.inline}
                label="검색어 지우기"
                onPress={() => setQuery('')}
              />
            ) : undefined
          }
          value={query}
        />
      </View>
      <FlatList
        contentContainerStyle={styles.content}
        data={results}
        keyExtractor={keyExtractor}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          normalized ? (
            <EmptyState
              description="다른 말로 다시 찾아보세요"
              icon={Search}
              title="검색 결과가 없어요"
            />
          ) : (
            <EmptyState
              compact
              description="자료 제목과 파일 이름, 폴더 이름에서 찾아요. 대본은 자료를 연 뒤 그 안에서 검색해요."
              icon={Search}
              title="무엇을 찾을까요?"
            />
          )
        }
        ListHeaderComponent={
          normalized && results.length > 0 ? (
            <View style={[styles.summary, { paddingHorizontal: gutter }]}>
              <AppText
                accessibilityLiveRegion="polite"
                numberOfLines={1}
                tone="muted"
                variant="meta"
              >
                “{query.trim()}” 검색 결과 {results.length}개
              </AppText>
            </View>
          ) : null
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
    </Screen>
  );
}

function keyExtractor(material: StudyMaterial) {
  return material.id;
}

const styles = StyleSheet.create({
  field: {
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  list: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  // The first row brings its own 12pt padding, so the caption adds none.
  summary: {
    paddingBottom: spacing.none,
  },
});
