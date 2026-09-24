import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Bookmark,
  BookmarkCheck,
  BrainCircuit,
  ChevronRight,
  Clock3,
  FileText,
  Highlighter,
  ListTree,
  MessageCircle,
  MessageCircleQuestion,
  Search,
  Share2,
  Sparkles,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { AppHeader } from '@/components/AppHeader';
import { CardSession } from '@/components/cards';
import { DocumentPages } from '@/components/study/DocumentPages';
import { DocumentPageViewer } from '@/components/study/DocumentPageViewer';
import { HighlightableText } from '@/components/study/HighlightableText';
import { HighlightHint } from '@/components/study/HighlightHint';
import { HighlightList } from '@/components/study/HighlightList';
import { KeyPointChecklist } from '@/components/study/KeyPointChecklist';
import { LectureTimeline } from '@/components/study/LectureTimeline';
import { MindMap } from '@/components/study/MindMap';
import { PanelFade } from '@/components/study/PanelFade';
import { StudyStats } from '@/components/study/StudyStats';
import { SummaryOutline } from '@/components/study/SummaryOutline';
import { TimeChip } from '@/components/study/TimeChip';
import {
  TranscriptSectionMarker,
  withSectionMarkers,
} from '@/components/study/TranscriptSections';
import { useTabSwipe } from '@/components/study/useTabSwipe';
import { StudyPlayer } from '@/components/StudyPlayer';
import {
  YouTubePlayer,
  type YouTubePlayerHandle,
} from '@/components/YouTubePlayer';
import {
  AppText,
  AnimatedReveal,
  BottomSheetModal,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  ListRow,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatusBadge,
} from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatDuration, formatSourcePosition } from '@/lib/format';
import {
  countHighlighted,
  highlightedSentences,
  paintableParts,
  splitSentences,
  toggleHighlight,
  type SentenceSource,
} from '@/lib/highlights';
import { confusionQuestion } from '@/features/chat/confusion-question';
import { goBackOrReplace, type QuizOrigin } from '@/lib/navigation';
import { ApiError, apiClient } from '@/services/api/client';
import {
  isDemoSession,
  sessionManager,
} from '@/services/api/session-manager';
import { selectStudyNote, useAppStore } from '@/state/app-store';
import { inputReset } from '@/theme/input-reset';
import {
  colors,
  iconSizes,
  radii,
  sizes,
  spacing,
  typography,
} from '@/theme/tokens';
import type {
  ConfusionReason,
  OutlineSection,
  QuizAttempt,
  StudyMaterial,
  TranscriptSegment,
} from '@/types';

type DetailTab = 'summary' | 'transcript' | 'mindmap' | 'cards';
/** 요약 reads two ways: today's overview, or the lecture written out in full. */
type SummaryView = 'glance' | 'detail';

/**
 * Four tabs still fit flexed segments at 360dp: the strip is 320 wide, so each
 * segment is 77 and the longest label (마인드맵, 48pt in Pretendard Bold 14)
 * clears its 24pt of padding with room to spare. 암기 카드 belongs here rather
 * than only in 이해도 because a deck is made of one material.
 *
 * 요약 leads because it is what a reader wants the moment a 마인드팩 finishes:
 * the pack answers "what was this about" before it offers the full 대본.
 *
 * Asking questions is a screen of its own (`/chat/[id]`, reached from the
 * bottom bar) so its composer is never buried inside this scroll view under
 * the keyboard.
 */
const tabOptions = [
  { value: 'summary', label: '요약' },
  { value: 'transcript', label: '대본' },
  { value: 'mindmap', label: '마인드맵' },
  { value: 'cards', label: '카드' },
] as const;

/**
 * The 요약 switch. Only shown when the server wrote an outline for the
 * recording, so older 마인드팩 keep the panel they always had.
 */
const summaryViewOptions = [
  { value: 'glance', label: '한눈에 보기' },
  { value: 'detail', label: '자세히' },
] as const;

/** One shared empty list, so a 마인드팩 without an outline keeps a stable reference. */
const NO_OUTLINE: readonly OutlineSection[] = [];

/**
 * A horizontal swipe moves between all four tabs — except on 카드, where the
 * card answers a sideways swipe itself. Two pans over the same pixels would
 * have to be arbitrated, and losing that arbitration would mark a card the
 * learner never judged, so the tab swipe simply stands down while 카드 is
 * open and the segments are tapped instead.
 */
const swipeTabs: readonly DetailTab[] = ['summary', 'transcript', 'mindmap', 'cards'];
/** The 요약 timeline redraws at most once a second, not on every player tick. */
const TIMELINE_STEP_MS = 1000;

/** How long a reader's own scroll keeps the transcript from following playback. */
const MANUAL_SCROLL_HOLD_MS = 4000;
/** Scroll events inside this window after `scrollTo` are ours, not the reader's. */
const PROGRAMMATIC_SCROLL_WINDOW_MS = 1000;
const NOTICE_MS = 2200;
/** Room kept clear above the sticky action bar when the active row is placed. */
const BOTTOM_BAR_ALLOWANCE = 120;
/** List rows: 68 default, per the layout rules. */
const ROW_HEIGHT = 68;

interface RowLayout {
  y: number;
  height: number;
}

/** The segment the playhead is in, or the last one that started before it. */
function segmentAtPosition(
  transcript: readonly TranscriptSegment[],
  positionMs: number,
): TranscriptSegment | undefined {
  let match: TranscriptSegment | undefined;
  for (const segment of transcript) {
    if (segment.startMs > positionMs) break;
    match = segment;
  }
  return match;
}

/** The 대본 hint is a first-run line, so it needs no glossary of its own. */
const TRANSCRIPT_HINT = '문장을 길게 누르면 형광펜으로 칠해져요. 다시 누르면 지워져요.';

function shareText(
  material: StudyMaterial,
  painted: readonly SentenceSource[],
): string {
  const summary = material.note?.summary.trim() ?? '';
  const keyPoints = material.note?.keyPoints ?? [];
  const parts = [material.title];
  if (summary) parts.push(summary);
  if (keyPoints.length) {
    parts.push(keyPoints.map((point) => `• ${point}`).join('\n'));
  }
  // What the learner painted goes out with the summary: it is the part they
  // decided mattered.
  if (painted.length) {
    parts.push(
      [
        `형광펜 ${painted.length}개`,
        ...painted.map((item) => `• ${item.sentence}`),
      ].join('\n'),
    );
  }
  parts.push('PREMIND 마인드팩');
  return parts.join('\n\n');
}

