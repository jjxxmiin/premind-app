import { router, useLocalSearchParams } from 'expo-router';
import {
  BarChart3,
  Bell,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FileText,
  Link2,
  Mic,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { FilterSheet } from '@/components/home/FilterSheet';
import {
  FolderChips,
  HomeDesktopHeader,
  HomeDesktopOverview,
} from '@/components/home/HomeDesktop';
import { MaterialList } from '@/components/home/MaterialList';
import { SubjectTabs, type SubjectTab } from '@/components/home/SubjectTabs';
import {
  DEFAULT_FILTERS,
  SORT_LABELS,
  isNarrowed,
  materialCountLabel,
  matchesStatus,
  sortMaterials,
  type LibraryFilters,
} from '@/components/home/library';
import {
  AppText,
  AnimatedReveal,
  AuthField,
  BottomSheetModal,
  Button,
  Card,
  Dialog,
  EmptyLibraryArtwork,
  EmptyState,
  Toast,
  useToast,
  IconButton,
  ListRow,
  Screen,
} from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatMaterialLength } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { parseYouTubeId } from '@/lib/youtube';
import { useAppStore } from '@/state/app-store';
import { inputReset } from '@/theme/input-reset';
import { colors, iconSizes, motion, radii, sizes, spacing, typography } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

type PendingDialog = 'youtube' | 'rename' | 'delete' | null;

interface SubjectPage extends SubjectTab {
  /** Undefined on the 전체 and 저장함 pages. */
  projectId?: string;
  /** The 저장함 page: bookmarked materials, whatever subject they are in. */
  savedOnly?: true;
}

const ALL_PAGE_KEY = 'all';
const SAVED_PAGE_KEY = 'saved';
const YOUTUBE_PLACEHOLDER = 'https://www.youtube.com/watch?v=…';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Home is the library, split by subject. The subject strip and the pager
 * under it move together: tap a tab or swipe the list, and the other follows.
 * Everything that narrows the list lives in the filter sheet, so the first
 * screen is the list itself.
 */
