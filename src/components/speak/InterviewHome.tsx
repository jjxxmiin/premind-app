import { router } from 'expo-router';
import {
  Building2,
  FileText,
  History,
  Lightbulb,
  ListChecks,
  Mic,
  PenLine,
  Play,
  Ticket,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Carousel } from '@/components/app';
import { AllowanceCard } from '@/components/interview/AllowanceCard';
import { InterviewSessionRow } from '@/components/interview/InterviewSessionRow';
import { SpeakCard } from '@/components/speak/SpeakCard';
import { SpeakColumns, SpeakFrame } from '@/components/speak/SpeakColumns';
import { RoundAction } from '@/components/speak/RoundAction';
import { SpeakHero, SpeakSectionTitle, SpeakTitle, Surface } from '@/components/speak/SpeakKit';
import {
  AnimatedReveal,
  AppText,
  Button,
  IconButton,
  ListRow,
  Screen,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { installBackupSync } from '@/features/interview/backup-sync';
import { PLAN } from '@/features/interview/pricing';
import { latestNextPractice } from '@/features/interview/practice-stats';
import { resolveSessionSource } from '@/features/interview/session-source';
import type { InterviewSession } from '@/features/interview/types';
import { useInterviewAccount } from '@/features/interview/use-interview-account';
import { useInterviewSessions } from '@/features/interview/use-interview-sessions';
import {
  answeredQuestionCount,
  lastActivity,
  relativeDay,
  sessionDestination,
} from '@/features/interview/view-model';
import { decorative } from '@/lib/a11y';
import { useLocale, useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

type StartOption = { from: 'resume' | 'packs' | 'custom'; icon: LucideIcon; title: string; body: string; tag?: string };

// 연습을 시작하는 길. 면접 웹(interview-home.tsx)의 두 길에 직접 질문 만들기를 더했다.
const START_OPTIONS: StartOption[] = [
  { from: 'resume', icon: FileText, title: '자기소개서로 연습', body: '자기소개서에서 나올 질문과 꼬리질문을 만들어요.', tag: '추천' },
  { from: 'packs', icon: ListChecks, title: '질문 세트로 연습', body: '공기업, 대기업, 고졸 채용 공통 질문이나 회사별 질문으로 바로 시작해요.' },
  { from: 'custom', icon: PenLine, title: '질문 직접 만들기', body: '받고 싶은 질문을 적고 답변 시간을 정해요.' },
];

/**
 * 말하기 탭의 면접 쪽(2026-09-26 앱다운 재설계). 머리 카드 하나에 할 일 하나 — 이어서 하기가 있으면
 * 그것, 없으면 큰 둥근 시작 버튼(스픽). 시작하는 다른 길 셋은 옆으로 넘기는 카드, AI 피드백 남은 횟수는
 * 작은 링, 최근 연습 행. `switcher` 는 발표, 면접을 고르는 알약.
 */
export function InterviewHome({ switcher }: { switcher?: ReactNode }) {
  const t = useT();
  const locale = useLocale();
  const { breakpoint, gutter } = useLayout();
  const account = useInterviewAccount();
  const { sessions } = useInterviewSessions();
  const wide = breakpoint === 'expanded';
  const compact = breakpoint === 'compact';

  useEffect(() => installBackupSync(), []);

  const view = useMemo(() => {
    if (!sessions) return null;
    const sorted = [...sessions].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
    const inProgress = sorted.find((session) => session.status !== 'completed' && resolveSessionSource(session));
    return { next: latestNextPractice(sessions), inProgress, recent: sorted.slice(0, 3), firstTime: sessions.length === 0 };
  }, [sessions]);

  const user = account.status === 'ready' ? account.user : null;
  const allowance = account.status === 'ready' ? account.allowance : null;
  const demo = account.status === 'ready' && account.demo;
  const open = (session: InterviewSession) => router.push(sessionDestination(session));
  const start = (from: StartOption['from']) => router.push({ pathname: '/interview/prepare', params: { from } });

  // 머리 카드: 이어서 하기가 있으면 그것 하나, 없으면 첫 질문부터(질문 세트로 바로).
  const resume = view?.inProgress ?? null;
  const resumeSource = resume ? resolveSessionSource(resume) : null;
  const heroCopy = resume ? (
    <View style={[styles.heroCopy, compact ? styles.centered : null]}>
      <AppText align={compact ? 'center' : 'left'} numberOfLines={2} variant="heroTitle">
        {t(resumeSource?.title ?? '면접 연습')}
      </AppText>
      <AppText align={compact ? 'center' : 'left'} tone="soft" variant="body">
        {t('{done} / {total}개 답변, {when}', {
          done: answeredQuestionCount(resume),
          total: resumeSource?.questions.length ?? 0,
          when: relativeDay(lastActivity(resume), new Date(), locale),
        })}
      </AppText>
    </View>
  ) : (
    <View style={[styles.heroCopy, compact ? styles.centered : null]}>
      <AppText align={compact ? 'center' : 'left'} variant="heroTitle">
        {t(view?.firstTime ? '첫 질문부터 말해볼까요?' : '무엇을 연습할까요?')}
      </AppText>
      <AppText align={compact ? 'center' : 'left'} tone="soft" variant="body">
        {t('질문을 준비하고, 타이머에 맞춰 답하고, 내가 한 말을 돌아봐요.')}
      </AppText>
    </View>
  );
  const nextHint = !resume && view?.next ? (
    <View style={styles.hint}>
      <Lightbulb {...decorative} color={colors.warningStrong} size={iconSizes.section} strokeWidth={2} />
      <View style={styles.flex}>
        <AppText tone="warning" variant="badge">
          {t('지난 연습에서 이어갈 점')}
        </AppText>
        <AppText variant="bodyStrong">{view.next.text}</AppText>
      </View>
    </View>
  ) : null;
  const heroAction = resume ? (
    <RoundAction icon={Play} label={t('이어서 하기')} onPress={() => open(resume)} testID="interview-continue" />
  ) : (
    <RoundAction
      accessibilityHint={t('공기업, 대기업, 고졸 채용 공통 질문이나 회사별 질문으로 바로 시작해요.')}
      icon={Mic}
      label={t('연습 시작')}
      onPress={() => start('packs')}
      testID="interview-start"
    />
  );
  const hero = (
    <SpeakHero>
      {compact ? (
        <>
          {heroCopy}
          {heroAction}
          {nextHint}
        </>
      ) : (
        <View style={styles.heroRow}>
          <View style={styles.heroLeft}>
            {heroCopy}
            {nextHint}
          </View>
          {heroAction}
        </View>
      )}
    </SpeakHero>
  );

  const startWays = (
    <View style={styles.section}>
      <SpeakSectionTitle title={t(resume || !view?.firstTime ? '새 연습 시작' : '어떻게 시작할까요?')} />
      {compact ? (
        <Carousel accessibilityLabel={t('새 연습 시작')} itemWidth={236}>
          {START_OPTIONS.map((option) => (
            <StartCard key={option.from} onPress={() => start(option.from)} option={option} />
          ))}
        </Carousel>
      ) : (
        <View style={styles.optionsRow}>
          {START_OPTIONS.map((option) => (
            <StartCard key={option.from} onPress={() => start(option.from)} option={option} />
          ))}
        </View>
      )}
      <AppText tone="muted" variant="meta">
        {t(
          '기본 연습은 무료예요. AI 피드백 연습은 첫 회 무료, 스탠다드는 매달 {n}회예요. 같은 연습 안에서 다시 답하는 건 횟수에 들어가지 않아요.',
          { n: PLAN.aiStandardMonthly },
        )}
      </AppText>
    </View>
  );

  const allowanceBlock = account.status === 'loading' ? <Skeleton height={148} /> : <AllowanceCard allowance={allowance} demo={demo} />;

  const recentBlock = (
    <View style={styles.section}>
      <SpeakSectionTitle
        action={
          sessions && sessions.length > 0 ? (
            <Button onPress={() => router.push('/interview/history')} size="small" variant="ghost">
              {t('전체 기록')}
            </Button>
          ) : null
        }
        title={t('최근 연습')}
      />
      {!view ? (
        <Skeleton height={68} />
      ) : view.recent.length === 0 ? (
        <Surface style={styles.emptyRecent} tone="soft">
          <History {...decorative} color={colors.textFaint} size={iconSizes.section} strokeWidth={1.8} />
          <AppText style={styles.flex} tone="muted" variant="meta">
            {t('아직 연습 기록이 없어요. 위에서 질문을 골라 첫 연습을 시작해 보세요.')}
          </AppText>
        </Surface>
      ) : (
        <Surface padding={0} style={styles.list} tone="raised">
          {view.recent.map((session, index) => (
            <InterviewSessionRow key={session.id} last={index === view.recent.length - 1} onPress={() => open(session)} session={session} />
          ))}
        </Surface>
      )}
    </View>
  );

  const orgBlock = (
    <View style={styles.section}>
      <SpeakSectionTitle title={t('학교, 기관')} />
      <Surface padding={0} style={styles.list} tone="soft">
        {user?.role === 'manager' ? (
          <ListRow
            divider={false}
            leadingIcon={Building2}
            onPress={() => router.push('/interview/org')}
            showChevron
            subtitle={t('학생들의 가입과 연습 참여를 봐요')}
            title={t('기관 현황')}
          />
        ) : user?.role === 'student' && user.orgName ? (
          <ListRow
            divider={false}
            leadingIcon={Building2}
            subtitle={user.groupName ? t('{group}에 참여하고 있어요', { group: user.groupName }) : t('기관에 참여하고 있어요')}
            title={user.orgName}
          />
        ) : (
          <ListRow
            divider={false}
            leadingIcon={Ticket}
            onPress={() => router.push('/interview/join')}
            showChevron
            subtitle={t('학교나 취업센터에서 받은 코드로 참여해요')}
            title={t('초대 코드 입력')}
          />
        )}
      </Surface>
    </View>
  );

  const top = (
    <View style={styles.top}>
      <SpeakTitle description={t('내가 말한 것을 돌려받아요')} title={t('말하기')} />
      {switcher}
    </View>
  );

  return (
    <Screen fullBleed padded={false} safeAreaEdges={['top', 'left', 'right']} scroll scrollViewProps={{ showsVerticalScrollIndicator: false }}>
      <SpeakFrame>
        <AppHeader
          brand
          right={<IconButton icon={History} label={t('연습 기록')} onPress={() => router.push('/interview/history')} />}
        />
        <View style={[styles.content, { paddingHorizontal: gutter }]}>
          <AnimatedReveal>{top}</AnimatedReveal>
          {wide ? (
            <SpeakColumns
              main={
                <>
                  <AnimatedReveal delay={60}>{hero}</AnimatedReveal>
                  <AnimatedReveal delay={120}>{startWays}</AnimatedReveal>
                  <AnimatedReveal delay={180}>{recentBlock}</AnimatedReveal>
                </>
              }
              side={
                <>
                  <AnimatedReveal delay={120}>{allowanceBlock}</AnimatedReveal>
                  <AnimatedReveal delay={180}>{orgBlock}</AnimatedReveal>
                </>
              }
              sideWidth={340}
            />
          ) : (
            <>
              <AnimatedReveal delay={60}>{hero}</AnimatedReveal>
              <AnimatedReveal delay={120}>{startWays}</AnimatedReveal>
              <AnimatedReveal delay={160}>{allowanceBlock}</AnimatedReveal>
              <AnimatedReveal delay={200}>{recentBlock}</AnimatedReveal>
              <AnimatedReveal delay={240}>{orgBlock}</AnimatedReveal>
            </>
          )}
        </View>
      </SpeakFrame>
    </Screen>
  );
}

/** 시작하는 길 한 장: 큰 아이콘, 제목, 한 줄 설명. 폰에서는 옆으로 넘기는 줄 안에 든다. */
function StartCard({ option, onPress }: { option: StartOption; onPress: () => void }) {
  const t = useT();
  const Icon = option.icon;
  return (
    <SpeakCard accessibilityLabel={`${t(option.title)}. ${t(option.body)}`} onPress={onPress} style={styles.start} tone="soft">
      <View style={styles.startHead}>
        <View {...decorative} style={styles.startIcon}>
          <Icon color={colors.brand} size={28} strokeWidth={1.9} />
        </View>
        {option.tag ? <StatusBadge label={t(option.tag)} tone="brand" /> : null}
      </View>
      <AppText variant="heading">{t(option.title)}</AppText>
      <AppText numberOfLines={3} style={styles.grow} tone="muted" variant="meta">
        {t(option.body)}
      </AppText>
    </SpeakCard>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xs,
  },
  top: { gap: spacing.lg },
  section: { gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  grow: { flexGrow: 1 },
  heroCopy: { alignItems: 'flex-start', gap: spacing.sm },
  centered: { alignItems: 'center', paddingHorizontal: spacing.xs },
  heroRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xl },
  heroLeft: { flex: 1, gap: spacing.lg, minWidth: 0 },
  hint: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radii.tile,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  emptyRecent: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  list: { overflow: 'hidden' },
  optionsRow: { flexDirection: 'row', gap: spacing.md },
  start: { flex: 1, gap: spacing.sm, minHeight: 188, minWidth: 0 },
  startIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  startHead: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
});
