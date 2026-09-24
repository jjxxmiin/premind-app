import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowUpRight,
  ChevronRight,
  FlaskConical,
  History,
  Lightbulb,
  PlayCircle,
  RefreshCw,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import {
  BalanceStrip,
  LensHistoryList,
  MomentDensity,
  MomentsTimeline,
  RubricBandTrack,
  RubricCompare,
  RubricRadar,
  SCORE_MAX,
  ScoreRing,
  SpeechHabits,
  momentKey,
  comparisonPair,
  formatEvaluatedAt,
  reportConclusion,
  rubricExplanation,
  scoreWord,
  selectedEntry,
  type MomentMark,
} from '@/components/lens';
import {
  AppText,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonLines,
  StatusBadge,
} from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatDuration } from '@/lib/format';
import { goBackOrReplace } from '@/lib/navigation';
import { speechMetrics } from '@/lib/speech-metrics';
import { isDemoSession } from '@/services/api/session-manager';
import { useAppStore } from '@/state/app-store';
import { colors, iconSizes, radii, sizes, spacing } from '@/theme/tokens';
import type { LensMoment } from '@/types';

export default function LensReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { evaluatingMaterialIds, loadLensHistory, materials, requestLens, session } =
    useAppStore();
  const material = materials.find((item) => item.id === id);
  const habits = useMemo(
    () => (material ? speechMetrics(material.transcript) : null),
    [material],
  );
  const history = material?.lensHistory ?? [];
  /** Which past evaluation is on screen; null means the newest one. */
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [evaluateError, setEvaluateError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  /** `${kind}-${index}` of the moment the timeline last pointed at. */
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  /** Layout offsets of each moment section, card and row, so a pin can scroll to its row. */
  const offsets = useRef<Record<string, number>>({});
  const evaluating = Boolean(
    material && (requesting || evaluatingMaterialIds.includes(material.id)),
  );

  // Past evaluations live on the server, so they are fetched once per open.
  // A material with none simply keeps an empty list and no section appears.
  const materialId = material?.id ?? null;
  useEffect(() => {
    if (!materialId) return;
    void loadLensHistory(materialId).catch(() => undefined);
  }, [loadLensHistory, materialId]);

  const rememberOffset = (key: string, event: LayoutChangeEvent) => {
    offsets.current[key] = event.nativeEvent.layout.y;
  };

  const focusMoment = (mark: MomentMark) => {
    const key = momentKey(mark.kind, mark.index);
    setActiveKey(key);
    const section = offsets.current[`section-${mark.kind}`] ?? 0;
    const card = offsets.current[`card-${mark.kind}`] ?? 0;
    const row = offsets.current[`row-${key}`] ?? 0;
    scrollRef.current?.scrollTo({
      animated: true,
      y: Math.max(0, section + card + row - spacing.md),
    });
  };

  const evaluate = () => {
    if (!material || evaluating) return;
    setRequesting(true);
    setEvaluateError(null);
    void requestLens(material.id)
      .then(() => setViewingId(null))
      .catch((error: unknown) => {
        setEvaluateError(
          error instanceof Error && error.message
            ? error.message
            : '평가를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.',
        );
      })
      .finally(() => setRequesting(false));
  };

  if (!material) {
    return (
      <Screen padded={false}>
        <AppHeader onBack={() => goBackOrReplace('/(tabs)/library')} title="발표 평가" />
        <ErrorState
          description="이 자료를 찾을 수 없어요. 내 자료에서 다시 골라 주세요."
          onRetry={() => goBackOrReplace('/(tabs)/library')}
          retryLabel="돌아가기"
        />
      </Screen>
    );
  }

  const errorDialog = (
    <Dialog
      confirm={{ label: '확인', onPress: () => setEvaluateError(null) }}
      description={evaluateError ?? undefined}
      onRequestClose={() => setEvaluateError(null)}
      title="평가를 시작하지 못했어요"
      visible={evaluateError !== null}
    />
  );
  const backToMaterial = () =>
    goBackOrReplace({
      pathname: '/material/[id]',
      params: { id: material.id },
    });

  if (evaluating) {
    return (
      <Screen padded={false} scroll>
        <AppHeader onBack={backToMaterial} title="발표 평가" />
        <View
          accessibilityLabel={`${material.title} 평가 중`}
          accessibilityLiveRegion="polite"
          style={styles.content}
        >
          <View style={styles.heading}>
            <StatusBadge label="평가 중" showDot tone="brand" />
            <AppText variant="pageTitle">내 발표를 읽고 평가하고 있어요</AppText>
            <AppText tone="muted" variant="body">
              길이에 따라 몇 초에서 몇 분 걸려요. 이 화면을 나가도 평가는
              이어져요.
            </AppText>
          </View>
          <Card style={styles.scoreCard} variant="soft">
            <Skeleton height={PLACEHOLDER_RING_SIZE} radius={radii.full} width={PLACEHOLDER_RING_SIZE} />
            <Skeleton height={spacing.md} width={PLACEHOLDER_LABEL_WIDTH} />
            <Skeleton height={spacing.md} width="60%" />
          </Card>
          <View style={styles.section}>
            <SectionHeader title="얼마나 잘했나요" />
            <Card>
              <SkeletonLines lines={6} />
            </Card>
          </View>
          <Button fullWidth onPress={backToMaterial} variant="secondary">
            돌아가기
          </Button>
        </View>
        {errorDialog}
      </Screen>
    );
  }

  // The evaluation on screen: the one picked from 평가 이력, else the newest.
  const viewing = selectedEntry(history, viewingId);
  const viewingIsLatest = !viewing || history[0]?.id === viewing.id;
  const report = viewing?.report ?? material.lensReport;
  if (!report) {
    return (
      <Screen
        padded={false}
        scroll
      >
        <AppHeader
          onBack={() =>
            goBackOrReplace({
              pathname: '/material/[id]',
              params: { id: material.id },
            })
          }
          title="발표 평가"
        />
        <View style={styles.unavailableContent}>
          <EmptyState
            actionLabel="돌아가기"
            description="내 발표 녹음이라면 평가를 시작해 보세요. 점수와 근거가 여기에 생겨요."
            onAction={() =>
              router.replace({
                pathname: '/material/[id]',
                params: { id: material.id },
              })
            }
            title="아직 평가가 없어요"
          />
          {material.status === 'ready' ? (
            <Button
              fullWidth
              leftIcon={<RefreshCw color={colors.textSoft} size={iconSizes.inline} />}
              onPress={evaluate}
              variant="outline"
            >
              평가 시작
            </Button>
          ) : null}
        </View>
        {errorDialog}
      </Screen>
    );
  }

  const demo = isDemoSession(session);
  // 이번 vs 지난 exists only once there is an earlier evaluation of this
  // recording; viewing an older one compares it with the one before it.
  const comparison = comparisonPair(history, viewing?.id ?? null);
  const priority = report.priority;
  const momentCount = report.strengths.length + report.improvements.length;
  const conclusion = reportConclusion(report);
  const jumpTo = (moment: LensMoment) => {
    router.push({
      pathname: '/material/[id]',
      params: {
        id: material.id,
        tab: 'transcript',
        at: String(moment.sourceStartMs),
      },
    });
  };

  return (
    <Screen padded={false}>
      <AppHeader
        onBack={() =>
          goBackOrReplace({
            pathname: '/material/[id]',
            params: { id: material.id },
          })
        }
        title="발표 평가"
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
        style={styles.fill}
      >
        <View style={styles.content}>
          <View style={styles.heading}>
            <StatusBadge
              label={demo ? '예시 평가' : '근거 기반'}
              tone={demo ? 'neutral' : 'brand'}
            />
            <AppText variant="pageTitle">내 발표를 평가했어요</AppText>
            <AppText tone="muted" variant="body">
              발표, 스피치, 면접 연습 녹음을 대본으로 채점했어요. 결론부터
              읽고, 시간을 눌러 그 부분을 들어요.
            </AppText>
          </View>

          {viewing && !viewingIsLatest ? (
            <Card style={styles.noticeCard} variant="soft">
              <History
                {...decorative}
                color={colors.textMuted}
                size={iconSizes.section}
                strokeWidth={1.9}
              />
              <AppText style={styles.flex} tone="muted" variant="meta">
                {`지금 보는 평가: ${formatEvaluatedAt(viewing.evaluatedAt)}`}
              </AppText>
            </Card>
          ) : null}

          {demo ? (
            <Card style={styles.noticeCard} variant="soft">
              <FlaskConical
                {...decorative}
                color={colors.textMuted}
                size={iconSizes.section}
                strokeWidth={1.9}
              />
              <AppText style={styles.flex} tone="muted" variant="meta">
                데모 마인드팩에 들어 있는 예시 평가예요.
              </AppText>
            </Card>
          ) : null}

          <Card style={styles.conclusionCard}>
            <AppText tone="muted" variant="badge">
              총평
            </AppText>
            <AppText variant="heading">{conclusion.sentence}</AppText>
            {conclusion.highlight ? (
              <ConclusionLine
                label="가장 잘한 것"
                moment={conclusion.highlight}
                onPress={jumpTo}
              />
            ) : null}
            {conclusion.fix ? (
              <ConclusionLine label="먼저 고칠 것" moment={conclusion.fix} onPress={jumpTo} />
            ) : null}
          </Card>

          {habits ? (
            <View style={styles.section}>
              <SectionHeader
                description="대본에서 바로 잰 숫자예요. 눈금의 진한 구간이 알맞은 범위예요."
                title="말하기 습관"
              />
              <SpeechHabits metrics={habits} />
            </View>
          ) : null}

          {comparison ? (
            <View style={styles.section}>
              <SectionHeader
                description="같은 녹음을 다시 평가한 결과예요. 항목마다 이번과 지난번을 나란히 놓았어요."
                title="지난번과 비교"
              />
              <Card>
                <RubricCompare
                  current={comparison.current.report}
                  currentAt={comparison.current.evaluatedAt}
                  previous={comparison.previous.report}
                  previousAt={comparison.previous.evaluatedAt}
                />
              </Card>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader
              description="5점 만점이에요. 2.5부터 보통, 3.5부터 좋아요, 4.5부터 아주 좋아요예요."
              title="얼마나 잘했나요"
            />
            <Card style={styles.scoreCard} variant="soft">
              <ScoreRing score={report.overall} />
              {/* A YouTube title is long; one line turned it into an ellipsis
                  that told the reader nothing about which recording this was. */}
              <AppText align="center" numberOfLines={2} tone="faint" variant="meta">
                {material.title}
              </AppText>
              <AppText tone="faint" variant="badge">
                {`${report.rubric.length}개 항목 / 근거 ${momentCount}개`}
              </AppText>
              <BalanceStrip
                improvementCount={report.improvements.length}
                strengthCount={report.strengths.length}
                style={styles.balance}
              />
            </Card>
            <Card>
              <RubricRadar rubric={report.rubric} />
            </Card>
            <Card padding={false}>
              {report.rubric.map((metric, index) => (
                <View
                  accessibilityLabel={`${metric.label}, ${rubricExplanation(metric.key)}. ${SCORE_MAX}점 만점에 ${metric.score.toFixed(1)}점, ${scoreWord(metric.score)} 구간이에요. 기준은 2.5 보통, 3.5 좋아요, 4.5 아주 좋아요예요. ${metric.evidence}`}
                  accessible
                  key={metric.key}
                  style={[
                    styles.rubricRow,
                    index < report.rubric.length - 1 ? styles.rowDivider : null,
                  ]}
                >
                  <View style={styles.rubricTopLine}>
                    <View style={styles.flex}>
                      <AppText variant="itemTitle">{metric.label}</AppText>
                      <AppText tone="faint" variant="badge">
                        {rubricExplanation(metric.key)}
                      </AppText>
                    </View>
                    <View style={styles.rubricScore}>
                      <AppText tabular variant="metric">
                        {metric.score.toFixed(1)}
                      </AppText>
                    </View>
                  </View>
                  <RubricBandTrack
                    accessibilityLabel={null}
                    score={metric.score}
                    style={styles.bandTrack}
                  />
                  <AppText tone="muted" variant="meta">
                    {metric.evidence}
                  </AppText>
                </View>
              ))}
            </Card>
          </View>

          {report.strengths.length > 0 ? (
            <View
              onLayout={(event) => rememberOffset('section-strength', event)}
              style={styles.section}
            >
              <SectionHeader
                description="시간을 누르면 그 부분부터 들어요."
                title="무엇이 좋았나요"
              />
              <Card
                onLayout={(event) => rememberOffset('card-strength', event)}
                padding={false}
              >
                {report.strengths.map((strength, index) => {
                  const key = momentKey('strength', index);
                  return (
                    <MomentRow
                      active={key === activeKey}
                      key={key}
                      last={index === report.strengths.length - 1}
                      moment={strength}
                      onLayout={(event) => rememberOffset(`row-${key}`, event)}
                      onPress={() => jumpTo(strength)}
                    />
                  );
                })}
              </Card>
            </View>
          ) : null}

          {priority || report.improvements.length > 0 ? (
            <View
              onLayout={(event) => rememberOffset('section-improvement', event)}
              style={styles.section}
            >
              <SectionHeader
                description="하나만 골라 다음 연습에서 바꿔 봐요."
                title="무엇부터 고칠까요"
              />
              {priority ? (
              <Card style={styles.priorityCard}>
                <StatusBadge label="우선순위" showDot tone="brand" />
                <AppText variant="heading">{priority.text}</AppText>
                {priority.action ? (
                  <View style={styles.actionCallout}>
                    <AppText tone="muted" variant="badge">
                      이렇게 해요
                    </AppText>
                    <AppText variant="bodyStrong">{priority.action}</AppText>
                  </View>
                ) : null}
                <Button
                  fullWidth
                  leftIcon={<PlayCircle color={colors.textSoft} size={iconSizes.inline} />}
                  onPress={() => jumpTo(priority)}
                  variant="outline"
                >
                  {`${formatDuration(priority.sourceStartMs / 1_000)}부터 듣기`}
                </Button>
              </Card>
              ) : null}
              {report.improvements.length > 0 ? (
              <Card
                onLayout={(event) => rememberOffset('card-improvement', event)}
                padding={false}
              >
                {report.improvements.map((improvement, index) => {
                  const key = momentKey('improvement', index);
                  return (
                    <MomentRow
                      active={key === activeKey}
                      key={key}
                      last={index === report.improvements.length - 1}
                      moment={improvement}
                      onLayout={(event) => rememberOffset(`row-${key}`, event)}
                      onPress={() => jumpTo(improvement)}
                    />
                  );
                })}
              </Card>
              ) : null}
            </View>
          ) : null}

          {momentCount > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                description="녹음 어디에서 잘했고 어디를 고칠지 한 줄에 표시했어요. 점을 누르면 그 줄로 가고, 아래 막대는 구간마다 몇 개인지 보여줘요."
                title="어디를 다시 들을까요"
              />
              <Card>
                <MomentsTimeline
                  activeKey={activeKey}
                  durationMs={material.source.durationMs}
                  improvements={report.improvements}
                  onSelect={focusMoment}
                  priority={priority}
                  strengths={report.strengths}
                />
                <MomentDensity
                  durationMs={material.source.durationMs}
                  improvements={report.improvements}
                  strengths={report.strengths}
                  style={styles.densityBlock}
                />
              </Card>
            </View>
          ) : null}

          {history.length > 1 ? (
            <View style={styles.section}>
              <SectionHeader
                description="같은 녹음을 다시 평가한 기록이에요. 날짜를 누르면 그때 리포트를 봐요."
                title="평가 이력"
              />
              <LensHistoryList
                entries={history}
                onSelect={(entryId) =>
                  setViewingId((current) => (current === entryId ? null : entryId))
                }
                selectedId={viewing?.id ?? null}
              />
            </View>
          ) : null}

          <Card style={styles.nextCard} variant="soft">
            <View style={styles.nextTitle}>
              <Lightbulb
                {...decorative}
                color={colors.text}
                size={iconSizes.section}
                strokeWidth={1.9}
              />
              <AppText variant="itemTitle">다음 연습에서 해 보기</AppText>
            </View>
            <AppText tone="muted" variant="body">
              먼저 고칠 것 하나만 기억하고 다시 한번 연습을 녹음해 보세요.
            </AppText>
            <Button
              fullWidth
              onPress={() => router.push('/record')}
              rightIcon={<ArrowUpRight color={colors.textInverse} size={iconSizes.inline} />}
              size="large"
              variant="primary"
            >
              녹음 시작
            </Button>
            <Button
              accessibilityHint="같은 대본으로 평가를 새로 만들어요."
              fullWidth
              leftIcon={<RefreshCw color={colors.textSoft} size={iconSizes.inline} />}
              loading={requesting}
              onPress={evaluate}
              variant="outline"
            >
              다시 평가
            </Button>
          </Card>
        </View>
      </ScrollView>
      {errorDialog}
    </Screen>
  );
}

/** One line of the 총평 card: a label, the quote, its time, and the action if any. */
function ConclusionLine({
  label,
  moment,
  onPress,
}: {
  label: string;
  moment: LensMoment;
  onPress: (moment: LensMoment) => void;
}) {
  const time = formatDuration(moment.sourceStartMs / 1_000);
  return (
    <Pressable
      accessibilityHint="그 부분부터 재생해요."
      accessibilityLabel={`${label}, ${time}. ${moment.text}${moment.action ? `. 이렇게 해요: ${moment.action}` : ''}`}
      accessibilityRole="button"
      onPress={() => onPress(moment)}
      style={({ pressed }) => [styles.conclusionLine, pressed ? styles.conclusionLinePressed : null]}
    >
      <View style={styles.conclusionHead}>
        <AppText tone="muted" variant="badge">
          {label}
        </AppText>
        <View style={styles.timeChip}>
          <AppText tabular tone="soft" variant="badge">
            {time}
          </AppText>
        </View>
      </View>
      <AppText variant="body">{moment.text}</AppText>
      {moment.action ? (
        <View style={styles.actionCallout}>
          <AppText tone="muted" variant="badge">
            이렇게 해요
          </AppText>
          <AppText variant="bodyStrong">{moment.action}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * One evidence line: a time chip, the quote, and the action if there is one.
 * The row the timeline pointed at is tinted and opens a listen button.
 */
function MomentRow({
  active,
  last,
  moment,
  onLayout,
  onPress,
}: {
  active: boolean;
  last: boolean;
  moment: LensMoment;
  onLayout: (event: LayoutChangeEvent) => void;
  onPress: () => void;
}) {
  const time = formatDuration(moment.sourceStartMs / 1_000);
  return (
    <View
      onLayout={onLayout}
      style={[!last ? styles.rowDivider : null, active ? styles.rowActive : null]}
    >
      <Pressable
        accessibilityHint="그 부분부터 재생해요."
        accessibilityLabel={`${time}, ${moment.text}`}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={({ pressed }) => [styles.momentRow, pressed ? styles.rowPressed : null]}
      >
        <View style={[styles.timeChip, active ? styles.timeChipActive : null]}>
          <AppText tabular tone="soft" variant="meta">
            {time}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="itemTitle">{moment.text}</AppText>
          {moment.action ? (
            <AppText tone="muted" variant="meta">
              {moment.action}
            </AppText>
          ) : null}
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
      {active ? (
        <View style={styles.listenLine}>
          <Button
            leftIcon={<PlayCircle color={colors.textSoft} size={iconSizes.dense} />}
            onPress={onPress}
            size="small"
            style={styles.listenButton}
            variant="outline"
          >
            {`${time}부터 듣기`}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

/** List rows: 68 default, per the layout rules. */
const ROW_HEIGHT = 68;
/** Skeleton sizes that stand in for the ring and the title while evaluating. */
const PLACEHOLDER_RING_SIZE = 148;
const PLACEHOLDER_LABEL_WIDTH = 56;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  /** Header → first block 8; between blocks 24; last block → end 32. */
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  unavailableContent: {
    flex: 1,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
  },
  heading: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  noticeCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  scoreCard: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  conclusionCard: {
    gap: spacing.md,
  },
  conclusionLine: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.input,
    gap: spacing.xs,
    padding: spacing.md,
  },
  conclusionLinePressed: {
    backgroundColor: colors.backgroundMuted,
  },
  conclusionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  rubricScore: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  balance: {
    marginTop: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  rubricRow: {
    gap: spacing.xs,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  rubricTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  bandTrack: {
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  /** The density strip is a second reading of the same bar above it. */
  densityBlock: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    backgroundColor: colors.backgroundSoft,
  },
  rowActive: {
    backgroundColor: colors.backgroundSoft,
  },
  momentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: ROW_HEIGHT,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  listenLine: {
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.gutter,
  },
  listenButton: {
    alignSelf: 'flex-start',
  },
  /** A row's trailing control: a fixed 44pt column so text never runs under it. */
  trailing: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
    marginRight: -spacing.md,
    width: sizes.minimumTouchTarget,
  },
  timeChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.chip,
    justifyContent: 'center',
    minWidth: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  timeChipActive: {
    backgroundColor: colors.backgroundMuted,
  },
  priorityCard: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandSoft,
    gap: spacing.md,
  },
  actionCallout: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    gap: spacing.xs,
    padding: spacing.md,
  },
  nextCard: {
    gap: spacing.md,
  },
  nextTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
