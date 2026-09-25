import { router } from 'expo-router';
import {
  ArrowRight,
  Building2,
  FileText,
  History,
  Lightbulb,
  ListChecks,
  PenLine,
  PlayCircle,
  Ticket,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AllowanceCard } from '@/components/interview/AllowanceCard';
import { InterviewSessionRow } from '@/components/interview/InterviewSessionRow';
import {
  AnimatedReveal,
  AppText,
  Card,
  IconButton,
  ListRow,
  Screen,
  SectionHeader,
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
 * 면접 탭. 할 일 하나(연습 시작)를 앞에 두고, 이어서 하기와 지난 연습에서
 * 이어갈 점, 이번 달 AI 피드백 횟수, 최근 연습을 함께 보여 준다.
 */
export default function InterviewHomeScreen() {
  const { breakpoint, gutter } = useLayout();
  const account = useInterviewAccount();
  const { sessions } = useInterviewSessions();
  const wide = breakpoint === 'expanded';

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

  const main = (
    <View style={styles.column}>
      <AnimatedReveal>
        <View style={styles.heading}>
          <AppText variant="pageTitle">{view?.firstTime ? '첫 질문부터 말해볼까요?' : '무엇을 연습할까요?'}</AppText>
          <AppText tone="muted" variant="body">
            질문을 준비하고, 타이머에 맞춰 답하고, 내가 한 말을 돌아봐요.
          </AppText>
        </View>
      </AnimatedReveal>

      {view?.inProgress ? (
        <ContinueCard onPress={() => open(view.inProgress!)} session={view.inProgress} />
      ) : view?.next ? (
        <Card
          accessibilityLabel={`지난 연습에서 이어갈 점. ${view.next.text}`}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/interview/report/[id]', params: { id: view.next!.sessionId } })}
          style={styles.hint}
          variant="soft"
        >
          <Lightbulb {...decorative} color={colors.warningStrong} size={iconSizes.section} strokeWidth={2} />
          <View style={styles.flex}>
            <AppText tone="warning" variant="badge">
              지난 연습에서 이어갈 점
            </AppText>
            <AppText variant="bodyStrong">{view.next.text}</AppText>
          </View>
        </Card>
      ) : null}

      <View style={[styles.options, breakpoint !== 'compact' ? styles.optionsRow : null]}>
        {START_OPTIONS.map((option) => (
          <StartCard
            key={option.from}
            onPress={() => router.push({ pathname: '/interview/prepare', params: { from: option.from } })}
            option={option}
            row={breakpoint !== 'compact'}
          />
        ))}
      </View>
      <AppText tone="muted" variant="meta">
        {`기본 연습은 무료예요. AI 피드백 연습은 첫 회 무료, 스탠다드는 매달 ${PLAN.aiStandardMonthly}회예요. 같은 연습 안에서 다시 답하는 건 횟수에 들어가지 않아요.`}
      </AppText>
    </View>
  );

  const side = (
    <View style={styles.column}>
      {account.status === 'loading' ? <Skeleton height={148} /> : <AllowanceCard allowance={allowance} demo={demo} />}

      <View style={styles.section}>
        <SectionHeader
          actionLabel={sessions && sessions.length > 0 ? '전체 기록' : undefined}
          onAction={() => router.push('/interview/history')}
          title="최근 연습"
        />
        {!view ? (
          <Skeleton height={68} />
        ) : view.recent.length === 0 ? (
          <Card variant="soft">
            <AppText tone="muted" variant="body">
              아직 연습 기록이 없어요. 위에서 질문을 골라 첫 연습을 시작해 보세요.
            </AppText>
          </Card>
        ) : (
          <Card padding={false}>
            {view.recent.map((session, index) => (
              <InterviewSessionRow key={session.id} last={index === view.recent.length - 1} onPress={() => open(session)} session={session} />
            ))}
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="학교, 기관" />
        <Card padding={false}>
          {user?.role === 'manager' ? (
            <ListRow
              divider={false}
              leadingIcon={Building2}
              onPress={() => router.push('/interview/org')}
              showChevron
              subtitle="학생들의 가입과 연습 참여를 봐요"
              title="기관 현황"
            />
          ) : user?.role === 'student' && user.orgName ? (
            <ListRow
              divider={false}
              leadingIcon={Building2}
              subtitle={user.groupName ? `${user.groupName}에 참여하고 있어요` : '기관에 참여하고 있어요'}
              title={user.orgName}
            />
          ) : (
            <ListRow
              divider={false}
              leadingIcon={Ticket}
              onPress={() => router.push('/interview/join')}
              showChevron
              subtitle="학교나 취업센터에서 받은 코드로 참여해요"
              title="초대 코드 입력"
            />
          )}
        </Card>
      </View>
    </View>
  );

  return (
    <Screen padded={false} safeAreaEdges={['top', 'left', 'right']} scroll scrollViewProps={{ showsVerticalScrollIndicator: false }}>
      <AppHeader
        brand
        right={<IconButton icon={History} label="연습 기록" onPress={() => router.push('/interview/history')} />}
      />
      <View style={[styles.content, { paddingHorizontal: gutter }, wide ? styles.wide : null]}>
        <View style={wide ? styles.mainColumn : null}>{main}</View>
        <View style={wide ? styles.sideColumn : null}>{side}</View>
      </View>
    </Screen>
  );
}

function ContinueCard({ session, onPress }: { session: InterviewSession; onPress: () => void }) {
  const source = resolveSessionSource(session);
  const title = source?.title ?? '면접 연습';
  const meta = `${answeredQuestionCount(session)} / ${source?.questions.length ?? 0}개 답변, ${relativeDay(lastActivity(session))}`;
  return (
    <Pressable
      accessibilityLabel={`이어서 하기. ${title}. ${meta}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.continue, pressed ? styles.pressed : null]}
    >
      <PlayCircle {...decorative} color={colors.brand} size={32} strokeWidth={1.8} />
      <View style={styles.flex}>
        <AppText tone="brand" variant="badge">
          이어서 하기
        </AppText>
        <AppText numberOfLines={1} variant="itemTitle">
          {title}
        </AppText>
        <AppText tone="muted" variant="meta">
          {meta}
        </AppText>
      </View>
      <ArrowRight {...decorative} color={colors.brand} size={iconSizes.section} />
    </Pressable>
  );
}

function StartCard({ option, onPress, row }: { option: StartOption; onPress: () => void; row: boolean }) {
  const Icon = option.icon;
  return (
    <Card
      accessibilityLabel={`${option.title}. ${option.body}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.start, row ? styles.startRow : null]}
    >
      <View style={styles.startHead}>
        <Icon {...decorative} color={colors.brand} size={26} strokeWidth={1.9} />
        {option.tag ? <StatusBadge label={option.tag} tone="brand" /> : null}
      </View>
      <AppText variant="heading">{option.title}</AppText>
      <AppText style={styles.flexText} tone="muted" variant="body">
        {option.body}
      </AppText>
      <View style={styles.startCta}>
        <AppText tone="brand" variant="label">
          시작하기
        </AppText>
        <ArrowRight {...decorative} color={colors.brand} size={iconSizes.dense} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  wide: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  mainColumn: { flex: 3, minWidth: 0 },
  sideColumn: { flex: 2, minWidth: 0 },
  column: { gap: spacing.xl },
  heading: { gap: spacing.xs },
  section: { gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  flexText: { flexGrow: 1 },
  hint: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  continue: {
    alignItems: 'center',
    backgroundColor: colors.brandSubtle,
    borderColor: colors.brandSoft,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.gutter,
  },
  pressed: { opacity: 0.7 },
  options: { gap: spacing.md },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  start: { gap: spacing.sm },
  startRow: { flexBasis: 220, flexGrow: 1 },
  startHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  startCta: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
});
