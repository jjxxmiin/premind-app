import { router } from 'expo-router';
import { Building2, FileText, History, ListChecks, Menu, Mic, PenLine, Play, Ticket } from 'lucide-react-native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AllowanceCard } from '@/components/interview/AllowanceCard';
import { InterviewSessionRow } from '@/components/interview/InterviewSessionRow';
import { SpeakColumns, SpeakFrame } from '@/components/speak/SpeakColumns';
import { AppText, BottomSheetModal, Button, Card, IconButton, ListRow, Screen, SectionHeader, Skeleton, StatusBadge } from '@/components/ui';
import { installBackupSync } from '@/features/interview/backup-sync';
import { resolveSessionSource } from '@/features/interview/session-source';
import type { InterviewSession } from '@/features/interview/types';
import { useInterviewAccount } from '@/features/interview/use-interview-account';
import { useInterviewSessions } from '@/features/interview/use-interview-sessions';
import { answeredQuestionCount, lastActivity, sessionDestination } from '@/features/interview/view-model';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { colors, iconSizes, spacing } from '@/theme/tokens';

const START_WAYS = [
  { from: 'packs', label: '준비된 질문', description: '지원 분야와 회사에 맞는 질문을 골라요', icon: ListChecks },
  { from: 'resume', label: '자기소개서', description: '내 경험에서 예상 질문을 만들어요', icon: FileText },
  { from: 'custom', label: '직접 만들기', description: '연습하고 싶은 질문을 직접 적어요', icon: PenLine },
] as const;

export function InterviewHome({ switcher }: { readonly switcher?: ReactNode }) {
  const t = useT();
  const { gutter } = useLayout();
  const account = useInterviewAccount();
  const { sessions } = useInterviewSessions();
  const [sheet, setSheet] = useState<'start' | 'menu' | null>(null);
  useEffect(() => installBackupSync(), []);

  const view = useMemo(() => {
    if (!sessions) return null;
    const sorted = [...sessions].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
    const resume = sorted.find((session) => session.status !== 'completed' && resolveSessionSource(session));
    return { resume, recent: sorted.find((session) => session !== resume) };
  }, [sessions]);
  const user = account.status === 'ready' ? account.user : null;
  const allowance = account.status === 'ready' ? account.allowance : null;
  const demo = account.status === 'ready' && account.demo;
  const resume = view?.resume;
  const source = resume ? resolveSessionSource(resume) : null;
  const open = (session: InterviewSession) => router.push(sessionDestination(session));
  const start = (from: (typeof START_WAYS)[number]['from']) => {
    setSheet(null);
    router.push({ pathname: '/interview/prepare', params: { from } });
  };

  const hero = (
    <Card style={styles.section} variant="soft">
      <StatusBadge label={t(resume ? '이어서 연습' : '면접 연습')} tone="brand" />
      <View style={styles.copy}>
        <AppText variant="pageTitle">{t(resume ? source?.title ?? '하던 연습을 이어가요' : '면접 답변, 말하며 준비해요')}</AppText>
        <AppText tone="muted" variant="body">
          {resume
            ? t('질문 {total}개 중 {done}개 답변했어요.', { total: source?.questions.length ?? 0, done: answeredQuestionCount(resume) })
            : t('질문을 고르고 소리 내어 답해 보세요. AI 피드백으로 보완할 점을 확인해요.')}
        </AppText>
      </View>
      <View style={styles.actions}>
      <Button style={styles.primaryAction} fullWidth={!resume} leftIcon={resume ? <Play color={colors.textInverse} size={iconSizes.inline} /> : <Mic color={colors.textInverse} size={iconSizes.inline} />}
        onPress={() => resume ? open(resume) : start('packs')} size="large" variant="primary" testID={resume ? 'interview-continue' : 'interview-start'}>
        {t(resume ? '이어서 하기' : '질문 고르기')}
      </Button>
      {resume ? <Button onPress={() => setSheet('start')} size="large" variant="secondary">{t('새 연습')}</Button> : null}
      </View>
      <AppText tone="muted" variant="meta">{t(demo ? '기본 연습 무료 · 데모 모드' : '기본 연습은 무료예요. AI 피드백은 시작 전에 이용 횟수를 확인해요.')}</AppText>
      {resume && !demo ? <AllowanceCard allowance={allowance} compact /> : null}
    </Card>
  );
  const secondary = (
    <View style={styles.section}>
      <Card padding={false}>
        <ListRow compact leadingIcon={FileText} onPress={() => start('resume')} title={t('자기소개서로 준비')} subtitle={t('내 경험에 맞는 예상 질문')} />
        <ListRow compact divider={false} leadingIcon={PenLine} onPress={() => start('custom')} title={t('내 질문으로 연습')} />
      </Card>
      {account.status === 'loading' ? <Skeleton height={68} /> : <AllowanceCard allowance={allowance} demo={demo} />}
    </View>
  );

  return (
    <Screen fullBleed padded={false} safeAreaEdges={['top', 'left', 'right']} scroll>
      <SpeakFrame>
        <AppHeader brand right={<IconButton icon={Menu} label={t('면접 메뉴')} onPress={() => setSheet('menu')} />} />
        <View style={[styles.content, { paddingHorizontal: gutter }]}>
          {switcher}
          {resume ? hero : <SpeakColumns main={hero} side={secondary} />}
          {view?.recent ? (
            <View style={styles.section}>
              <SectionHeader actionLabel={t('전체 보기')} onAction={() => router.push('/interview/history')} title={t('최근 연습')} />
              <Card padding={false}><InterviewSessionRow last onPress={() => view.recent && open(view.recent)} session={view.recent} /></Card>
            </View>
          ) : !view ? <Skeleton height={68} /> : null}
        </View>
      </SpeakFrame>
      <BottomSheetModal onClose={() => setSheet(null)} title={t(sheet === 'start' ? '새 연습' : '면접 메뉴')} visible={sheet !== null}>
        <Card padding={false}>
          {sheet === 'start' ? START_WAYS.map((way, index) => (
            <ListRow divider={index < START_WAYS.length - 1} key={way.from} leadingIcon={way.icon} onPress={() => start(way.from)} subtitle={t(way.description)} title={t(way.label)} />
          )) : <>
            <ListRow leadingIcon={History} onPress={() => { setSheet(null); router.push('/interview/history'); }} title={t('연습 기록')} />
            {user?.role === 'manager' ? (
              <ListRow divider={false} leadingIcon={Building2} onPress={() => { setSheet(null); router.push('/interview/org'); }} title={t('기관 현황')} />
            ) : user?.role === 'student' && user.orgName ? (
              <ListRow divider={false} leadingIcon={Building2} subtitle={user.groupName ?? t('기관에 참여하고 있어요')} title={user.orgName} />
            ) : (
              <ListRow divider={false} leadingIcon={Ticket} onPress={() => { setSheet(null); router.push('/interview/join'); }} title={t('초대 코드 입력')} />
            )}
          </>}
        </Card>
      </BottomSheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  section: { gap: spacing.md },
  copy: { gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  primaryAction: { flex: 1, minWidth: 0 },
});
