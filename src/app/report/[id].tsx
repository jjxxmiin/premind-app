import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  History,
  Mic,
  PlayCircle,
  RefreshCw,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { BOTTOM_ACTION_SPACE, BottomAction } from '@/components/app';
import { SpeakFrame } from '@/components/speak/SpeakColumns';
import { SpeakSectionTitle, StatTile, Surface, TileGrid } from '@/components/speak/SpeakKit';
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
  bandTone,
  momentKey,
  comparisonPair,
  formatEvaluatedAt,
  reportConclusion,
  rubricExplanation,
  rubricLabel,
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
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import type { SpeechMetrics } from '@/lib/speech-metrics';
import { goBackOrReplace } from '@/lib/navigation';
import { speechMetrics } from '@/lib/speech-metrics';
import { useAppStore } from '@/state/app-store';
import { colors, iconSizes, radii, sizes, spacing } from '@/theme/tokens';
import type { LensMoment } from '@/types';

export default function LensReportScreen() {
  const t = useT();
  const { breakpoint, gutter } = useLayout();
  const wide = breakpoint === 'expanded';
  const { id } = useLocalSearchParams<{ id: string }>();
  const { evaluatingMaterialIds, loadLensHistory, materials, requestLens } = useAppStore();
  const material = materials.find((item) => item.id === id);
  const habits = useMemo(() => (material ? speechMetrics(material.transcript) : null), [material]);
  const history = material?.lensHistory ?? [];
  /** Which past evaluation is on screen; null means the newest one. */
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [evaluateError, setEvaluateError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  /** 항목 점수, 습관, 근거 줄은 접어 두고 필요한 사람만 연다. */
  const [showDetails, setShowDetails] = useState(false);
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
    const body = offsets.current.body ?? 0;
    const section = offsets.current[`section-${mark.kind}`] ?? 0;
    const card = offsets.current[`card-${mark.kind}`] ?? 0;
    const row = offsets.current[`row-${key}`] ?? 0;
    scrollRef.current?.scrollTo({
      animated: true,
      y: Math.max(0, body + section + card + row - spacing.md),
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
        <AppHeader onBack={() => goBackOrReplace('/(tabs)/library')} title={t('발표 평가')} />
        <ErrorState
          description={t('이 자료를 찾을 수 없어요. 내 자료에서 다시 골라 주세요.')}
          onRetry={() => goBackOrReplace('/(tabs)/library')}
          retryLabel={t('돌아가기')}
        />
      </Screen>
    );
  }

  const errorDialog = (
    <Dialog
      confirm={{ label: t('확인'), onPress: () => setEvaluateError(null) }}
      description={evaluateError !== null ? t(evaluateError) : undefined}
      onRequestClose={() => setEvaluateError(null)}
      title={t('평가를 시작하지 못했어요')}
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
        <AppHeader onBack={backToMaterial} title={t('발표 평가')} />
        <View
          accessibilityLabel={`${material.title} ${t('평가 중')}`}
          accessibilityLiveRegion="polite"
          style={styles.content}
        >
          <View style={styles.heading}>
            <StatusBadge label={t('평가 중')} showDot tone="brand" />
            <AppText variant="pageTitle">{t('내 발표를 읽고 평가하고 있어요')}</AppText>
            <AppText tone="muted" variant="body">
              {t('길이에 따라 몇 초에서 몇 분 걸려요. 이 화면을 나가도 평가는 이어져요.')}
            </AppText>
          </View>
          <Card style={styles.scoreCard} variant="soft">
            <Skeleton
              height={PLACEHOLDER_RING_SIZE}
              radius={radii.full}
              width={PLACEHOLDER_RING_SIZE}
            />
            <Skeleton height={spacing.md} width={PLACEHOLDER_LABEL_WIDTH} />
            <Skeleton height={spacing.md} width="60%" />
          </Card>
          <View style={styles.section}>
            <SectionHeader title={t('얼마나 잘했나요')} />
            <Card>
              <SkeletonLines lines={6} />
            </Card>
          </View>
          <Button fullWidth onPress={backToMaterial} variant="secondary">
            {t('돌아가기')}
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
      <Screen padded={false} scroll>
        <AppHeader
          onBack={() =>
            goBackOrReplace({
              pathname: '/material/[id]',
              params: { id: material.id },
            })
          }
          title={t('발표 평가')}
        />
        <View style={styles.unavailableContent}>
          <EmptyState
            actionLabel={t('돌아가기')}
            description={t('내 발표 녹음이라면 평가를 시작해 보세요. 점수와 근거가 여기에 생겨요.')}
            onAction={() =>
              router.replace({
                pathname: '/material/[id]',
                params: { id: material.id },
              })
            }
            title={t('아직 평가가 없어요')}
          />
          {material.status === 'ready' ? (
            <Button
              fullWidth
              leftIcon={<RefreshCw color={colors.textSoft} size={iconSizes.inline} />}
              onPress={evaluate}
              variant="outline"
            >
              {t('평가 시작')}
            </Button>
          ) : null}
        </View>
        {errorDialog}
      </Screen>
    );
  }

  // 이번 vs 지난 exists only once there is an earlier evaluation of this
  // recording; viewing an older one compares it with the one before it.
  const comparison = comparisonPair(history, viewing?.id ?? null);
  const priority = report.priority;
  const momentCount = report.strengths.length + report.improvements.length;
  const conclusion = reportConclusion(report, t.locale);
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

  // 2026-09-26 덜어내기(산타 분석 결): 흰 카드에 링 하나(숫자는 링 안에만) + 범례 둘, 그 아래 총평 두 줄.
  // 항목 점수, 말하기 습관, 근거 줄, 타임라인, 비교, 이력은 "자세히 보기" 안에 접어 둔다.
  const scoreBlock = (
    <Surface padding={spacing.xl} style={styles.scoreHero} tone="raised">
      <ScoreRing score={report.overall} />
      <View style={styles.heroCopy}>
        {/* A YouTube title is long; one line turned it into an ellipsis
                  that told the reader nothing about which recording this was. */}
        <AppText align="center" numberOfLines={2} tone="muted" variant="meta">
          {material.title}
        </AppText>
      </View>
      <BalanceStrip
        improvementCount={report.improvements.length}
        strengthCount={report.strengths.length}
        style={styles.balance}
      />
    </Surface>
  );
  const recordAgain = (
    <Button
      fullWidth
      leftIcon={<Mic color={colors.textInverse} size={iconSizes.inline} />}
      onPress={() => router.push('/record')}
      size="large"
      variant="primary"
    >
      {t('다시 녹음하기')}
    </Button>
  );
  const reviewAgain = (
    <Button
      accessibilityHint={t('같은 대본으로 평가를 새로 만들어요.')}
      leftIcon={<RefreshCw color={colors.textSoft} size={iconSizes.inline} />}
      loading={requesting}
      onPress={evaluate}
      style={styles.center}
      variant="ghost"
    >
      {t('다시 평가')}
    </Button>
  );

  // 접기 전에 보이는 것은 먼저 고칠 것 한 줄. 잘한 것, 총평 문장, 이렇게 해요는 자세히 안에.
  const summaryBlock = conclusion.fix ? (
    <ConclusionLine label={t('먼저 고칠 것')} moment={conclusion.fix} onPress={jumpTo} tone="brand" />
  ) : null;

  const detailsToggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: showDetails }}
      onPress={() => setShowDetails((open) => !open)}
      style={({ pressed }) => [styles.detailsToggle, pressed ? styles.conclusionLinePressed : null]}
      testID="report-details"
    >
      <AppText variant="bodyStrong">{showDetails ? t.ctx('fold', '접기') : t('자세히 보기')}</AppText>
      {showDetails ? (
        <ChevronUp {...decorative} color={colors.textMuted} size={iconSizes.inline} />
      ) : (
        <ChevronDown {...decorative} color={colors.textMuted} size={iconSizes.inline} />
      )}
    </Pressable>
  );

  const details = (
    <>
      <View style={styles.section}>
        <SpeakSectionTitle title={t('총평')} />
        <AppText variant="bodyStrong">{conclusion.sentence}</AppText>
        {conclusion.highlight ? (
          <ConclusionLine
            label={t('가장 잘한 것')}
            moment={conclusion.highlight}
            onPress={jumpTo}
            tone="positive"
          />
        ) : null}
      </View>

      {habits ? <HabitTiles habits={habits} /> : null}

      <View style={styles.section}>
        <SpeakSectionTitle title={t('얼마나 잘했나요')} />
        <Surface tone="raised">
          <RubricRadar rubric={report.rubric} />
        </Surface>
        <Surface padding={0} style={styles.clip} tone="raised">
          {report.rubric.map((metric, index) => (
            <View
              accessibilityLabel={`${t(
                '{label}, {explanation}. {max}점 만점에 {score}점, {band} 구간이에요. 기준은 2.5 보통, 3.5 좋아요, 4.5 아주 좋아요예요.',
                {
                  label: rubricLabel(metric, t.locale),
                  explanation: rubricExplanation(metric.key, t.locale),
                  max: SCORE_MAX,
                  score: metric.score.toFixed(1),
                  band: scoreWord(metric.score, t.locale),
                },
              )} ${metric.evidence}`}
              accessible
              key={metric.key}
              style={[styles.rubricRow, index < report.rubric.length - 1 ? styles.rowDivider : null]}
            >
              <View style={styles.rubricTopLine}>
                <AppText style={styles.flex} variant="itemTitle">
                  {rubricLabel(metric, t.locale)}
                </AppText>
                <View style={styles.rubricScore}>
                  <AppText tabular variant="metric">
                    {metric.score.toFixed(1)}
                  </AppText>
                </View>
              </View>
              <RubricBandTrack accessibilityLabel={null} score={metric.score} style={styles.bandTrack} />
              <AppText tone="muted" variant="meta">
                {metric.evidence}
              </AppText>
            </View>
          ))}
        </Surface>
      </View>

      {report.strengths.length > 0 ? (
        <View onLayout={(event) => rememberOffset('section-strength', event)} style={styles.section}>
          <SpeakSectionTitle title={t('무엇이 좋았나요')} />
          <Surface
            onLayout={(event) => rememberOffset('card-strength', event)}
            padding={0}
            style={styles.clip}
            tone="raised"
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
          </Surface>
        </View>
      ) : null}

      {priority || report.improvements.length > 0 ? (
        <View onLayout={(event) => rememberOffset('section-improvement', event)} style={styles.section}>
          <SpeakSectionTitle title={t('무엇부터 고칠까요')} />
          {priority ? (
            <Surface style={styles.priorityCard} tone="brand">
              <StatusBadge label={t('우선순위')} showDot tone="brand" />
              <AppText variant="heading">{priority.text}</AppText>
              {priority.action ? (
                <View style={styles.actionCallout}>
                  <AppText tone="muted" variant="badge">
                    {t('이렇게 해요')}
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
                {t('{time}부터 듣기', {
                  time: formatDuration(priority.sourceStartMs / 1_000),
                })}
              </Button>
            </Surface>
          ) : null}
          {report.improvements.length > 0 ? (
          <Surface
            onLayout={(event) => rememberOffset('card-improvement', event)}
            padding={0}
            style={styles.clip}
            tone="raised"
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
          </Surface>
          ) : null}
        </View>
      ) : null}

      {momentCount > 0 ? (
        <View style={styles.section}>
          <SpeakSectionTitle title={t('어디를 다시 들을까요')} />
          <Surface tone="raised">
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
          </Surface>
        </View>
      ) : null}

      {comparison ? (
        <View style={styles.section}>
          <SpeakSectionTitle title={t('지난번과 비교')} />
          <Surface tone="raised">
            <RubricCompare
              current={comparison.current.report}
              currentAt={comparison.current.evaluatedAt}
              previous={comparison.previous.report}
              previousAt={comparison.previous.evaluatedAt}
            />
          </Surface>
        </View>
      ) : null}

      {history.length > 1 ? (
        <View style={styles.section}>
          <SpeakSectionTitle title={t('평가 이력')} />
          <LensHistoryList
            entries={history}
            onSelect={(entryId) => setViewingId((current) => (current === entryId ? null : entryId))}
            selectedId={viewing?.id ?? null}
          />
        </View>
      ) : null}

      {reviewAgain}
    </>
  );

  return (
    <Screen background="soft" fullBleed padded={false}>
      <SpeakFrame>
        <AppHeader
          onBack={() =>
            goBackOrReplace({
              pathname: '/material/[id]',
              params: { id: material.id },
            })
          }
          title={t('발표 평가')}
        />
      </SpeakFrame>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
        style={styles.fill}
      >
        <SpeakFrame>
          <View style={[styles.content, { paddingHorizontal: gutter }, wide ? null : styles.dockSpace]}>
            {wide ? null : scoreBlock}

            {viewing && !viewingIsLatest ? (
              <View style={styles.noticeLine}>
                <History {...decorative} color={colors.textMuted} size={iconSizes.inline} strokeWidth={1.9} />
                <AppText style={styles.flex} tone="muted" variant="meta">
                  {t('지금 보는 평가: {date}', {
                    date: formatEvaluatedAt(viewing.evaluatedAt, t.locale),
                  })}
                </AppText>
              </View>
            ) : null}

            <View
              onLayout={(event) => rememberOffset('body', event)}
              style={wide ? styles.bodyRow : styles.bodyStack}
            >
              <View style={wide ? styles.mainColumn : styles.bodyStack}>
                {summaryBlock}
                {detailsToggle}
                {showDetails ? details : null}
              </View>
              {wide ? (
                <View style={styles.sideColumn}>
                  {scoreBlock}
                  {recordAgain}
                </View>
              ) : null}
            </View>
          </View>
        </SpeakFrame>
      </ScrollView>
      {wide ? null : <BottomAction>{recordAgain}</BottomAction>}
      {errorDialog}
    </Screen>
  );
}

/**
 * 말하기 습관을 Yoodli 처럼 지표 타일 2열로(2026-09-26, 눈금 표 대신): 말 속도, 군말, 긴 멈춤,
 * 말한 시간. 모두 대본에서 이미 잰 값이고, 새로 매기는 점수는 없다.
 */
function HabitTiles({ habits }: { habits: SpeechMetrics }) {
  const t = useT();
  const gauges = [habits.pace, habits.fillers, habits.pauses];
  return (
    <View style={styles.tiles}>
      <SpeakSectionTitle title={t('말하기 습관')} />
      <TileGrid>
        {gauges.map((metric) => (
          <StatTile
            caption={t.ctx('speech', metric.band)}
            captionTone={bandTone(metric)}
            key={metric.key}
            label={t.ctx('speech', metric.title)}
            unit={t.ctx('speech', metric.unit)}
            value={metric.valueText}
          />
        ))}
        {habits.spokenMs > 0 ? (
          <StatTile
            label={t('말한 시간')}
            value={formatDuration(habits.spokenMs / 1_000)}
          />
        ) : null}
      </TileGrid>
    </View>
  );
}

/** One line of the 총평 card: a label, the quote, its time, and the action if any. */
function ConclusionLine({
  label,
  moment,
  onPress,
  tone,
}: {
  label: string;
  moment: LensMoment;
  onPress: (moment: LensMoment) => void;
  /** 잘한 것은 초록 면, 고칠 것은 주황 면. */
  tone: 'positive' | 'brand';
}) {
  const t = useT();
  const time = formatDuration(moment.sourceStartMs / 1_000);
  return (
    <Pressable
      accessibilityHint={t('그 부분부터 재생해요.')}
      accessibilityLabel={`${label}, ${time}. ${moment.text}${moment.action ? `. ${t('이렇게 해요')}: ${moment.action}` : ''}`}
      accessibilityRole="button"
      onPress={() => onPress(moment)}
      style={({ pressed }) => [
        styles.conclusionLine,
        tone === 'positive' ? styles.conclusionPositive : styles.conclusionBrand,
        pressed ? styles.conclusionLinePressed : null,
      ]}
    >
      <AppText tone={tone} variant="label">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{moment.text}</AppText>
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
  const t = useT();
  const time = formatDuration(moment.sourceStartMs / 1_000);
  return (
    <View
      onLayout={onLayout}
      style={[!last ? styles.rowDivider : null, active ? styles.rowActive : null]}
    >
      <Pressable
        accessibilityHint={t('그 부분부터 재생해요.')}
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
            {t('{time}부터 듣기', { time })}
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
  bodyStack: {
    gap: spacing.xxl,
  },
  bodyRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xl,
  },
  mainColumn: {
    flex: 1,
    gap: spacing.xxl,
    minWidth: 0,
  },
  /** 옆 칸: 점수와 다음 연습. 웹에서는 스크롤을 따라 붙는다. */
  sideColumn: {
    flexShrink: 0,
    gap: spacing.md,
    position: Platform.OS === 'web' ? ('sticky' as 'relative') : 'relative',
    top: spacing.md,
    width: 340,
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
  noticeLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailsToggle: {
    alignItems: 'center',
    alignSelf: 'center',
    cursor: 'pointer',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: sizes.minimumTouchTarget,
    paddingHorizontal: spacing.md,
  },
  scoreCard: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  conclusionLine: {
    borderRadius: radii.hero,
    gap: spacing.sm,
    padding: spacing.gutter,
  },
  conclusionPositive: {
    backgroundColor: colors.positiveSoft,
  },
  conclusionBrand: {
    backgroundColor: colors.brandSoft,
  },
  conclusionLinePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
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
  scoreHero: {
    alignItems: 'center',
    gap: spacing.md,
  },
  heroCopy: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  center: {
    alignSelf: 'center',
  },
  clip: {
    overflow: 'hidden',
  },
  priorityCard: {
    gap: spacing.md,
  },
  actionCallout: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    gap: spacing.xs,
    padding: spacing.md,
  },
  dockSpace: {
    paddingBottom: BOTTOM_ACTION_SPACE + spacing.md,
  },
  tiles: {
    gap: spacing.md,
  },
});