/**
 * Why a passage did not land, and what the AI is then asked about it. The
 * quiz-only "문제와 설명이 달라요" is gone: a line of the 대본 has no question
 * to disagree with, and it was the one reason with no useful follow-up.
 */
const confusionReasons: readonly [ConfusionReason, string][] = [
  ['terminology', '용어가 어려워요'],
  ['needs-example', '예시가 더 필요해요'],
  ['too-fast', '설명이 너무 빨라요'],
  ['unclear', '무슨 말인지 모르겠어요'],
];

function authorizationHeader(source: {
  headers: Record<string, string>;
}): string | undefined {
  return Object.entries(source.headers).find(
    ([name]) => name.toLocaleLowerCase('en-US') === 'authorization',
  )?.[1];
}

export default function MaterialDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    tab?: string | string[];
    at?: string | string[];
  }>();
  const {
    materials,
    quizAttempts,
    reportConfusion,
    savedMaterialIds,
    session,
    settings,
    state: appState,
    toggleSavedMaterial,
    updateStudyNote,
  } = useAppStore();
  const { height: windowHeight } = useWindowDimensions();
  const material = materials.find((item) => item.id === params.id);
  const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const requestedPosition = Number(
    Array.isArray(params.at) ? params.at[0] : params.at,
  );
  // Without an explicit `?tab=`, a 마인드팩 opens on 요약: that is the answer
  // the reader came for, and the 대본 is one tap away when they want the words.
  const [tab, setTab] = useState<DetailTab>(() =>
    tabOptions.some((option) => option.value === requestedTab)
      ? (requestedTab as DetailTab)
      : 'summary',
  );
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [importantOnly, setImportantOnly] = useState(false);
  /**
   * Whether the 대본 shows the 요약 구간 headings. On by default: the breaks
   * are what makes a long transcript readable, and the chip is only offered
   * when the material has an outline to place.
   */
  const [sectionsOn, setSectionsOn] = useState(true);
  /** Which way 요약 is being read. One screen is one material, so this is per material. */
  const [summaryView, setSummaryView] = useState<SummaryView>('glance');
  /** Show only the 대본 lines that hold a painted sentence. */
  const [paintedOnly, setPaintedOnly] = useState(false);
  /** Whether the learner has waved the 대본's 형광펜 line away this visit. */
  const [hintDismissed, setHintDismissed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [seekPosition, setSeekPosition] = useState(() =>
    Number.isFinite(requestedPosition) && requestedPosition >= 0
      ? requestedPosition
      : 0,
  );
  const [playerKey, setPlayerKey] = useState(0);
  /**
   * Whether the 대본 shows each page's one-line summary instead of its full
   * text. Off by default: the page text is the source, and a reader who opened
   * 대본 asked for what is actually on the page. Documents only.
   */
  const [pageSummaryOn, setPageSummaryOn] = useState(false);
  /** The page open full screen in the document viewer, or null when closed. */
  const [viewerPage, setViewerPage] = useState<number | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  /** The playhead as the 요약 timeline shows it: whole seconds, only while that tab is open. */
  const [timelinePositionMs, setTimelinePositionMs] = useState(seekPosition);
  const [confusionSegmentId, setConfusionSegmentId] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const youtubeRef = useRef<YouTubePlayerHandle>(null);
  const positionRef = useRef(seekPosition);
  const tabRef = useRef<DetailTab>(tab);
  const timelinePositionRef = useRef(seekPosition);
  const activeSegmentRef = useRef<string | null>(null);
  const rowLayouts = useRef(new Map<string, RowLayout>());
  /** Where each 요약 구간 sits inside the 자세히 card, by its `startMs`. */
  const outlineRowY = useRef(new Map<number, number>());
  const outlineCardY = useRef(0);
  /** The 구간 tapped in the 대본, until its row in 자세히 has been reached. */
  const pendingSectionMs = useRef<number | null>(null);
  const panelY = useRef(0);
  const transcriptCardY = useRef(0);
  const scrollOffset = useRef(0);
  const viewportHeight = useRef(windowHeight);
  const manualScrollUntil = useRef(0);
  const programmaticScrollUntil = useRef(0);
  const followedSegmentId = useRef<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transcript = material?.transcript;
  const markers = material?.markers;
  const importantSegmentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const segment of transcript ?? []) {
      const marked = (markers ?? []).some(
        (marker) =>
          marker.timestampMs >= segment.startMs && marker.timestampMs <= segment.endMs,
      );
      if (segment.isImportant || marked) ids.add(segment.id);
    }
    return ids;
  }, [markers, transcript]);

  const filteredTranscript = useMemo(() => {
    if (!material) return [];
    const query = search.trim().toLocaleLowerCase('ko-KR');
    let segments = query
      ? material.transcript.filter((segment) => segment.text.toLocaleLowerCase('ko-KR').includes(query))
      : material.transcript;
    if (importantOnly) {
      segments = segments.filter((segment) => importantSegmentIds.has(segment.id));
    }
    return segments;
  }, [importantOnly, importantSegmentIds, material, search]);

  const notebook = selectStudyNote(appState, material?.id ?? '');
  const highlights = notebook.highlights;
  /**
   * Every stroke of this 마인드팩, in reading order and with the moment it was
   * said: the 형광펜 list, the share text and the deck all read this one list.
   */
  const painted = useMemo(
    () =>
      material ? highlightedSentences(paintableParts(material), highlights) : [],
    [highlights, material],
  );
  /** How many painted sentences the transcript now on screen still holds. */
  const transcriptHighlightCount = useMemo(
    () =>
      countHighlighted(
        filteredTranscript.flatMap((segment) => splitSentences(segment.text)),
        highlights,
      ),
    [filteredTranscript, highlights],
  );
  // A search that hides every painted line would leave the filter chip
  // pointing at nothing, so the filter only bites while it has something.
  const transcriptPaintedOnly = paintedOnly && transcriptHighlightCount > 0;
  /**
   * Whether the 대본 has ever been painted. The 형광펜 line stays until it has
   * been used or waved away — a search that hides every stroke must not bring
   * the lesson back.
   */
  const transcriptPaintedTotal = useMemo(
    () =>
      countHighlighted(
        (material?.transcript ?? []).flatMap((segment) => splitSentences(segment.text)),
        highlights,
      ),
    [highlights, material],
  );
  const visibleTranscript = useMemo(
    () =>
      transcriptPaintedOnly
        ? filteredTranscript.filter(
            (segment) => countHighlighted(splitSentences(segment.text), highlights) > 0,
          )
        : filteredTranscript,
    [filteredTranscript, highlights, transcriptPaintedOnly],
  );
  const outline = material?.outline ?? NO_OUTLINE;
  /**
   * The 대본 list with the 요약 구간 laid in by timestamp. Placing them by the
   * clock rather than by matching words is why this works at all: the model
   * writes headings the lecture never says out loud.
   */
  const transcriptRows = useMemo(
    () => withSectionMarkers(visibleTranscript, sectionsOn ? outline : NO_OUTLINE),
    [outline, sectionsOn, visibleTranscript],
  );

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  /** Mirrors the playhead into the transcript without re-rendering per tick. */
  const handlePositionChange = useCallback(
    (positionMs: number) => {
      positionRef.current = positionMs;
      if (tabRef.current === 'summary') {
        const stepped = Math.floor(positionMs / TIMELINE_STEP_MS) * TIMELINE_STEP_MS;
        if (stepped !== timelinePositionRef.current) {
          timelinePositionRef.current = stepped;
          setTimelinePositionMs(stepped);
        }
      }
      if (!transcript?.length) return;
      const nextId = segmentAtPosition(transcript, positionMs)?.id ?? null;
      if (nextId !== activeSegmentRef.current) {
        activeSegmentRef.current = nextId;
        setActiveSegmentId(nextId);
      }
    },
    [transcript],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.y;
      if (Date.now() > programmaticScrollUntil.current) {
        manualScrollUntil.current = Date.now() + MANUAL_SCROLL_HOLD_MS;
      }
    },
    [],
  );

  const handleScrollBeginDrag = useCallback(() => {
    manualScrollUntil.current = Date.now() + MANUAL_SCROLL_HOLD_MS;
  }, []);

  const scrollTo = useCallback((y: number) => {
    programmaticScrollUntil.current = Date.now() + PROGRAMMATIC_SCROLL_WINDOW_MS;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
  }, []);

  /**
   * A 구간 tapped in the 대본 opens 요약 자세히 and brings that section to the
   * top of the screen. The tap only records which one to look for: switching
   * tabs remounts the panel, so the scroll waits for the section to report
   * where it landed.
   */
  const openSection = useCallback((section: OutlineSection) => {
    pendingSectionMs.current = section.startMs;
    setSummaryView('detail');
    setTab('summary');
  }, []);

  /** Runs from either half of the outline's layout, whichever lands last. */
  const focusPendingSection = useCallback(() => {
    const startMs = pendingSectionMs.current;
    if (startMs === null) return;
    const y = outlineRowY.current.get(startMs);
    if (y === undefined) return;
    // Wait a frame so the card and panel offsets from the same layout pass
    // have landed too.
    requestAnimationFrame(() => {
      if (pendingSectionMs.current !== startMs) return;
      pendingSectionMs.current = null;
      scrollTo(panelY.current + outlineCardY.current + y - spacing.md);
    });
  }, [scrollTo]);

  const handleOutlineLayout = useCallback(
    (y: number) => {
      outlineCardY.current = y;
      focusPendingSection();
    },
    [focusPendingSection],
  );

  const handleOutlineSectionLayout = useCallback(
    (startMs: number, y: number) => {
      outlineRowY.current.set(startMs, y);
      focusPendingSection();
    },
    [focusPendingSection],
  );

  /**
   * Brings the active line just under the top edge of the viewport unless it
   * is already in view or the reader has just scrolled on their own. Returns
   * whether the row's layout was known; callers retry from `onLayout` when it
   * was not. The tab row scrolls with the content, so nothing is pinned above
   * the line it lands on.
   */
  const followSegment = useCallback(
    (segmentId: string) => {
      const row = rowLayouts.current.get(segmentId);
      if (!row) return false;
      followedSegmentId.current = segmentId;
      if (Date.now() < manualScrollUntil.current) return true;
      const absoluteY = panelY.current + transcriptCardY.current + row.y;
      const visibleTop = scrollOffset.current + spacing.md;
      const visibleBottom =
        scrollOffset.current + viewportHeight.current - BOTTOM_BAR_ALLOWANCE;
      if (absoluteY >= visibleTop && absoluteY + row.height <= visibleBottom) {
        return true;
      }
      scrollTo(absoluteY - spacing.md);
      return true;
    },
    [scrollTo],
  );

  // The timeline only follows playback while it is on screen; catch it up
  // when the 요약 tab opens.
  useEffect(() => {
    tabRef.current = tab;
    if (tab !== 'summary') return;
    const stepped = Math.floor(positionRef.current / TIMELINE_STEP_MS) * TIMELINE_STEP_MS;
    timelinePositionRef.current = stepped;
    setTimelinePositionMs(stepped);
  }, [tab]);

  // The card owns sideways touches while 카드 is open; see `swipeTabs`.
  const swipeGesture = useTabSwipe<DetailTab>({
    enabled: tab !== 'cards',
    onChange: setTab,
    tabs: swipeTabs,
    value: tab,
  });

  // Keep the active line in view while the lecture plays.
  useEffect(() => {
    if (tab !== 'transcript' || !activeSegmentId) return;
    followedSegmentId.current = null;
    followSegment(activeSegmentId);
  }, [activeSegmentId, followSegment, tab]);

  /** Rows report layout after the effect above; the active one follows late. */
  const handleRowLayout = useCallback(
    (segmentId: string, layout: RowLayout) => {
      rowLayouts.current.set(segmentId, layout);
      if (
        segmentId === activeSegmentRef.current &&
        followedSegmentId.current !== segmentId
      ) {
        // Wait a frame so the card and panel offsets from the same layout
        // pass have landed too.
        requestAnimationFrame(() => {
          if (followedSegmentId.current !== segmentId) followSegment(segmentId);
        });
      }
    },
    [followSegment],
  );

  const serverRecordingId = material?.serverRecordingId;
  const accessToken =
    session && !isDemoSession(session) ? session.accessToken : null;
  /**
   * The rendered image for one page, when the server made them. A slide deck
   * and any document processed before rendering existed have none, and the
   * page cards fall back to the extracted text.
   */
  const renderedPageCount = material?.pageImageCount ?? 0;
  const pageImage = useCallback(
    (page: number) => {
      if (!serverRecordingId || !accessToken || page > renderedPageCount) {
        return undefined;
      }
      return apiClient.recordingPageSource(accessToken, serverRecordingId, page);
    },
    [accessToken, renderedPageCount, serverRecordingId],
  );

  const fallbackSource = useMemo(() => {
    if (!serverRecordingId || !accessToken) return undefined;
    const initialSource = apiClient.recordingMediaSource(
      accessToken,
      serverRecordingId,
    );
    return {
      ...initialSource,
      refresh: (rejectedSource: typeof initialSource) =>
        sessionManager.authorize(async (freshAccessToken) => {
          const freshSource = apiClient.recordingMediaSource(
            freshAccessToken,
            serverRecordingId,
          );
          if (
            authorizationHeader(freshSource) ===
            authorizationHeader(rejectedSource)
          ) {
            // The worker already received a 401 for this exact credential.
            // Surface that fact through authorize so it rotates the session
            // once, even when the device clock still considers the token valid.
            throw new ApiError('재생 연결을 다시 받아야 해요.', {
              status: 401,
            });
          }
          return freshSource;
        }),
    };
  }, [accessToken, serverRecordingId]);

  if (!material) {
    return (
      <Screen padded={false}>
        <AppHeader onBack={() => goBackOrReplace('/(tabs)/library')} title="마인드팩" />
        <ErrorState description="이 자료를 찾을 수 없어요. 내 자료에서 다시 골라 주세요." onRetry={() => router.replace('/(tabs)/library')} retryLabel="내 자료 보기" />
      </Screen>
    );
  }

  const saved = savedMaterialIds.includes(material.id);

  const youtubeId =
    material.source.origin === 'link' ? material.source.youtubeId : undefined;
  /** An uploaded PDF or slide deck: pages instead of audio, so no player. */
  const isDocument = material.source.kind === 'document';
  const pageCount = isDocument ? material.transcript.length : 0;
  const hasPageSummaries =
    isDocument && material.transcript.some((segment) => segment.summary);

  const jumpTo = (timestampMs: number) => {
    if (youtubeId) {
      // The embed keeps playing; a remount would reload the video.
      youtubeRef.current?.seekTo(timestampMs);
    } else {
      setSeekPosition(timestampMs);
      setPlayerKey((value) => value + 1);
    }
    handlePositionChange(timestampMs);
    void Haptics.selectionAsync();
  };

  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  };

  /**
   * Saving is otherwise silent: the icon swaps and nothing else happens, so a
   * tap reads as if it missed. The toast says which way it went, and where to
   * find what was saved.
   */
  const toggleSaved = () => {
    toggleSavedMaterial(material.id);
    void Haptics.selectionAsync();
    showNotice(saved ? '저장을 해제했어요' : '저장했어요. 홈의 저장한 자료에서 볼 수 있어요');
  };

  const shareSummary = async () => {
    const message = shareText(material, painted);
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(message);
      showNotice('요약을 복사했어요');
      return;
    }
    try {
      await Share.share({ message, title: material.title });
    } catch {
      await Clipboard.setStringAsync(message);
      showNotice('요약을 복사했어요');
    }
  };

  const openCitation = (timestampMs: number) => {
    setTab('transcript');
    jumpTo(timestampMs);
  };

  /** One stroke of the 형광펜, kept in the learner's notebook for this material. */
  const paintSentence = (sentence: string) => {
    updateStudyNote(material.id, {
      highlights: toggleHighlight(highlights, sentence),
    });
    void Haptics.selectionAsync();
  };

  const openChat = () => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: material.id, focus: '1' },
    });
  };

  /**
   * Saying "여기가 헷갈려요" used to file the reason into local state and
   * close the sheet. Nothing read that state and nothing appeared on screen,
   * so the reader said they were stuck and the app said nothing back. Now it
   * asks about that exact passage and takes them to the answer.
   */
  const submitConfusion = (reason: ConfusionReason) => {
    const segment = material.transcript.find(
      (candidate) => candidate.id === confusionSegmentId,
    );
    reportConfusion(material.id, reason, confusionSegmentId ?? undefined);
    setConfusionSegmentId(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: material.id,
        ask: confusionQuestion(reason, segment?.text ?? ''),
      },
    });
  };


  if (material.status !== 'ready') {
    return (
      <Screen padded={false}>
        <AppHeader onBack={() => goBackOrReplace('/(tabs)/library')} title={material.title} />
        <View style={styles.notReady}>
          <EmptyState
            actionLabel={material.status === 'imported' || material.status === 'failed' ? '마인드팩 만들기' : '진행 보기'}
            description="원본은 안전하게 있어요. 마인드팩을 만들면 대본과 요약이 여기에 생겨요."
            icon={Sparkles}
            onAction={() => router.replace({ pathname: '/processing/[id]', params: { id: material.id } })}
            title={material.status === 'imported' ? '아직 마인드팩이 없어요' : '마인드팩을 만들고 있어요'}
          />
        </View>
      </Screen>
    );
  }

  const concepts = material.note?.concepts ?? [];
  const keyPoints = material.note?.keyPoints ?? [];

  return (
    <Screen padded={false}>
      <AppHeader
        onBack={() => goBackOrReplace('/(tabs)/library')}
        right={
          <View style={styles.headerActions}>
            <IconButton
              icon={saved ? BookmarkCheck : Bookmark}
              label={saved ? '저장 취소' : '저장'}
              onPress={toggleSaved}
            />
            <IconButton
              icon={Share2}
              label="요약 공유"
              onPress={() => void shareSummary()}
            />
          </View>
        }
        title={material.title}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onLayout={(event: LayoutChangeEvent) => {
          viewportHeight.current = event.nativeEvent.layout.height;
        }}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        ref={scrollRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {/* A document has nothing to play, so the player block becomes the
            pages themselves: swipe them, tap one to open it in the 대본. */}
        {isDocument ? (
          <View style={[styles.block, styles.playerBlock]}>
            <AnimatedReveal>
              {pageCount > 0 ? (
                <DocumentPages
                  onOpenPage={setViewerPage}
                  pageImage={pageImage}
                  segments={material.transcript}
                />
              ) : (
                <Card style={styles.documentCard} variant="soft">
                  <FileText
                    {...decorative}
                    color={colors.textMuted}
                    size={iconSizes.section}
                    strokeWidth={1.9}
                  />
                  <AppText style={styles.flex} tone="muted" variant="meta">
                    올린 문서를 읽었어요.
                  </AppText>
                </Card>
              )}
            </AnimatedReveal>
          </View>
        ) : (
        <View style={[styles.block, styles.playerBlock]}>
          <AnimatedReveal>
            {youtubeId ? (
              <YouTubePlayer
                durationMs={material.source.durationMs}
                initialPositionMs={seekPosition}
                onPositionChange={handlePositionChange}
                ref={youtubeRef}
                title={material.title}
                videoId={youtubeId}
              />
            ) : (
              <StudyPlayer
                durationMs={material.source.durationMs}
                fallbackSource={fallbackSource}
                initialPositionMs={seekPosition}
                key={playerKey}
                kind={material.source.kind}
                onPositionChange={handlePositionChange}
                title={material.title}
                uri={material.source.uri}
              />
            )}
          </AnimatedReveal>
        </View>
        )}

        <View style={styles.tabsBlock}>
          <SegmentedControl<DetailTab>
            onChange={setTab}
            options={tabOptions}
            value={tab}
          />
        </View>

        <View
          onLayout={(event: LayoutChangeEvent) => {
            panelY.current = event.nativeEvent.layout.y;
          }}
          style={[styles.block, styles.panelBlock]}
        >
        {/* One GestureHandlerRootView per app, at the root layout. The
            detector hangs off a plain view so the ScrollView above keeps
            sole charge of vertical touches; `pan-y` keeps mobile web the same. */}
        <GestureDetector gesture={swipeGesture} touchAction="pan-y">
        <View collapsable={false}>
        <PanelFade key={tab}>
        {tab === 'summary' ? (
          <SummaryPanel
            attempts={quizAttempts}
            checkedPoints={notebook.checkedPoints}
            highlights={highlights}
            jumpTo={jumpTo}
            material={material}
            onCheckedPointsChange={(checkedPoints) =>
              updateStudyNote(material.id, { checkedPoints })
            }
            onOutlineLayout={handleOutlineLayout}
            onPaintSentence={paintSentence}
            onSectionLayout={handleOutlineSectionLayout}
            onSummaryViewChange={setSummaryView}
            painted={painted}
            positionMs={timelinePositionMs}
            summaryView={summaryView}
          />
        ) : null}

        {tab === 'mindmap' ? (
          <View style={styles.panel}>
            <MindMap
              concepts={concepts}
              keyPoints={keyPoints}
              onListen={openCitation}
              page={isDocument}
              title={material.title}
            />
          </View>
        ) : null}

        {/* The same session `/cards/[id]` shows, on the material it belongs
            to: a deck is made of one 마인드팩 and of what was painted in it. */}
        {tab === 'cards' ? (
          <CardSession
            highlights={highlights}
            layout="panel"
            material={material}
            onSeek={openCitation}
          />
        ) : null}

        {tab === 'transcript' ? (
          <View style={styles.panel}>
            <View
              style={[
                styles.searchShell,
                searchFocused ? styles.searchShellFocused : null,
              ]}
            >
              <Search
                {...decorative}
                color={colors.textFaint}
                size={iconSizes.inline}
                strokeWidth={2}
              />
              <TextInput
                accessibilityLabel="대본 검색"
                onChangeText={setSearch}
                onBlur={() => setSearchFocused(false)}
                onFocus={() => setSearchFocused(true)}
                placeholder="대본에서 검색"
                placeholderTextColor={colors.textFaint}
                style={[styles.searchInput, inputReset]}
                value={search}
              />
            </View>
            <View style={styles.transcriptTools}>
              <Chip
                accessibilityHint="중요 표시한 문장만 보여줘요."
                label="중요만"
                onPress={() => setImportantOnly((value) => !value)}
                selected={importantOnly}
              />
              {/* Only offered when the server wrote an outline: with nothing
                  to place, the chip would be a control that does nothing. */}
              {outline.length ? (
                <Chip
                  accessibilityHint={
                    sectionsOn
                      ? '대본에서 구간 제목을 숨겨요.'
                      : '대본에 구간 제목을 넣어요.'
                  }
                  accessibilityLabel={`구간 표시 ${sectionsOn ? '켬' : '끔'}`}
                  icon={ListTree}
                  label="구간"
                  onPress={() => setSectionsOn((value) => !value)}
                  selected={sectionsOn}
                  testID="transcript-sections-chip"
                />
              ) : null}
              {/* A document's 대본 is its pages printed in full, which is the
                  right thing to have and the wrong thing to skim. Only offered
                  when the server actually wrote the page lines. */}
              {hasPageSummaries ? (
                <Chip
                  accessibilityHint={
                    pageSummaryOn
                      ? '쪽 전체 내용을 다시 보여줘요.'
                      : '쪽마다 한 줄 요약만 보여줘요.'
                  }
                  accessibilityLabel={`쪽 요약 ${pageSummaryOn ? '켬' : '끔'}`}
                  icon={FileText}
                  label="쪽 요약"
                  onPress={() => setPageSummaryOn((value) => !value)}
                  selected={pageSummaryOn}
                  testID="transcript-page-summary-chip"
                />
              ) : null}
            </View>
            {/* Once there are strokes the row filters down to them; until
                then it says how to make one. Never both. */}
            {transcriptHighlightCount > 0 ? (
              <Chip
                accessibilityHint={
                  transcriptPaintedOnly
                    ? '대본 전체를 다시 보여줘요.'
                    : '칠한 문장이 있는 줄만 보여줘요.'
                }
                icon={Highlighter}
                label={`형광펜 ${transcriptHighlightCount}개`}
                onPress={() => setPaintedOnly((value) => !value)}
                selected={transcriptPaintedOnly}
                testID="transcript-highlight-filter"
              />
            ) : hintDismissed ||
              transcriptPaintedTotal > 0 ||
              !material.transcript.length ? null : (
              <HighlightHint
                onDismiss={() => setHintDismissed(true)}
                testID="transcript-highlight-hint"
              >
                {TRANSCRIPT_HINT}
              </HighlightHint>
            )}
            {visibleTranscript.length ? (
              <View
                onLayout={(event: LayoutChangeEvent) => {
                  transcriptCardY.current = event.nativeEvent.layout.y;
                }}
              >
              <Card padding={false}>
                {transcriptRows.map((row, index) => {
                  const divider =
                    index < transcriptRows.length - 1 ? styles.rowDivider : null;
                  if (row.kind === 'section') {
                    return (
                      <TranscriptSectionMarker
                        key={row.key}
                        onPress={() => openSection(row.section)}
                        page={isDocument}
                        section={row.section}
                        style={divider}
                        testID="transcript-section-marker"
                      />
                    );
                  }
                  const segment = row.segment;
                  const relatedMarker = material.markers.find(
                    (marker) => marker.timestampMs >= segment.startMs && marker.timestampMs <= segment.endMs,
                  );
                  const important = Boolean(segment.isImportant || relatedMarker);
                  const active = segment.id === activeSegmentId;
                  return (
                    <View
                      key={row.key}
                      onLayout={(event: LayoutChangeEvent) =>
                        handleRowLayout(segment.id, {
                          y: event.nativeEvent.layout.y,
                          height: event.nativeEvent.layout.height,
                        })
                      }
                      style={[
                        styles.transcriptRow,
                        important ? styles.transcriptRowImportant : null,
                        active ? styles.transcriptRowActive : null,
                        active && important ? styles.transcriptRowActiveImportant : null,
                        divider,
                      ]}
                      testID={active ? 'transcript-row-active' : undefined}
                    >
                      <TimeChip
                        accessibilityLabel={
                          isDocument
                            ? `${formatSourcePosition(segment.startMs, true)}으로 이동`
                            : `${formatSourcePosition(segment.startMs, false)}부터 재생`
                        }
                        onPress={() => jumpTo(segment.startMs)}
                        page={isDocument}
                        timestampMs={segment.startMs}
                      />
                      <View style={styles.flex}>
                        <View style={styles.speakerRow}>
                          {/* Nobody spoke a page, so a document says nothing
                              here rather than labelling its text 화자. */}
                          {isDocument ? null : (
                            <AppText tone="muted" variant="badge">
                              {segment.speaker ?? '화자'}
                            </AppText>
                          )}
                          {important ? (
                            <StatusBadge
                              label={relatedMarker?.source === 'ai' ? 'AI 중요' : '중요'}
                              tone="brand"
                            />
                          ) : null}
                        </View>
                        {pageSummaryOn && segment.summary ? (
                          // Plain text, not paintable: a 형광펜 stroke belongs
                          // on the page's own words, and painting a summary
                          // would file a highlight the source does not contain.
                          <AppText variant="body">{segment.summary}</AppText>
                        ) : (
                          /* Long press, not tap: the row's timestamp already
                             answers a tap by seeking. */
                          <HighlightableText
                            highlights={highlights}
                            onToggle={paintSentence}
                            paintedOnly={transcriptPaintedOnly}
                            text={segment.text}
                            variant="body"
                          />
                        )}
                        {relatedMarker?.source === 'ai' && relatedMarker.reason ? (
                          <AppText tone="muted" variant="meta">{relatedMarker.reason}</AppText>
                        ) : null}
                        {settings.mode === 'student' ? (
                          <Pressable
                            accessibilityHint="헷갈린 이유를 골라요."
                            accessibilityLabel="이 대본 구간이 헷갈려요"
                            accessibilityRole="button"
                            onPress={() => setConfusionSegmentId(segment.id)}
                            style={({ pressed }) => [
                              styles.confusionButton,
                              pressed ? styles.pressed : null,
                            ]}
                          >
                            <MessageCircleQuestion
                              {...decorative}
                              color={colors.textMuted}
                              size={iconSizes.dense}
                            />
                            <AppText tone="muted" variant="badge">여기가 헷갈려요</AppText>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </Card>
              </View>
            ) : (
              <EmptyState
                compact
                description={
                  material.transcript.length
                    ? importantOnly && !search.trim()
                      ? '중요 표시한 문장이 아직 없어요. 필터를 끄면 전체 대본이 보여요.'
                      : '다른 말로 찾아보세요.'
                    : '대본을 만들지 못한 자료예요. 원본은 위에서 그대로 들을 수 있어요.'
                }
                title={
                  material.transcript.length
                    ? importantOnly && !search.trim()
                      ? '중요 표시가 없어요'
                      : '찾는 문장이 없어요'
                    : '대본이 없어요'
                }
              />
            )}
          </View>
        ) : null}

        </PanelFade>
        </View>
        </GestureDetector>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        {/* Looks like a quiet input, acts like a button: it opens the chat
            screen with the keyboard up rather than taking text here. */}
        <Pressable
          accessibilityHint="질문 화면을 열어요."
          accessibilityLabel="이 자료에 물어보기"
          accessibilityRole="button"
          onPress={openChat}
          style={({ pressed }) => [
            styles.askPill,
            pressed ? styles.askPillPressed : null,
          ]}
          testID="ask-pill"
        >
          <MessageCircle
            {...decorative}
            color={colors.textMuted}
            size={iconSizes.section}
            strokeWidth={2}
          />
          <AppText numberOfLines={1} style={styles.flex} tone="faint" variant="body">
            이 자료에 물어보기
          </AppText>
        </Pressable>
        {material.quiz.length ? (
          <Button
            onPress={() =>
              router.push({
                pathname: '/quiz/[id]',
                params: { id: material.id, from: 'material' satisfies QuizOrigin },
              })
            }
            size="large"
            style={styles.quizButton}
            variant="primary"
          >
            문제 풀기
          </Button>
        ) : null}
      </View>

      {notice ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.notice, styles.noticeInert, { bottom: spacing.massive + spacing.xl }]}
        >
          <AppText tone="inverse" variant="label">{notice}</AppText>
        </View>
      ) : null}

      <BottomSheetModal
        description="고른 이유에 맞게 이 부분만 다시 설명해 드릴게요."
        onClose={() => setConfusionSegmentId(null)}
        title="어디가 헷갈렸어요?"
        visible={Boolean(confusionSegmentId)}
      >
        <View style={styles.reasonGrid}>
          {confusionReasons.map(([reason, label]) => (
            <Chip key={reason} label={label} onPress={() => submitConfusion(reason)} />
          ))}
        </View>
      </BottomSheetModal>

      {isDocument && viewerPage !== null ? (
        <DocumentPageViewer
          key={viewerPage}
          onClose={() => setViewerPage(null)}
          onOpenInTranscript={(page) => {
            setViewerPage(null);
            // Pages are numbered into start_ms exactly as the server writes
            // them, so page N is (N - 1) * 1000 — the same jump a citation
            // makes.
            openCitation((page - 1) * 1000);
          }}
          page={viewerPage}
          pageImage={pageImage}
          segments={material.transcript}
        />
      ) : null}
    </Screen>
  );
}

/** The lecture length, or the furthest moment we know about when the file did not say. */
function lectureDurationMs(material: StudyMaterial): number {
  const known = material.source.durationMs ?? 0;
  if (known > 0) return known;
  return Math.max(
    0,
    ...material.transcript.map((segment) => segment.endMs),
    ...material.markers.map((marker) => marker.timestampMs),
    ...(material.note?.concepts ?? []).map((concept) => concept.sourceStartMs),
  );
}

function SummaryPanel({
  attempts,
  checkedPoints,
  highlights,
  jumpTo,
  material,
  onCheckedPointsChange,
  onOutlineLayout,
  onPaintSentence,
  onSectionLayout,
  onSummaryViewChange,
  painted,
  positionMs,
  summaryView,
}: {
  attempts: readonly QuizAttempt[];
  /** The points the learner has checked off, from `studyNotes[materialId]`. */
  checkedPoints: readonly string[];
  /** The sentences the learner painted, from `studyNotes[materialId]`. */
  highlights: readonly string[];
  jumpTo: (timestampMs: number) => void;
  material: StudyMaterial;
  onCheckedPointsChange: (checkedPoints: string[]) => void;
  /** Where the 자세히 card starts inside the panel. */
  onOutlineLayout: (y: number) => void;
  onPaintSentence: (sentence: string) => void;
  /** Where one 구간 sits inside that card, by its `startMs`. */
  onSectionLayout: (startMs: number, y: number) => void;
  onSummaryViewChange: (view: SummaryView) => void;
  /** Every stroke of this 마인드팩, in reading order. */
  painted: readonly SentenceSource[];
  positionMs: number;
  summaryView: SummaryView;
}) {
  const note = material.note;
  const summary = note?.summary.trim() ?? '';
  const keyPoints = note?.keyPoints ?? [];
  const concepts = note?.concepts ?? [];
  const durationMs = lectureDurationMs(material);
  const outline = material.outline ?? NO_OUTLINE;
  // Older 마인드팩 were made before the server wrote outlines. With nothing to
  // switch to, the switch itself would be a dead control, so it stays away.
  const showViewSwitch = outline.length > 0;
  const view: SummaryView = showViewSwitch ? summaryView : 'glance';
  const page = material.source.kind === 'document';

  /**
   * How to read 요약, as chips rather than a segmented control.
   *
   * It used to be a second segmented control sitting directly under the four
   * main tabs, and two identical pill strips stacked read as two rows of tabs:
   * nothing said which one picked the screen and which one picked the view.
   * The 대본 tab already puts its view options (중요만, 구간, 쪽 요약) in a chip
   * row, so this follows the same rule — a segmented control chooses the
   * panel, chips change what is inside it.
   */
  const controls = showViewSwitch ? (
    <View style={styles.summaryControls} testID="summary-view-switch">
      {summaryViewOptions.map((option) => (
        <Chip
          accessibilityHint={
            option.value === 'detail'
              ? '구간별로 자세히 풀어 쓴 요약을 봐요.'
              : '핵심만 짧게 봐요.'
          }
          key={option.value}
          label={option.label}
          onPress={() => onSummaryViewChange(option.value)}
          selected={view === option.value}
        />
      ))}
    </View>
  ) : null;

  /** Where the strokes come back, under whichever way 요약 is being read. */
  const highlightList = (
    <HighlightList
      onClear={onPaintSentence}
      onSeek={jumpTo}
      page={page}
      painted={painted}
      testID="summary-highlight-list"
    />
  );

  if (view === 'detail') {
    return (
      <View style={styles.panel}>
        {controls}
        <View
          onLayout={(event: LayoutChangeEvent) => {
            onOutlineLayout(event.nativeEvent.layout.y);
          }}
        >
          <SummaryOutline
            highlights={highlights}
            onSeek={jumpTo}
            onSectionLayout={onSectionLayout}
            onToggleHighlight={onPaintSentence}
            page={page}
            sections={outline}
          />
        </View>
        {highlightList}
      </View>
    );
  }

  // Text first (what the lecture said), then the strokes, then the timeline
  // and the numbers.
  return (
    <View style={styles.panel}>
      {controls}
      {summary || keyPoints.length ? (
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHead}>
            <StatusBadge
              label={note?.teacherVerified ? '검수됨' : 'AI 요약'}
              tone={note?.teacherVerified ? 'positive' : 'neutral'}
            />
            {note?.estimatedReviewMinutes ? (
              <View style={styles.reviewTime}>
                <Clock3
                  {...decorative}
                  color={colors.textMuted}
                  size={iconSizes.dense}
                  strokeWidth={2}
                />
                <AppText tone="muted" variant="meta">
                  복습 {note.estimatedReviewMinutes}분
                </AppText>
              </View>
            ) : null}
          </View>
          {summary ? (
            <View style={styles.summaryBlock}>
              {/* With the switch above, its 한눈에 보기 segment is the title. */}
              {showViewSwitch ? null : (
                <AppText accessibilityRole="header" variant="heading">
                  한눈에 보기
                </AppText>
              )}
              {/* A tap paints: nothing else in 요약 answers one. */}
              <HighlightableText
                highlights={highlights}
                onToggle={onPaintSentence}
                tapToPaint
                text={summary}
                variant="body"
              />
            </View>
          ) : null}
          {keyPoints.length ? (
            <View style={summary ? styles.summaryBlockDivided : null}>
              <KeyPointChecklist
                checkedPoints={checkedPoints}
                keyPoints={keyPoints}
                onChange={onCheckedPointsChange}
              />
            </View>
          ) : null}
        </Card>
      ) : (
        <EmptyState
          compact
          description={
            material.transcript.length
              ? '이 자료에는 요약이 없어요. 대본 탭에서 원문을 볼 수 있어요.'
              : '요약과 대본이 없어요. 원본은 위에서 들을 수 있어요.'
          }
          icon={Sparkles}
          title="요약이 없어요"
        />
      )}

      {highlightList}

      {durationMs > 0 ? (
        <LectureTimeline
          concepts={concepts}
          durationMs={durationMs}
          markers={material.markers}
          onSeek={jumpTo}
          positionMs={positionMs}
        />
      ) : null}
      {note ? (
        <StudyStats
          attempts={attempts}
          concepts={concepts}
          materialId={material.id}
          quiz={material.quiz}
          reviewMinutes={note.estimatedReviewMinutes}
        />
      ) : null}

      <SectionHeader
        description="내가 표시한 곳과 AI가 찾은 강조 구간이에요"
        title="중요한 순간"
      />
      {material.markers.length ? (
        <Card padding={false}>
          {material.markers.map((marker, index) => (
            <Pressable
              accessibilityHint="그 시점부터 재생해요."
              accessibilityLabel={`${formatDuration(marker.timestampMs / 1000)}, ${marker.label}`}
              accessibilityRole="button"
              key={marker.id}
              onPress={() => jumpTo(marker.timestampMs)}
              style={({ pressed }) => [
                styles.listRow,
                index < material.markers.length - 1 ? styles.rowDivider : null,
                pressed ? styles.rowPressed : null,
              ]}
            >
              <TimeChip timestampMs={marker.timestampMs} />
              <View style={styles.flex}>
                <AppText variant="itemTitle">{marker.label}</AppText>
                <AppText tone="muted" variant="meta">
                  {marker.source === 'teacher'
                    ? '내가 표시'
                    : `AI 감지${marker.confidence ? `, 신뢰도 ${Math.round(marker.confidence * 100)}%` : ''}`}
                </AppText>
                {marker.reason ? <AppText tone="muted" variant="meta">{marker.reason}</AppText> : null}
              </View>
              <View style={styles.trailing}>
                <ChevronRight
                  {...decorative}
                  color={colors.textFaint}
                  size={iconSizes.section}
                  strokeWidth={1.8}
                />
              </View>
            </Pressable>
          ))}
        </Card>
      ) : (
        <EmptyState
          compact
          description="표시한 구간도, AI가 찾은 구간도 아직 없어요."
          title="중요 표시가 없어요"
        />
      )}

      {material.lensReport ? (
        <Card padding={false}>
          <ListRow
            divider={false}
            leadingIcon={BrainCircuit}
            onPress={() =>
              router.push({
                pathname: '/report/[id]',
                params: { id: material.id },
              })
            }
            subtitle="근거와 먼저 고칠 것을 봐요"
            title="평가 결과 보기"
          />
        </Card>
      ) : (
        <Card style={styles.tipCard} variant="soft">
          <BrainCircuit
            {...decorative}
            color={colors.textMuted}
            size={iconSizes.section}
            strokeWidth={1.9}
          />
          <View style={styles.flex}>
            <AppText variant="itemTitle">아직 평가가 없어요</AppText>
            <AppText tone="muted" variant="meta">
              평가 탭에서 이 자료를 고르면 근거와 함께 평가해 줘요.
            </AppText>
          </View>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * `minHeight: 0` lets the flex column actually bound the list. Without it
   * Android can size the ScrollView to its content and the tail is then
   * unreachable beneath the bottom bar.
   */
  scroll: { flex: 1, minHeight: 0 },
  /** The last row clears the bottom bar with room to spare (32 + 24). */
  content: {
    paddingBottom: spacing.xxl + spacing.xl,
  },
  block: { paddingHorizontal: spacing.gutter },
  /** Header → player 8. Player → tabs 24, split 16 here and 8 on the tab row. */
  documentCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  playerBlock: { paddingBottom: spacing.md + spacing.xs, paddingTop: spacing.sm },
  /** Scrolls with the content; a pinned header on Android costs more than it gives. */
  tabsBlock: {
    backgroundColor: colors.background,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  /** The tabs block already carries the 12pt title → content gap. */
  panelBlock: { paddingTop: spacing.none },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.none },
  flex: { flex: 1, minWidth: 0 },
  transcriptTools: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  noticeInert: { pointerEvents: 'none' },
  notice: {
    alignSelf: 'center',
    backgroundColor: colors.stage,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
    position: 'absolute',
  },
  panel: { gap: spacing.md },
  /** The 요약 switch and the 형광펜 chips: two tappables sit 12 apart. */
  summaryControls: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCard: { gap: spacing.md },
  summaryHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  reviewTime: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  summaryBlock: { gap: spacing.sm },
  summaryBlockDivided: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  listRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: ROW_HEIGHT,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  /** A row's trailing control: a fixed 44pt column so text never runs under it. */
  trailing: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
    marginRight: -spacing.md,
    width: sizes.minimumTouchTarget,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: { backgroundColor: colors.backgroundSoft },
  pressed: { opacity: 0.7 },
  searchShell: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.backgroundSoft,
    borderRadius: radii.input,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: sizes.input,
    paddingHorizontal: spacing.md,
  },
  searchShellFocused: {
    backgroundColor: colors.surface,
    borderColor: colors.text,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    ...typography.body,
  },
  transcriptRow: {
    alignItems: 'flex-start',
    borderLeftColor: colors.transparent,
    borderLeftWidth: 3,
    flexDirection: 'row',
    gap: spacing.md,
    paddingLeft: spacing.gutter - 3,
    paddingRight: spacing.gutter,
    paddingVertical: spacing.md,
  },
  transcriptRowImportant: {
    backgroundColor: colors.brandSubtle,
    borderLeftColor: colors.brand,
  },
  /** The line the playhead is on: ink bar on a quiet fill. */
  transcriptRowActive: {
    backgroundColor: colors.backgroundSoft,
    borderLeftColor: colors.text,
  },
  /** Important lines keep their accent bar even while active. */
  transcriptRowActiveImportant: {
    borderLeftColor: colors.brand,
  },
  speakerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xxs,
  },
  confusionButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: sizes.minimumTouchTarget,
    paddingHorizontal: spacing.xs,
  },
  tipCard: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  /** Hairline + 12pt vertical padding; the Screen owns the bottom inset. */
  bottomBar: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.gutter,
  },
  /** A quiet input's shell (soft fill, 48pt, pill) that is really a button. */
  askPill: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.full,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: sizes.input,
    minWidth: 0,
    paddingHorizontal: spacing.md + spacing.xs,
  },
  askPillPressed: { backgroundColor: colors.backgroundMuted },
  /** Matches the pill's 48pt so the two controls share one baseline. */
  quizButton: { flexShrink: 0, minHeight: sizes.input },
  notReady: { flex: 1, justifyContent: 'center' },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
