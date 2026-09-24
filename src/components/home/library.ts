import { youtubeThumbnailUrl } from '@/lib/youtube';
import type { Project, StudyMaterial } from '@/types';

import type { StatusTone } from '../ui/Chip';

export type LibraryView = 'card' | 'list';
export type StatusFilter = 'all' | 'ready' | 'processing' | 'failed';
export type LibrarySort = 'recent' | 'oldest' | 'title';

export const SORT_OPTIONS: readonly { value: LibrarySort; label: string }[] = [
  { value: 'recent', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
  { value: 'title', label: '이름순' },
];

export const SORT_LABELS: Record<LibrarySort, string> = {
  recent: '최신순',
  oldest: '오래된순',
  title: '이름순',
};

export interface LibraryFilters {
  status: StatusFilter;
  sort: LibrarySort;
  savedOnly: boolean;
  view: LibraryView;
}

export const DEFAULT_FILTERS: LibraryFilters = {
  status: 'all',
  sort: 'recent',
  savedOnly: false,
  view: 'list',
};

/** True when something narrows the list: the dot on the toolbar's sort control. */
export function isNarrowed(filters: LibraryFilters): boolean {
  return filters.status !== 'all' || filters.savedOnly;
}

/**
 * The quiet count on the toolbar. "자료 4개" by default, "자료 4개 중 2개"
 * while a status filter hides some, "저장한 자료 3개" behind the saved
 * switch, and "자료 없음" when the subject is empty.
 */
export function materialCountLabel(
  total: number,
  visible: number,
  filters: LibraryFilters,
): string {
  const noun = filters.savedOnly ? '저장한 자료' : '자료';
  if (total === 0) return `${noun} 없음`;
  if (filters.status !== 'all') return `${noun} ${total}개 중 ${visible}개`;
  return `${noun} ${total}개`;
}

/** Filters that narrow the list. The view mode is presentation, not a filter. */
export function activeFilterCount(filters: LibraryFilters): number {
  return (
    (filters.status !== 'all' ? 1 : 0) +
    (filters.sort !== 'recent' ? 1 : 0) +
    (filters.savedOnly ? 1 : 0)
  );
}

export function libraryStatusPresentation(
  material: StudyMaterial,
  isRunning: boolean,
): { label: string; tone: StatusTone; detail: string } {
  if (material.status === 'ready') {
    return { label: '완료', tone: 'positive', detail: '마인드팩이 준비됐어요' };
  }
  if (material.status === 'failed') {
    return {
      label: '확인 필요',
      tone: 'negative',
      detail: material.lastError ?? '만들지 못했어요. 눌러서 다시 시도해 주세요.',
    };
  }
  if (material.status === 'imported') {
    return {
      label: '가져옴',
      tone: 'neutral',
      detail: '원본만 저장했어요. 눌러서 마인드팩을 만들어요.',
    };
  }
  if (!isRunning) {
    return {
      label: '이어가기',
      tone: 'warning',
      detail: '멈춰 있어요. 눌러서 이어가요.',
    };
  }
  return {
    label:
      material.status === 'queued'
        ? '준비 중'
        : material.status === 'transcribing'
          ? '대본 생성'
          : '생성 중',
    tone: 'brand',
    detail: material.progressLabel,
  };
}

export function youtubeThumbnail(material: StudyMaterial): string | undefined {
  return material.source.origin === 'link' && material.source.youtubeId
    ? youtubeThumbnailUrl(material.source.youtubeId)
    : undefined;
}

export function matchesStatus(material: StudyMaterial, status: StatusFilter): boolean {
  if (status === 'all') return true;
  if (status === 'ready') return material.status === 'ready';
  if (status === 'failed') return material.status === 'failed';
  return ['imported', 'queued', 'transcribing', 'generating'].includes(
    material.status,
  );
}

export function sortMaterials(
  materials: readonly StudyMaterial[],
  sort: LibrarySort,
): StudyMaterial[] {
  return [...materials].sort((left, right) => {
    if (sort === 'title') {
      return left.title.localeCompare(right.title, 'ko-KR');
    }
    return sort === 'oldest'
      ? left.updatedAt.localeCompare(right.updatedAt)
      : right.updatedAt.localeCompare(left.updatedAt);
  });
}

/** Title, file name and project title, case-insensitively. */
export function matchesQuery(
  material: StudyMaterial,
  project: Project | undefined,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;
  return [material.title, material.source.fileName, project?.title]
    .filter(Boolean)
    .some((value) =>
      value?.toLocaleLowerCase('ko-KR').includes(normalizedQuery),
    );
}

export function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase('ko-KR');
}