export default function HomeScreen() {
  const t = useT();
  const { newProject: rawNewProjectRequest, add: rawAddRequest } =
    useLocalSearchParams<{
      newProject?: string | string[];
      add?: string | string[];
    }>();
  const {
    activeProjectId,
    createProject,
    deleteMaterial,
    evaluatingMaterialIds,
    importYouTubeMaterial,
    materials,
    processingMaterialIds,
    projects,
    renameMaterial,
    moveMaterial,
    requestLens,
    savedMaterialIds,
    selectProject,
    session,
    settings,
    toggleSavedMaterial,
    updateSettings,
  } = useAppStore();
  const { width: windowWidth } = useWindowDimensions();
  const { breakpoint, columns: layoutColumns, gutter, isTablet } = useLayout();
  // A laptop or desktop window: no swipeable pager (there is no swipe), the
  // folders become chips. Tablets keep the pager; both open the library as a
  // card grid, which a phone's single column has no room for.
  const wide = breakpoint === 'expanded';

  const [filters, setFilters] = useState<LibraryFilters>(() =>
    isTablet ? { ...DEFAULT_FILTERS, view: 'card' } : DEFAULT_FILTERS,
  );
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const pageIndexRef = useRef(0);
  const pagerRef = useRef<FlatList<SubjectPage>>(null);
  // The pager is measured because on tablets the Screen column is narrower
  // than the window; the window width is only the first guess.
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const pageWidth = measuredWidth || windowWidth;
  // One 16:9 card per row is right on a phone and absurd on a tablet, where it
  // becomes an 800pt-tall block of artwork with a title under it. The cell is
  // cut from the measured column, which on a desktop is wider than the
  // reading column the layout's own grid helper assumes.
  const gridAvailable = pageWidth - gutter * 2;
  const columns = wide ? (gridAvailable >= 880 ? 3 : 2) : layoutColumns;
  const cardWidth =
    columns > 1
      ? Math.floor((gridAvailable - spacing.md * (columns - 1)) / columns)
      : undefined;
  const previousPageWidth = useRef(pageWidth);
  /** How many pages the pager was last aligned for; see the effect below. */
  const previousPageCount = useRef(0);
  // Set while a tab tap is animating the pager, so the pages it passes on
  // the way are not mistaken for the destination. Cleared when the scroll
  // settles, or by a timer on platforms that never report the end.
  const programmaticTarget = useRef<number | null>(null);
  const programmaticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusProjectId, setFocusProjectId] = useState<string | null>(null);

  const [projectSheetVisible, setProjectSheetVisible] = useState(false);
  const projectSheetTrigger = useRef<{
    focus: () => void;
    isConnected?: boolean;
  } | null>(null);
  const handledProjectRequest = useRef<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [courseName, setCourseName] = useState('');
  const [projectTitleFocused, setProjectTitleFocused] = useState(false);
  const [courseNameFocused, setCourseNameFocused] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [uploadSheetVisible, setUploadSheetVisible] = useState(false);

  // Dialogs are modals of their own; on iOS a second modal cannot open while
  // a sheet is still fading out, so a sheet hands over through `pending`.
  const [pendingDialog, setPendingDialog] = useState<PendingDialog>(null);
  const [youtubeDialogVisible, setYoutubeDialogVisible] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubeBusy, setYoutubeBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState<StudyMaterial | null>(null);
  /** The material whose folder is being changed; null when the sheet is shut. */
  const [moveTarget, setMoveTarget] = useState<StudyMaterial | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(
    null,
  );

  const handledAddRequest = useRef<string | null>(null);
  const newProjectRequest = Array.isArray(rawNewProjectRequest)
    ? rawNewProjectRequest[0]
    : rawNewProjectRequest;

  useEffect(() => {
    if (
      !newProjectRequest ||
      handledProjectRequest.current === newProjectRequest
    ) {
      return;
    }
    handledProjectRequest.current = newProjectRequest;
    projectSheetTrigger.current = null;
    setProjectError(null);
    setProjectSheetVisible(true);
    router.replace('/(tabs)');
  }, [newProjectRequest]);

  // The tab bar's middle button routes here with ?add=<token>, so one press
  // opens the 자료 추가 sheet no matter which tab the reader was on.
  const addRequest = Array.isArray(rawAddRequest) ? rawAddRequest[0] : rawAddRequest;
  useEffect(() => {
    if (!addRequest || handledAddRequest.current === addRequest) return;
    handledAddRequest.current = addRequest;
    setUploadSheetVisible(true);
    router.replace('/(tabs)');
  }, [addRequest]);

  useEffect(() => {
    if (!pendingDialog) return;
    const timer = setTimeout(() => {
      if (pendingDialog === 'youtube') setYoutubeDialogVisible(true);
      setPendingDialog(null);
    }, motion.duration.deliberate);
    return () => clearTimeout(timer);
  }, [pendingDialog]);

  // ---- Pages -------------------------------------------------------------

  const pages = useMemo<SubjectPage[]>(
    () => [
      { key: ALL_PAGE_KEY, label: t('전체') },
      // Saved materials need somewhere to live: the bookmark on a material is
      // otherwise a state with no screen. The page appears once there is one
      // to show, so a new account never sees an empty tab.
      ...(savedMaterialIds.length
        ? [{ key: SAVED_PAGE_KEY, label: t('저장함'), savedOnly: true as const }]
        : []),
      ...projects.map((project) => ({
        key: project.id,
        label: project.title,
        projectId: project.id,
      })),
    ],
    [projects, savedMaterialIds.length, t],
  );
  const safePageIndex = Math.min(pageIndex, pages.length - 1);
  const currentPage = pages[safePageIndex] ?? pages[0];
  const selectedProjectId = currentPage?.projectId;

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  /** Materials per page after the saved switch and sort; before status. */
  const subjectMaterialsByPage = useMemo(() => {
    const savedSet = new Set(savedMaterialIds);
    const base = sortMaterials(
      filters.savedOnly
        ? materials.filter((material) => savedSet.has(material.id))
        : materials,
      filters.sort,
    );
    const byPage = new Map<string, StudyMaterial[]>();
    byPage.set(ALL_PAGE_KEY, base);
    for (const page of pages) {
      if (page.savedOnly) {
        byPage.set(page.key, base.filter((material) => savedSet.has(material.id)));
      } else if (page.projectId) {
        byPage.set(
          page.key,
          base.filter((material) => material.projectId === page.projectId),
        );
      }
    }
    return byPage;
  }, [filters.savedOnly, filters.sort, materials, pages, savedMaterialIds]);

  /**
   * The strip, with how much each page holds. The count is the cheapest
   * possible chart: it turns "인공지능 개론" from a name into a place with a
   * size, and it is the answer to the question a tap was previously needed
   * to ask. It follows the 저장함 switch, so it always matches the list under it.
   */
  const subjectTabs = useMemo<SubjectTab[]>(
    () =>
      pages.map((page) => ({
        key: page.key,
        label: page.label,
        count: subjectMaterialsByPage.get(page.key)?.length ?? 0,
      })),
    [pages, subjectMaterialsByPage],
  );

  const visibleMaterialsByPage = useMemo(() => {
    const byPage = new Map<string, StudyMaterial[]>();
    for (const [key, list] of subjectMaterialsByPage) {
      byPage.set(
        key,
        filters.status === 'all'
          ? list
          : list.filter((material) => matchesStatus(material, filters.status)),
      );
    }
    return byPage;
  }, [filters.status, subjectMaterialsByPage]);

  const currentSubjectMaterials =
    subjectMaterialsByPage.get(currentPage?.key ?? ALL_PAGE_KEY) ?? [];
  const readyCount = currentSubjectMaterials.filter(
    (material) => material.status === 'ready',
  ).length;
  const activeCount = currentSubjectMaterials.filter((material) =>
    ['imported', 'queued', 'transcribing', 'generating'].includes(material.status),
  ).length;
  const failedCount = currentSubjectMaterials.filter(
    (material) => material.status === 'failed',
  ).length;
  const statusOptions = useMemo(
    () => [
      {
        value: 'all' as const,
        label: t('전체'),
        accessibilityLabel: t('전체 {n}개', { n: currentSubjectMaterials.length }),
      },
      {
        value: 'ready' as const,
        label: t('완료'),
        accessibilityLabel: t('완료 {n}개', { n: readyCount }),
      },
      {
        value: 'processing' as const,
        label: t('진행 중'),
        accessibilityLabel: t('진행 중 {n}개', { n: activeCount }),
      },
      ...(failedCount > 0 || filters.status === 'failed'
        ? [
            {
              value: 'failed' as const,
              label: t('확인 필요'),
              accessibilityLabel: t('확인 필요 {n}개', { n: failedCount }),
            },
          ]
        : []),
    ],
    [activeCount, currentSubjectMaterials.length, failedCount, filters.status, readyCount, t],
  );
  const narrowed = isNarrowed(filters);

  const commitPage = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, pages.length - 1));
      pageIndexRef.current = clamped;
      setPageIndex(clamped);
      const projectId = pages[clamped]?.projectId;
      if (projectId) selectProject(projectId);
    },
    [pages, selectProject],
  );

  const goToPage = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, pages.length - 1));
      if (clamped === pageIndexRef.current) return;
      programmaticTarget.current = clamped;
      if (programmaticTimer.current) clearTimeout(programmaticTimer.current);
      programmaticTimer.current = setTimeout(() => {
        programmaticTarget.current = null;
      }, motion.duration.deliberate * 2);
      commitPage(clamped);
      // By offset, not by index. `scrollToIndex` needs the item to be laid out
      // already and quietly does nothing when it is not — which is exactly the
      // case right after a folder is created, since the tab is added and jumped
      // to in the same beat. The underline moved and the pages did not, so the
      // strip named one folder while another folder's list was on screen.
      // Pages are a fixed width, so the offset is exact and always valid.
      pagerRef.current?.scrollToOffset({
        animated: true,
        offset: clamped * pageWidth,
      });
    },
    [commitPage, pageWidth, pages.length],
  );

  useEffect(
    () => () => {
      if (programmaticTimer.current) clearTimeout(programmaticTimer.current);
    },
    [],
  );

  const handlePagerScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      const index = Math.round(x / pageWidth);
      // Offsets come back in fractional dp on Android; 2pt is "on the page".
      const settled = Math.abs(x - index * pageWidth) < 2;
      if (programmaticTarget.current !== null) {
        if (settled && index === programmaticTarget.current) {
          programmaticTarget.current = null;
        }
        return;
      }
      if (settled && index !== pageIndexRef.current) commitPage(index);
    },
    [commitPage, pageWidth],
  );

  const handlePagerSettle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      programmaticTarget.current = null;
      const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      if (index !== pageIndexRef.current) commitPage(index);
    },
    [commitPage, pageWidth],
  );

  /**
   * Keep the pages under the strip whenever the geometry changes: a rotation
   * changes the width, and adding or removing a folder changes what each
   * offset points at. Without the second the strip and the pages drift apart
   * silently, which is worse than either being wrong on its own.
   */
  useEffect(() => {
    if (
      previousPageWidth.current === pageWidth &&
      previousPageCount.current === pages.length
    ) {
      return;
    }
    previousPageWidth.current = pageWidth;
    previousPageCount.current = pages.length;
    pagerRef.current?.scrollToOffset({
      animated: false,
      offset: pageIndexRef.current * pageWidth,
    });
  }, [pageWidth, pages.length]);

  // A page that disappears (deleted project) leaves the index past the end.
  useEffect(() => {
    if (pageIndexRef.current > pages.length - 1) {
      commitPage(pages.length - 1);
      pagerRef.current?.scrollToIndex({ animated: false, index: pages.length - 1 });
    }
  }, [commitPage, pages.length]);

  // After creating a project, page to it once its tab exists.
  useEffect(() => {
    if (!focusProjectId) return;
    const index = pages.findIndex((page) => page.projectId === focusProjectId);
    if (index < 0) return;
    setFocusProjectId(null);
    goToPage(index);
  }, [focusProjectId, goToPage, pages]);

  // ---- Onboarding --------------------------------------------------------

  const hasMaterial = materials.length > 0;
  const hasReadyMaterial = materials.some((material) => material.status === 'ready');
  const hasLensReport = materials.some((material) => Boolean(material.lensReport));
  const checklistDone = [hasMaterial, hasReadyMaterial, hasLensReport].filter(
    Boolean,
  ).length;
  const showChecklist = !settings.homeChecklistDismissed && checklistDone < 3;

  // The desktop overview: the whole library, whatever folder is selected.
  const displayName = session?.user.name?.trim() || t('PREMIND 사용자');
  const libraryReadyCount = materials.filter((material) => material.status === 'ready').length;
  const libraryActiveCount = materials.filter((material) =>
    ['imported', 'queued', 'transcribing', 'generating'].includes(material.status),
  ).length;
  const continueMaterial = useMemo(
    () =>
      sortMaterials(
        materials.filter((material) => material.status === 'ready'),
        'recent',
      )[0],
    [materials],
  );

  // ---- Actions -----------------------------------------------------------

  const openMaterial = useCallback((material: StudyMaterial) => {
    if (material.status === 'ready') {
      router.push({
        pathname: '/material/[id]',
        params: { id: material.id },
      });
      return;
    }
    router.push({
      pathname: '/processing/[id]',
      params: { id: material.id },
    });
  }, []);

  const openMaterialMenu = useCallback((material: StudyMaterial) => {
    setSelectedMaterialId(material.id);
  }, []);

  const openImport = () => {
    setUploadSheetVisible(false);
    router.push({
      pathname: '/capture',
      params: selectedProjectId
        ? { mode: 'import', projectId: selectedProjectId }
        : { mode: 'import' },
    });
  };

  const openRecording = () => {
    router.push({
      pathname: '/record',
      params: selectedProjectId ? { projectId: selectedProjectId } : {},
    });
  };

  const openYoutubeDialog = () => {
    setYoutubeUrl('');
    setYoutubeError(null);
    if (uploadSheetVisible) {
      setUploadSheetVisible(false);
      setPendingDialog('youtube');
      return;
    }
    setYoutubeDialogVisible(true);
  };

  const closeYoutubeDialog = () => {
    if (youtubeBusy) return;
    setYoutubeDialogVisible(false);
    setYoutubeError(null);
  };

  const submitYoutube = async () => {
    const url = youtubeUrl.trim();
    if (!parseYouTubeId(url)) {
      setYoutubeError(t('공개 유튜브 영상 주소를 확인해 주세요.'));
      return;
    }
    const projectId = selectedProjectId ?? activeProjectId ?? projects[0]?.id;
    if (!projectId) {
      setYoutubeError(t('먼저 폴더를 만들어 주세요.'));
      return;
    }
    setYoutubeBusy(true);
    setYoutubeError(null);
    try {
      const material = await importYouTubeMaterial({ projectId, url });
      setYoutubeBusy(false);
      setYoutubeDialogVisible(false);
      setYoutubeUrl('');
      router.push({ pathname: '/processing/[id]', params: { id: material.id } });
    } catch (error) {
      setYoutubeBusy(false);
      setYoutubeError(
        t(errorMessage(error, '링크를 가져오지 못했어요. 주소를 확인하고 다시 시도해 주세요.')),
      );
    }
  };

  const openProjectSheet = (event: GestureResponderEvent) => {
    if (Platform.OS === 'web') {
      const trigger = event.currentTarget as unknown as {
        focus?: () => void;
        isConnected?: boolean;
      } | null;
      projectSheetTrigger.current =
        trigger && typeof trigger.focus === 'function'
          ? (trigger as { focus: () => void; isConnected?: boolean })
          : null;
    }
    setProjectSheetVisible(true);
  };

  const closeProjectSheet = () => {
    setProjectSheetVisible(false);
    setProjectError(null);
  };

  const restoreProjectSheetFocus = () => {
    if (Platform.OS !== 'web') return;
    if (projectSheetTrigger.current?.isConnected !== false) {
      projectSheetTrigger.current?.focus();
      if (projectSheetTrigger.current) return;
    }
    document
      .querySelector<HTMLElement>(`[aria-label="${t('새 폴더')}"]`)
      ?.focus();
  };

  const submitProject = () => {
    const title = projectTitle.trim();
    if (!title) {
      setProjectError(t('폴더 이름을 입력해 주세요.'));
      return;
    }
    try {
      const project = createProject({
        title,
        courseName: courseName.trim() || undefined,
      });
      selectProject(project.id);
      setFocusProjectId(project.id);
      setProjectTitle('');
      setCourseName('');
      closeProjectSheet();
    } catch (error) {
      setProjectError(t(errorMessage(error, '폴더를 만들지 못했어요. 다시 시도해 주세요.')));
    }
  };

  const selectedMaterial = materials.find(
    (material) => material.id === selectedMaterialId,
  );
  const closeMaterialSheet = () => setSelectedMaterialId(null);

  const openSelectedMaterial = () => {
    if (!selectedMaterial) return;
    closeMaterialSheet();
    openMaterial(selectedMaterial);
  };


  const evaluateMaterial = async (material: StudyMaterial) => {
    if (material.lensReport) {
      router.push({ pathname: '/report/[id]', params: { id: material.id } });
      return;
    }
    if (material.status !== 'ready') {
      setNotice({
        title: t('아직 평가할 수 없어요'),
        message: t('마인드팩이 준비되면 평가할 수 있어요.'),
      });
      return;
    }
    try {
      const evaluated = await requestLens(material.id);
      router.push({ pathname: '/report/[id]', params: { id: evaluated.id } });
    } catch (error) {
      setNotice({
        title: t('평가를 시작하지 못했어요'),
        message: t(errorMessage(error, '잠시 후 다시 시도해 주세요.')),
      });
    }
  };

  const evaluateSelected = () => {
    if (!selectedMaterial) return;
    const material = selectedMaterial;
    closeMaterialSheet();
    // A notice is a modal too; let the sheet finish closing first.
    setTimeout(() => {
      void evaluateMaterial(material);
    }, motion.duration.deliberate);
  };

  /**
   * The material waiting to be filed somewhere else. Folders were creatable
   * but nothing could be put in one after the fact, so a material landed in
   * whichever folder happened to be active and stayed there.
   */
  const openMoveSheet = () => {
    if (!selectedMaterial) return;
    const material = selectedMaterial;
    closeMaterialSheet();
    setTimeout(() => setMoveTarget(material), motion.duration.deliberate);
  };

  const moveTo = async (projectId: string) => {
    const material = moveTarget;
    if (!material) return;
    setMoveTarget(null);
    if (material.projectId === projectId) return;
    try {
      await moveMaterial(material.id, projectId);
      const folder = projects.find((project) => project.id === projectId);
      toast.show(t('{folder}(으)로 옮겼어요', { folder: folder?.title ?? t.ctx('inline', '폴더') }));
    } catch (error) {
      setNotice({
        title: t('옮기지 못했어요'),
        message: t(error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.'),
      });
    }
  };

  const openRenameDialog = () => {
    if (!selectedMaterial) return;
    const material = selectedMaterial;
    closeMaterialSheet();
    setRenameTitle(material.title);
    setRenameError(null);
    setTimeout(() => setRenameTarget(material), motion.duration.deliberate);
  };

  const closeRenameDialog = () => {
    if (renameBusy) return;
    setRenameTarget(null);
    setRenameError(null);
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const title = renameTitle.trim();
    if (!title) {
      setRenameError(t('제목을 입력해 주세요.'));
      return;
    }
    if (title === renameTarget.title) {
      closeRenameDialog();
      return;
    }
    setRenameBusy(true);
    try {
      await renameMaterial(renameTarget.id, title);
      setRenameBusy(false);
      setRenameTarget(null);
    } catch (error) {
      setRenameBusy(false);
      setRenameError(t(errorMessage(error, '이름을 바꾸지 못했어요. 다시 시도해 주세요.')));
    }
  };

  const openDeleteDialog = () => {
    if (!selectedMaterial) return;
    const material = selectedMaterial;
    closeMaterialSheet();
    setTimeout(() => setDeleteTarget(material), motion.duration.deliberate);
  };

  const closeDeleteDialog = () => {
    if (deleteBusy) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteMaterial(deleteTarget.id);
      setDeleteBusy(false);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteBusy(false);
      setDeleteTarget(null);
      setTimeout(
        () =>
          setNotice({
            title: t('삭제하지 못했어요'),
            message: t(errorMessage(error, '잠시 후 다시 시도해 주세요.')),
          }),
        motion.duration.deliberate,
      );
    }
  };

  const selectedIsSaved = selectedMaterial
    ? savedMaterialIds.includes(selectedMaterial.id)
    : false;
  const toggleSelectedSaved = () => {
    if (!selectedMaterial) return;
    const wasSaved = savedMaterialIds.includes(selectedMaterial.id);
    toggleSavedMaterial(selectedMaterial.id);
    closeMaterialSheet();
    toast.show(t(wasSaved ? '저장을 해제했어요' : '저장함에 담았어요'));
  };

  const selectedIsEvaluating = selectedMaterial
    ? evaluatingMaterialIds.includes(selectedMaterial.id)
    : false;

  // ---- Page rendering ----------------------------------------------------

  const emptyTitle = t(
    filters.status !== 'all'
      ? '이 상태의 자료가 없어요'
      : filters.savedOnly
        ? '저장한 자료가 없어요'
        : '아직 자료가 없어요',
  );
  const emptyDescription = t(
    filters.status !== 'all'
      ? '필터를 바꾸면 다른 자료를 볼 수 있어요.'
      : filters.savedOnly
        ? '자료 메뉴에서 저장하면 여기에 모여요.'
        : '녹음하거나 파일을 올리면 대본, 요약, 마인드맵, 문제가 여기에 모여요',
  );
  const showEmptyAction = filters.status === 'all' && !filters.savedOnly;

  const renderPage = ({ item: page }: { item: SubjectPage }) => {
    const pageMaterials = visibleMaterialsByPage.get(page.key) ?? [];
    const pageTotal = subjectMaterialsByPage.get(page.key)?.length ?? 0;
    const isAllPage = page.key === ALL_PAGE_KEY;
    const checklist =
      isAllPage && showChecklist ? (
          <Card
            accessibilityLabel={t('시작하기 3단계, {done}/3 완료', { done: checklistDone })}
            padding={false}
            variant="soft"
          >
            <View style={styles.checklistRow}>
              <Pressable
                accessibilityHint={t('사용 가이드를 열어요')}
                accessibilityLabel={t('시작하기 3단계, {done}/3 완료', { done: checklistDone })}
                accessibilityRole="button"
                onPress={() => router.push('/guide')}
                style={({ pressed }) => [
                  styles.checklistMain,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View {...decorative} style={styles.checklistCount}>
                  <AppText tabular tone="brand" variant="badge">
                    {checklistDone}/3
                  </AppText>
                </View>
                <AppText numberOfLines={1} style={styles.flex} variant="itemTitle">
                  {t('시작하기 3단계')}
                </AppText>
                <ChevronRight
                  {...decorative}
                  color={colors.textFaint}
                  size={iconSizes.section}
                  strokeWidth={1.8}
                />
              </Pressable>
              <IconButton
                icon={X}
                iconSize={iconSizes.inline}
                label={t('안내 닫기')}
                onPress={() => updateSettings({ homeChecklistDismissed: true })}
                size="small"
              />
            </View>
          </Card>
      ) : null;
    const toolbar = (
        <View style={styles.toolbar}>
          <AppText
            numberOfLines={1}
            style={styles.count}
            tone="muted"
            variant="meta"
          >
            {materialCountLabel(
              pageTotal,
              pageMaterials.length,
              page.savedOnly ? { ...filters, savedOnly: true } : filters,
              t,
            )}
          </AppText>
          <Pressable
            accessibilityHint={t('정렬, 상태, 보기 방식을 바꿔요')}
            accessibilityLabel={
              narrowed
                ? t('{sort}, 필터 적용됨', { sort: t(SORT_LABELS[filters.sort]) })
                : t(SORT_LABELS[filters.sort])
            }
            accessibilityRole="button"
            hitSlop={spacing.sm}
            onPress={() => setFilterSheetVisible(true)}
            style={({ pressed }) => [styles.sortControl, pressed ? styles.pressed : null]}
          >
            <AppText numberOfLines={1} variant="label">
              {t(SORT_LABELS[filters.sort])}
            </AppText>
            <ChevronDown
              {...decorative}
              color={colors.textMuted}
              size={iconSizes.inline}
              strokeWidth={2.2}
            />
            {narrowed ? <View {...decorative} style={styles.sortDot} /> : null}
          </Pressable>
        </View>
    );
    const header = wide ? (
      <View style={styles.wideHeader}>
        <HomeDesktopHeader
          materialCount={materials.length}
          name={displayName}
          onNotifications={() => router.push('/notifications')}
          onSearch={() => router.push('/search')}
          readyCount={libraryReadyCount}
        />
        {hasMaterial ? (
          <HomeDesktopOverview
            continueFolder={
              continueMaterial
                ? projectById.get(continueMaterial.projectId)?.title ?? t('폴더 없음')
                : ''
            }
            continueMaterial={continueMaterial}
            onOpen={openMaterial}
            processing={libraryActiveCount}
            ready={libraryReadyCount}
            total={materials.length}
          />
        ) : null}
        {checklist}
        <View style={styles.wideFolders}>
          <FolderChips
            activeIndex={safePageIndex}
            onAddPress={openProjectSheet}
            onSelect={goToPage}
            tabs={subjectTabs}
          />
          {toolbar}
        </View>
      </View>
    ) : (
      <>
        {checklist}
        {toolbar}
      </>
    );
    const empty = (
      <EmptyState
        actionLabel={showEmptyAction ? t('녹음 시작') : undefined}
        actionVariant="primary"
        // The first-run state is the one that decides whether anyone stays, so
        // it gets the drawing of what the app makes. A list emptied by a
        // filter is a passing condition and keeps the quiet line icon.
        artwork={showEmptyAction ? <EmptyLibraryArtwork /> : undefined}
        description={emptyDescription}
        icon={FolderOpen}
        onAction={showEmptyAction ? openRecording : undefined}
        title={emptyTitle}
      />
    );

    return (
      <MaterialList
        cardWidth={cardWidth}
        columns={columns}
        empty={empty}
        evaluatingMaterialIds={evaluatingMaterialIds}
        grouped={isTablet}
        gutter={gutter}
        header={header}
        materials={pageMaterials}
        onMore={openMaterialMenu}
        onOpen={openMaterial}
        processingMaterialIds={processingMaterialIds}
        projectById={projectById}
        view={filters.view}
        width={pageWidth}
      />
    );
  };

  return (
    <>
      {wide ? (
        <Screen padded={false} safeAreaEdges={['top', 'left', 'right']} wide>
          <View
            onLayout={(event) => {
              const width = Math.round(event.nativeEvent.layout.width);
              if (width > 0) setMeasuredWidth(width);
            }}
            style={styles.pagerHost}
          >
            {currentPage ? renderPage({ item: currentPage }) : null}
          </View>
        </Screen>
      ) : (
      <Screen padded={false} safeAreaEdges={['top', 'left', 'right']}>
        <AppHeader
          brand
          right={
            <>
              <IconButton
                icon={Search}
                label={t('검색')}
                onPress={() => router.push('/search')}
              />
              <IconButton
                icon={Bell}
                label={t('알림')}
                onPress={() => router.push('/notifications')}
              />
            </>
          }
        />

        <AnimatedReveal distance={6}>
          <SubjectTabs
            activeIndex={safePageIndex}
            gutter={gutter}
            onAddPress={openProjectSheet}
            onSelect={goToPage}
            tabs={subjectTabs}
          />
        </AnimatedReveal>

        <View
          onLayout={(event) => {
            const width = Math.round(event.nativeEvent.layout.width);
            if (width > 0) setMeasuredWidth(width);
          }}
          style={styles.pagerHost}
        >
          <FlatList
            accessibilityLabel={t('폴더별 자료, {folder}. 좌우로 밀어 폴더를 바꿔요', { folder: currentPage?.label ?? t('전체') })}
            bounces={false}
            data={pages}
            extraData={visibleMaterialsByPage}
            getItemLayout={(_data, index) => ({
              index,
              length: pageWidth,
              offset: pageWidth * index,
            })}
            horizontal
            initialNumToRender={3}
            keyExtractor={pageKey}
            keyboardShouldPersistTaps="handled"
            onMomentumScrollEnd={handlePagerSettle}
            onScroll={handlePagerScroll}
            pagingEnabled
            ref={pagerRef}
            renderItem={renderPage}
            scrollEventThrottle={32}
            showsHorizontalScrollIndicator={false}
            style={styles.pager}
            windowSize={5}
          />
        </View>
      </Screen>
      )}

      <FilterSheet
        filters={filters}
        onChange={setFilters}
        onClose={() => setFilterSheetVisible(false)}
        savedCount={savedMaterialIds.length}
        statusOptions={statusOptions}
        visible={filterSheetVisible}
      />

      {/* Every way to start a 마인드팩, in one place. The tab bar's middle
          button opens this, so "어디서 올리지" has one answer. */}
      <BottomSheetModal
        description={t('녹음하거나 파일을 올리면 마인드팩이 만들어져요.')}
        onClose={() => setUploadSheetVisible(false)}
        scrollable={false}
        title={t('자료 추가')}
        visible={uploadSheetVisible}
      >
        <Card padding={false}>
          <ListRow
            accessibilityHint={t('바로 녹음을 시작해요')}
            leadingIcon={Mic}
            onPress={() => {
              setUploadSheetVisible(false);
              setTimeout(() => router.push('/record'), motion.duration.deliberate);
            }}
            subtitle={t('강의나 발표를 그 자리에서')}
            title={t('녹음하기')}
          />
          <ListRow
            accessibilityHint={t('파일 앱에서 골라요')}
            leadingIcon={FileText}
            onPress={openImport}
            subtitle={t('PDF, 슬라이드, 영상, 음성')}
            title={t('파일 올리기')}
          />
          <ListRow
            accessibilityHint={t('공개 유튜브 영상 주소를 붙여 넣어요')}
            divider={false}
            leadingIcon={Link2}
            onPress={openYoutubeDialog}
            subtitle={t('공개 영상 주소를 붙여 넣어요')}
            title={t('유튜브 링크')}
          />
        </Card>
      </BottomSheetModal>

      <BottomSheetModal
        description={t('이 자료를 담을 폴더를 골라요.')}
        onClose={() => setMoveTarget(null)}
        scrollable={false}
        testID="move-material-sheet"
        title={t('폴더 옮기기')}
        visible={moveTarget !== null}
      >
        {projects.length ? (
          <Card padding={false}>
            {projects.map((project, index) => {
              const current = project.id === moveTarget?.projectId;
              return (
                <ListRow
                  accessibilityHint={t(current ? '이미 이 폴더에 있어요.' : '이 폴더로 옮겨요.')}
                  compact
                  disabled={current}
                  divider={index < projects.length - 1}
                  key={project.id}
                  leadingIcon={FolderOpen}
                  onPress={() => void moveTo(project.id)}
                  showChevron={false}
                  subtitle={current ? t('지금 이 폴더에 있어요') : undefined}
                  title={project.title}
                  trailing={
                    current ? (
                      <Check
                        {...decorative}
                        color={colors.textMuted}
                        size={iconSizes.inline}
                        strokeWidth={2.5}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </Card>
        ) : (
          <EmptyState
            actionLabel={t('폴더 만들기')}
            compact
            description={t('자료를 담을 폴더가 아직 없어요')}
            icon={FolderOpen}
            onAction={() => {
              setMoveTarget(null);
              router.push({
                pathname: '/(tabs)/library',
                params: { newProject: Date.now().toString(36) },
              });
            }}
            title={t('폴더가 없어요')}
          />
        )}
      </BottomSheetModal>

      <BottomSheetModal
        description={
          selectedMaterial
            ? `${projectById.get(selectedMaterial.projectId)?.title ?? t('폴더 없음')} / ${formatMaterialLength(selectedMaterial.source.kind, selectedMaterial.source.durationMs, selectedMaterial.transcript.length)}`
            : undefined
        }
        onClose={closeMaterialSheet}
        scrollable={false}
        title={selectedMaterial?.title ?? t('자료 메뉴')}
        visible={Boolean(selectedMaterial)}
      >
        {selectedMaterial ? (
          <Card padding={false}>
            <ListRow
              compact
              leadingIcon={BookOpen}
              onPress={openSelectedMaterial}
              showChevron={false}
              title={t(selectedMaterial.status === 'ready' ? '마인드팩 열기' : '진행 상황 보기')}
            />
            <ListRow
              compact
              disabled={selectedMaterial.status !== 'ready' || selectedIsEvaluating}
              leadingIcon={BarChart3}
              onPress={evaluateSelected}
              showChevron={false}
              subtitle={
                selectedIsEvaluating
                  ? t('평가하고 있어요')
                  : selectedMaterial.lensReport
                    ? t('평가 결과 보기')
                    : undefined
              }
              title={t('평가하기')}
            />
            <ListRow
              compact
              leadingIcon={selectedIsSaved ? BookmarkCheck : Bookmark}
              onPress={() => toggleSelectedSaved()}
              showChevron={false}
              title={t(selectedIsSaved ? '저장 취소' : '저장하기')}
            />
            <ListRow
              compact
              leadingIcon={Pencil}
              onPress={openRenameDialog}
              showChevron={false}
              title={t('이름 바꾸기')}
            />
            <ListRow
              compact
              leadingIcon={FolderOpen}
              onPress={openMoveSheet}
              subtitle={
                projectById.get(selectedMaterial.projectId)?.title ?? t('폴더 없음')
              }
              title={t('폴더 옮기기')}
            />
            <ListRow
              compact
              divider={false}
              leadingIcon={Trash2}
              onPress={openDeleteDialog}
              showChevron={false}
              title={t('삭제')}
            />
          </Card>
        ) : null}
      </BottomSheetModal>

      <BottomSheetModal
        description={t('폴더별로 자료를 묶어 두면 찾기 쉬워요.')}
        footer={
          <View style={styles.sheetFooter}>
            <Button
              onPress={closeProjectSheet}
              style={styles.footerButton}
              variant="secondary"
            >
              {t('취소')}
            </Button>
            <Button
              onPress={submitProject}
              style={styles.footerButton}
              variant="primary"
            >
              {t('만들기')}
            </Button>
          </View>
        }
        onDismiss={restoreProjectSheetFocus}
        onClose={closeProjectSheet}
        title={t('새 폴더')}
        visible={projectSheetVisible}
      >
        <View style={styles.form}>
          <View style={styles.field}>
            <AppText tone="soft" variant="meta">
              {t('폴더 이름')}
            </AppText>
            <TextInput
              accessibilityLabel={t('폴더 이름')}
              autoFocus
              maxLength={60}
              onBlur={() => setProjectTitleFocused(false)}
              onChangeText={(value) => {
                setProjectTitle(value);
                setProjectError(null);
              }}
              onFocus={() => setProjectTitleFocused(true)}
              placeholder={t('예: 인공지능 개론')}
              placeholderTextColor={colors.textFaint}
              returnKeyType="next"
              style={[
                styles.input,
                inputReset,
                projectTitleFocused ? styles.inputFocused : null,
                projectError ? styles.inputInvalid : null,
              ]}
              value={projectTitle}
            />
          </View>
          <View style={styles.field}>
            <AppText tone="soft" variant="meta">
              {t('학기 (선택)')}
            </AppText>
            <TextInput
              accessibilityLabel={t('학기')}
              maxLength={80}
              onBlur={() => setCourseNameFocused(false)}
              onChangeText={setCourseName}
              onFocus={() => setCourseNameFocused(true)}
              onSubmitEditing={submitProject}
              placeholder={t('예: 2026학년도 2학기')}
              placeholderTextColor={colors.textFaint}
              returnKeyType="done"
              style={[
                styles.input,
                inputReset,
                courseNameFocused ? styles.inputFocused : null,
              ]}
              value={courseName}
            />
          </View>
          {projectError ? (
            <AppText accessibilityRole="alert" tone="negative" variant="meta">
              {projectError}
            </AppText>
          ) : null}
        </View>
      </BottomSheetModal>

      <Dialog
        cancel={{ label: t('취소'), onPress: closeYoutubeDialog, disabled: youtubeBusy }}
        confirm={{
          label: t('가져오기'),
          loading: youtubeBusy,
          onPress: () => void submitYoutube(),
        }}
        description={t('공개 영상 주소를 붙여 넣어 주세요. 영상은 내려받지 않아요.')}
        onRequestClose={closeYoutubeDialog}
        title={t('유튜브 링크')}
        visible={youtubeDialogVisible}
      >
        <AuthField
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          editable={!youtubeBusy}
          error={youtubeError}
          keyboardType="url"
          label={t('유튜브 주소')}
          onChangeText={(value) => {
            setYoutubeUrl(value);
            setYoutubeError(null);
          }}
          onSubmitEditing={() => void submitYoutube()}
          placeholder={YOUTUBE_PLACEHOLDER}
          returnKeyType="go"
          textContentType="URL"
          value={youtubeUrl}
        />
      </Dialog>

      <Dialog
        cancel={{ label: t('취소'), onPress: closeRenameDialog, disabled: renameBusy }}
        confirm={{
          label: t('저장'),
          loading: renameBusy,
          onPress: () => void submitRename(),
        }}
        onRequestClose={closeRenameDialog}
        title={t('이름 바꾸기')}
        visible={Boolean(renameTarget)}
      >
        <AuthField
          autoFocus
          editable={!renameBusy}
          error={renameError}
          label={t('제목')}
          maxLength={120}
          onChangeText={(value) => {
            setRenameTitle(value);
            setRenameError(null);
          }}
          onSubmitEditing={() => void submitRename()}
          placeholder={t('자료 제목')}
          returnKeyType="done"
          selectTextOnFocus
          value={renameTitle}
        />
      </Dialog>

      <Dialog
        cancel={{ label: t('취소'), onPress: closeDeleteDialog, disabled: deleteBusy }}
        confirm={{
          label: t('삭제'),
          loading: deleteBusy,
          onPress: () => void confirmDelete(),
        }}
        description={
          deleteTarget
            ? t('“{title}”의 원본, 대본, 마인드팩이 모두 지워져요. 되돌릴 수 없어요.', { title: deleteTarget.title })
            : undefined
        }
        onRequestClose={closeDeleteDialog}
        title={t('자료를 삭제할까요?')}
        visible={Boolean(deleteTarget)}
      />

      <Dialog
        confirm={{ label: t('확인'), onPress: () => setNotice(null) }}
        description={notice?.message}
        onRequestClose={() => setNotice(null)}
        title={notice?.title ?? ''}
        visible={Boolean(notice)}
      />

      <Toast bottom={spacing.xxxl} message={toast.message} />
    </>
  );
}

function pageKey(page: SubjectPage) {
  return page.key;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  wideHeader: {
    gap: spacing.xl,
  },
  // Chips wrap on the left; the count and sort control stay on one line
  // under them, so the grid's first row starts on a fixed edge.
  wideFolders: {
    gap: spacing.sm,
  },
  pagerHost: {
    flex: 1,
    minHeight: 0,
  },
  pager: {
    flex: 1,
  },
  checklistRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingRight: spacing.sm,
  },
  checklistMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 54,
    minWidth: 0,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
  },
  checklistCount: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: radii.full,
    flexShrink: 0,
    height: spacing.xl,
    justifyContent: 'center',
    minWidth: spacing.xxl,
    paddingHorizontal: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  // One quiet line: the count on the left, the sort control flush with the
  // right gutter. No chips; the control is text plus a chevron.
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: sizes.buttonSmall,
  },
  count: {
    flex: 1,
    minWidth: 0,
  },
  sortControl: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing.xxs,
    minHeight: sizes.buttonSmall,
  },
  // Marks a narrowed list (status filter or the saved switch).
  sortDot: {
    backgroundColor: colors.text,
    borderRadius: radii.full,
    height: 6,
    position: 'absolute',
    right: 0,
    top: spacing.xs,
    width: 6,
  },
  form: {
    gap: spacing.gutter,
  },
  field: {
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.input,
    borderWidth: 1,
    color: colors.text,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    letterSpacing: typography.body.letterSpacing,
    minHeight: sizes.input,
    paddingHorizontal: spacing.md,
  },
  inputFocused: {
    borderColor: colors.text,
  },
  inputInvalid: {
    borderColor: colors.negative,
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
});
