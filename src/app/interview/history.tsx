import { router } from 'expo-router';
import { CalendarDays, MessagesSquare } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { InterviewSessionRow, RemoteSessionRow } from '@/components/interview/InterviewSessionRow';
import { SpeakColumns, SpeakFrame } from '@/components/speak/SpeakColumns';
import { Surface } from '@/components/speak/SpeakKit';
import {
  AppText,
  AuthField,
  Button,
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
import { useLocale, useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { colors, fontFamilies, iconSizes, radii, spacing } from '@/theme/tokens';
import { INTERVIEW_HOME } from '@/features/interview/routes';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * 연습 기록. 멈춘 연습은 이어서 하고, 끝난 연습은 답변과 피드백을 다시 본다.
 * 숫자는 얼마나 연습했는지만 센다(점수 아님). 다른 기기나 옛 면접 사이트에서
 * 남긴 기록도 함께 보이고, 그 기록은 읽기만 한다.
 */
export default function InterviewHistoryScreen() {
  const t = useT();
  const locale = useLocale();
  const { breakpoint, gutter } = useLayout();
  const wide = breakpoint === 'expanded';
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

  // 2026-09-26 덜어내기(알라미 결): 큰 숫자 하나(이번 주 연습) + 7일 막대, 나머지 셋은 작은 한 줄.
  const statsBlock = stats ? (
    <Surface style={styles.stats} tone="raised">
      <View style={styles.statHead}>
        <AppText tone="muted" variant="label">
          {t('이번 주 연습')}
        </AppText>
        <AppText style={styles.bigNumber} tabular>
          {t.ctx('stat', '{n}회', { n: stats.weekPractices })}
        </AppText>
        <AppText tone="muted" variant="meta">
          {[
            t('답변 {n}개', { n: stats.weekAnswers }),
            formatAnswerDuration(stats.weekSpeakingMs, locale),
            t('{n}일 연속', { n: stats.streakDays }),
          ].join(' / ')}
        </AppText>
      </View>
      <View accessibilityLabel={t('최근 7일 답변 수 {list}', { list: stats.week.map((day) => day.answers).join(', ') })} style={styles.bars}>
        {stats.week.map((day) => {
          const date = new Date(`${day.date}T00:00:00`);
          return (
            <View key={day.date} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${Math.round((day.answers / maxDay) * 100)}%` }, day.answers ? null : styles.barEmpty]} />
              </View>
              <AppText tone="muted" variant="badge">
                {(locale === 'en' ? WEEKDAYS_EN : WEEKDAYS)[date.getDay()]}
              </AppText>
            </View>
          );
        })}
      </View>
    </Surface>
  ) : (
    <Skeleton height={160} />
  );

  // 면접 날짜: 없으면 한 줄(아이콘, 이름, 넣기 버튼). 있으면 D-날짜와 오늘 할 만큼.
  const ddayBlock = (
    <Surface style={styles.dday} tone="raised">
      <View style={styles.ddayHead}>
        <CalendarDays {...decorative} color={colors.brand} size={iconSizes.section} />
        <AppText style={styles.flex} variant="itemTitle">
          {days === null ? t('면접 날짜') : days > 0 ? `D-${days}, ${t(plan?.stage ?? '')}` : t(plan?.stage ?? '')}
        </AppText>
        {editingDay ? null : (
          <Button
            onPress={() => {
              setDayInput(dday?.date ?? '');
              setEditingDay(true);
            }}
            size="small"
            variant="secondary"
          >
            {t(dday ? '날짜 바꾸기' : '날짜 넣기')}
          </Button>
        )}
      </View>
      {plan && days !== null && days >= 0 ? (
        <AppText tone="muted" variant="meta">{t('오늘은 {n}문항 말하기. {tip}', { n: plan.goal, tip: t(plan.tip) })}</AppText>
      ) : plan ? (
        <AppText tone="muted" variant="meta">
          {t(plan.tip)}
        </AppText>
      ) : null}
      {editingDay ? (
        <View style={styles.block}>
          <AuthField error={dayError ? t(dayError) : dayError} keyboardType="numbers-and-punctuation" label={t('면접 날짜')} maxLength={10} onChangeText={setDayInput} placeholder="2026-10-15" value={dayInput} />
          <View style={styles.inline}>
            <Button variant="primary" onPress={() => void saveDay()} size="small">
              {t('저장')}
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
                {t('날짜 지우기')}
              </Button>
            ) : null}
          </View>
        </View>
      ) : null}
    </Surface>
  );

  const empty = sessions && sessions.length === 0 && remote !== null && remote.length === 0;

  const lists = (
    <>
          {empty ? (
            <EmptyState
              actionLabel={t('새 연습 시작하기')}
              description={t('질문을 준비하고 첫 면접 연습을 시작해 보세요.')}
              icon={MessagesSquare}
              onAction={() => router.replace(INTERVIEW_HOME)}
              title={t('아직 저장된 연습 기록이 없어요.')}
            />
          ) : null}

          {active.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={t('이어할 연습')} />
              <Surface padding={0} style={styles.clip} tone="raised">
                {active.map((session, index) => (
                  <InterviewSessionRow key={session.id} last={index === active.length - 1} onPress={() => router.push(sessionDestination(session))} session={session} showStatus={false} />
                ))}
              </Surface>
            </View>
          ) : null}

          {done.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={t('완료한 연습')} />
              <Surface padding={0} style={styles.clip} tone="raised">
                {done.map((session, index) => (
                  <InterviewSessionRow key={session.id} last={index === done.length - 1} onPress={() => router.push(sessionDestination(session))} session={session} />
                ))}
              </Surface>
            </View>
          ) : null}

          {remote && remote.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={t('다른 기기의 기록')} />
              <Surface padding={0} style={styles.clip} tone="raised">
                {remote.map((backup, index) => (
                  <RemoteSessionRow
                    key={backup.session_id}
                    last={index === remote.length - 1}
                    onPress={() => router.push({ pathname: '/interview/report/[id]', params: { id: backup.session_id, remote: '1' } })}
                    title={backup.title}
                    updatedAt={backup.updated_at}
                  />
                ))}
              </Surface>
            </View>
          ) : null}

    </>
  );

  return (
    <Screen background="soft" fullBleed padded={false}>
      <SpeakFrame>
        <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace(INTERVIEW_HOME))} title={t('연습 기록')} />
      </SpeakFrame>
      <ScrollView style={styles.scroll}>
        <SpeakFrame>
          <View style={[styles.content, { paddingHorizontal: gutter }]}>
            {wide ? (
              <SpeakColumns
                main={lists}
                side={
                  <>
                    {statsBlock}
                    {ddayBlock}
                  </>
                }
                sideWidth={360}
              />
            ) : (
              <>
                {statsBlock}
                {lists}
                {ddayBlock}
              </>
            )}
          </View>
        </SpeakFrame>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.xxl, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  section: { gap: spacing.md },
  stats: { gap: spacing.lg },
  statHead: { gap: spacing.xxs },
  bigNumber: {
    color: colors.text,
    fontFamily: fontFamilies.extraBold,
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  clip: { overflow: 'hidden' },
  bars: { flexDirection: 'row', gap: spacing.sm, height: 72 },
  barCol: { alignItems: 'center', flex: 1, gap: spacing.xs, minWidth: 0 },
  barTrack: { flex: 1, justifyContent: 'flex-end', maxWidth: 28, width: '100%' },
  bar: { backgroundColor: colors.brand, borderRadius: radii.badge, minHeight: 4, width: '100%' },
  barEmpty: { backgroundColor: colors.backgroundMuted },
  dday: { gap: spacing.md },
  ddayHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  block: { gap: spacing.sm },
  inline: { flexDirection: 'row', gap: spacing.md },
});
