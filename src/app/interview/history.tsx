import { router } from 'expo-router';
import { CalendarDays, MessagesSquare } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { InterviewSessionRow, RemoteSessionRow } from '@/components/interview/InterviewSessionRow';
import {
  AppText,
  AuthField,
  Button,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
  Skeleton,
} from '@/components/ui';
import { installBackupSync, remoteOnlyBackups } from '@/features/interview/backup-sync';
import { daysUntil, planFor, type Dday } from '@/features/interview/dday';
import type { BackupMeta } from '@/features/interview/interview-api';
import { readDday, saveDday, subscribeInterviewSessions } from '@/features/interview/interview-storage';
import { computePracticeStats } from '@/features/interview/practice-stats';
import { useInterviewSessions } from '@/features/interview/use-interview-sessions';
import { formatAnswerDuration, lastActivity, sessionDestination } from '@/features/interview/view-model';
import { decorative } from '@/lib/a11y';
import { useLayout } from '@/lib/layout';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 연습 기록. 멈춘 연습은 이어서 하고, 끝난 연습은 답변과 피드백을 다시 본다.
 * 숫자는 얼마나 연습했는지만 센다(점수 아님). 다른 기기나 옛 면접 사이트에서
 * 남긴 기록도 함께 보이고, 그 기록은 읽기만 한다.
 */
export default function InterviewHistoryScreen() {
  const { breakpoint, gutter } = useLayout();
  const { sessions } = useInterviewSessions();
  const [remote, setRemote] = useState<BackupMeta[] | null>(null);
  const [dday, setDday] = useState<Dday | null>(null);
  const [editingDay, setEditingDay] = useState(false);
  const [dayInput, setDayInput] = useState('');
  const [dayError, setDayError] = useState<string | null>(null);

  useEffect(() => installBackupSync(), []);
  useEffect(() => {
    const load = () => void readDday().then(setDday);
    load();
    return subscribeInterviewSessions((changed) => changed === null && load());
  }, []);
  useEffect(() => {
    if (!sessions) return;
    let alive = true;
    void remoteOnlyBackups(new Set(sessions.map((session) => session.id)))
      .then((value) => alive && setRemote(value))
      .catch(() => alive && setRemote([]));
    return () => {
      alive = false;
    };
  }, [sessions]);

  const stats = useMemo(() => (sessions ? computePracticeStats(sessions) : null), [sessions]);
  const sorted = useMemo(() => (sessions ? [...sessions].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a))) : []), [sessions]);
  const active = sorted.filter((session) => session.status !== 'completed');
  const done = sorted.filter((session) => session.status === 'completed');
  const maxDay = Math.max(1, ...(stats?.week.map((day) => day.answers) ?? [1]));
  const days = dday ? daysUntil(dday.date) : null;
  const plan = days !== null ? planFor(days) : null;

  const saveDay = async () => {
    const value = dayInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
      setDayError('날짜를 2026-10-15 처럼 적어 주세요.');
      return;
    }
    await saveDday({ date: value, label: '' });
    setEditingDay(false);
    setDayError(null);
  };

  const statsBlock = stats ? (
    <Card style={styles.stats}>
      <View style={styles.statRow}>
        <Stat label="이번 주 연습" value={`${stats.weekPractices}회`} />
        <Stat label="답변" value={`${stats.weekAnswers}개`} />
        <Stat label="말한 시간" value={formatAnswerDuration(stats.weekSpeakingMs)} />
        <Stat label="연속" value={`${stats.streakDays}일`} />
      </View>
      <View accessibilityLabel={`최근 7일 답변 수 ${stats.week.map((day) => day.answers).join(', ')}`} style={styles.bars}>
        {stats.week.map((day) => {
          const date = new Date(`${day.date}T00:00:00`);
          return (
            <View key={day.date} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${Math.round((day.answers / maxDay) * 100)}%` }, day.answers ? null : styles.barEmpty]} />
              </View>
              <AppText tone="muted" variant="badge">
                {WEEKDAYS[date.getDay()]}
              </AppText>
            </View>
          );
        })}
      </View>
    </Card>
  ) : (
    <Skeleton height={160} />
  );

  const ddayBlock = (
    <Card style={styles.dday}>
      <View style={styles.ddayHead}>
        <CalendarDays {...decorative} color={colors.brand} size={iconSizes.section} />
        <View style={styles.flex}>
          <AppText tone="muted" variant="badge">
            면접 날짜
          </AppText>
          <AppText variant="itemTitle">
            {days === null ? '면접 날짜를 넣으면 오늘 할 만큼을 알려 드려요' : days > 0 ? `D-${days}, ${plan?.stage}` : plan?.stage}
          </AppText>
        </View>
      </View>
      {plan && days !== null && days >= 0 ? (
        <AppText tone="muted" variant="meta">{`오늘은 ${plan.goal}문항 말하기. ${plan.tip}`}</AppText>
      ) : plan ? (
        <AppText tone="muted" variant="meta">
          {plan.tip}
        </AppText>
      ) : null}
      {editingDay ? (
        <View style={styles.block}>
          <AuthField error={dayError} keyboardType="numbers-and-punctuation" label="면접 날짜" maxLength={10} onChangeText={setDayInput} placeholder="2026-10-15" value={dayInput} />
          <View style={styles.inline}>
            <Button onPress={() => void saveDay()} size="small">
              저장
            </Button>
            {dday ? (
              <Button
                onPress={() => {
                  void saveDday(null);
                  setEditingDay(false);
                }}
                size="small"
                variant="ghost"
              >
                날짜 지우기
              </Button>
            ) : null}
          </View>
        </View>
      ) : (
        <Button
          onPress={() => {
            setDayInput(dday?.date ?? '');
            setEditingDay(true);
          }}
          size="small"
          variant="secondary"
        >
          {dday ? '날짜 바꾸기' : '날짜 넣기'}
        </Button>
      )}
      <AppText tone="faint" variant="badge">
        날짜는 이 기기에만 저장해요.
      </AppText>
    </Card>
  );

  const empty = sessions && sessions.length === 0 && remote !== null && remote.length === 0;

  return (
    <Screen padded={false}>
      <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/interview'))} title="연습 기록" />
      <ScrollView style={styles.scroll}>
        <View style={[styles.content, { paddingHorizontal: gutter }]}>
          <AppText tone="muted" variant="body">
            멈춘 연습은 이어서 하고, 끝난 연습은 답변과 피드백을 다시 확인하세요.
          </AppText>
          <View style={[styles.top, breakpoint !== 'compact' ? styles.topRow : null]}>
            <View style={styles.topItem}>{statsBlock}</View>
            <View style={styles.topItem}>{ddayBlock}</View>
          </View>

          {empty ? (
            <EmptyState
              actionLabel="새 연습 시작하기"
              description="질문을 준비하고 첫 면접 연습을 시작해 보세요."
              icon={MessagesSquare}
              onAction={() => router.replace('/interview')}
              title="아직 저장된 연습 기록이 없어요."
            />
          ) : null}

          {active.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="이어할 연습" />
              <Card padding={false}>
                {active.map((session, index) => (
                  <InterviewSessionRow key={session.id} last={index === active.length - 1} onPress={() => router.push(sessionDestination(session))} session={session} />
                ))}
              </Card>
            </View>
          ) : null}

          {done.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="완료한 연습" />
              <Card padding={false}>
                {done.map((session, index) => (
                  <InterviewSessionRow key={session.id} last={index === done.length - 1} onPress={() => router.push(sessionDestination(session))} session={session} />
                ))}
              </Card>
            </View>
          ) : null}

          {remote && remote.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader description="다른 기기나 예전 면접 사이트에서 남긴 기록이에요. 녹음 없이 글만 볼 수 있어요." title="다른 기기의 기록" />
              <Card padding={false}>
                {remote.map((backup, index) => (
                  <RemoteSessionRow
                    key={backup.session_id}
                    last={index === remote.length - 1}
                    onPress={() => router.push({ pathname: '/interview/report/[id]', params: { id: backup.session_id, remote: '1' } })}
                    title={backup.title}
                    updatedAt={backup.updated_at}
                  />
                ))}
              </Card>
            </View>
          ) : null}

          <AppText tone="faint" variant="badge">
            녹음과 영상은 이 기기에만 저장돼요. 연습의 글(질문, 내가 한 말, 피드백, 메모)은 계정에 보관돼 다른 기기에서도 볼 수 있어요.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText tabular variant="heading">
        {value}
      </AppText>
      <AppText tone="muted" variant="badge">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  section: { gap: spacing.md },
  top: { gap: spacing.md },
  topRow: { alignItems: 'stretch', flexDirection: 'row' },
  topItem: { flex: 1, minWidth: 0 },
  stats: { gap: spacing.lg, height: '100%' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexBasis: 64, flexGrow: 1, gap: spacing.xxs },
  bars: { flexDirection: 'row', gap: spacing.sm, height: 72 },
  barCol: { alignItems: 'center', flex: 1, gap: spacing.xs },
  barTrack: { flex: 1, justifyContent: 'flex-end', width: '100%' },
  bar: { backgroundColor: colors.brand, borderRadius: radii.badge, minHeight: 4, width: '100%' },
  barEmpty: { backgroundColor: colors.backgroundMuted },
  dday: { gap: spacing.md, height: '100%' },
  ddayHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  block: { gap: spacing.sm },
  inline: { flexDirection: 'row', gap: spacing.md },
});
