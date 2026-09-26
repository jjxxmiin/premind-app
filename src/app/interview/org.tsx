import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Copy, Plus, Users } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import {
  AppText,
  AuthField,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  Screen,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  StatusBadge,
  Toast,
  useToast,
} from '@/components/ui';
import { demoOrgReport } from '@/features/interview/demo-fixtures';
import {
  closeOrgInvite,
  createOrgInvite,
  fetchOrgReport,
  fetchOrgShares,
  type OrgReport,
  type OrgShare,
} from '@/features/interview/interview-api';
import { useInterviewAccount } from '@/features/interview/use-interview-account';
import { formatAnswerDuration } from '@/features/interview/view-model';
import { enShortDate, useLocale, useT, type AppLocale } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';
import { INTERVIEW_HOME } from '@/features/interview/routes';

const PERIODS = ['7', '30', '90'] as const;

function day(ms: number | null, locale: AppLocale = 'ko'): string {
  if (!ms) return '-';
  const date = new Date(ms);
  if (locale === 'en') return enShortDate(date);
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function pct(a: number, b: number): string {
  return b ? `${Math.round((a / b) * 100)}%` : '-';
}

/**
 * 기관 담당자(취업센터 컨설턴트, 담임, 취업부장)가 보는 참여 현황.
 * 참여 지표만 보여 준다. 답변 내용, 점수, 순위는 보여 주지 않는다.
 * 학생이 직접 공유한 연습의 글만 따로 모아 본다(org-dashboard.tsx).
 */
export default function InterviewOrgScreen() {
  const t = useT();
  const locale = useLocale();
  const d = (ms: number | null) => day(ms, locale);
  const { breakpoint, gutter } = useLayout();
  const account = useInterviewAccount();
  const toast = useToast();
  const [days, setDays] = useState<(typeof PERIODS)[number]>('30');
  const [loadedReport, setReport] = useState<OrgReport | null>(null);
  const [loadedShares, setShares] = useState<OrgShare[] | null>(null);
  const [demoReport] = useState(demoOrgReport);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [group, setGroup] = useState('');
  const [maxUses, setMaxUses] = useState('40');
  const [validDays, setValidDays] = useState('30');
  const [creating, setCreating] = useState(false);

  const demo = account.status === 'ready' && account.demo;
  const isManager = account.status === 'ready' && account.user.role === 'manager';
  const report = demo ? demoReport : loadedReport;
  const shares = demo ? [] : loadedShares;

  useEffect(() => {
    if (demo || !isManager) return;
    let active = true;
    fetchOrgReport(Number(days))
      .then((value) => {
        if (!active) return;
        setReport(value);
        setError(null);
      })
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : '참여 현황을 불러오지 못했어요.'));
    fetchOrgShares()
      .then((value) => active && setShares(value))
      .catch(() => active && setShares([]));
    return () => {
      active = false;
    };
  }, [days, demo, isManager, reloadKey]);

  const createInvite = useCallback(async () => {
    const uses = Number(maxUses);
    const period = Number(validDays);
    if (!group.trim() || !Number.isInteger(uses) || uses < 1 || uses > 500 || !Number.isInteger(period) || period < 0 || period > 365) {
      toast.show(t('그룹 이름과 인원(1~500명)을 확인해 주세요.'));
      return;
    }
    if (demo) {
      toast.show(t('데모에서는 코드를 만들지 않아요.'));
      return;
    }
    setCreating(true);
    try {
      const code = await createOrgInvite(group.trim(), uses, period);
      await Clipboard.setStringAsync(code).catch(() => undefined);
      toast.show(t('코드 {code}를 만들었어요. 복사해 두었어요.', { code }));
      setGroup('');
      setReloadKey((value) => value + 1);
    } catch (reason) {
      toast.show(t(reason instanceof Error ? reason.message : '코드를 만들지 못했어요.'));
    } finally {
      setCreating(false);
    }
  }, [demo, group, maxUses, t, toast, validDays]);

  const header = <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace(INTERVIEW_HOME))} title={t('기관 현황')} />;

  if (account.status === 'ready' && !isManager && !demo) {
    return (
      <Screen padded={false}>
        {header}
        <EmptyState
          description={t('기관 담당자 계정으로 로그인하면 볼 수 있어요. 학교나 취업센터에서 도입을 원하시면 문의해 주세요.')}
          icon={Users}
          title={t('기관 현황')}
        />
      </Screen>
    );
  }

  const wide = breakpoint !== 'compact';
  return (
    <Screen padded={false}>
      {header}
      <ScrollView style={styles.scroll}>
        <View style={[styles.content, { paddingHorizontal: gutter }]}>
          {error ? (
            <ErrorState description={t(error)} onRetry={() => setReloadKey((value) => value + 1)} retryLabel={t('다시 시도')} />
          ) : !report ? (
            <>
              <Skeleton height={96} />
              <Skeleton height={200} />
            </>
          ) : (
            <>
              <View style={styles.heading}>
                <View style={styles.badges}>
                  {demo ? <StatusBadge label={t('예시')} tone="info" /> : null}
                  <StatusBadge label={t(report.org.kind)} tone="neutral" />
                  {report.org.licenseUntil ? <StatusBadge label={t('{date}까지 스탠다드', { date: d(report.org.licenseUntil) })} tone="brand" /> : null}
                </View>
                <AppText variant="pageTitle">{report.org.name}</AppText>
                <AppText tone="muted" variant="body">
                  {t('학생들의 가입과 연습 참여를 한눈에 확인하세요. 답변 내용과 녹음은 학생 본인만 볼 수 있어요.')}
                </AppText>
              </View>
              <SegmentedControl
                onChange={setDays}
                options={PERIODS.map((value) => ({ value, label: t('{n}일', { n: value }) }))}
                value={days}
              />
              <View style={[styles.tiles, wide ? styles.tilesRow : null]}>
                <Tile label={t('참여 학생')} sub={t('참여율 {rate}', { rate: pct(report.totals.activeMembers, report.totals.members) })} value={t.ctx('org', '{n}명', { n: report.totals.members })} />
                <Tile label={t('연습한 학생')} sub={`${d(report.from)} ~ ${d(report.to)}`} value={t.ctx('org', '{n}명', { n: report.totals.activeMembers })} />
                <Tile
                  label={t('연습')}
                  sub={t('학생당 {n}회', { n: report.totals.members ? (report.totals.practices / report.totals.members).toFixed(1) : '0' })}
                  value={t.ctx('org', '{n}회', { n: report.totals.practices })}
                />
                <Tile label={t('AI 피드백 연습')} sub={t('자소서 질문 세트 {n}개', { n: report.totals.questionSets })} value={t.ctx('org', '{n}회', { n: report.totals.aiPractices })} />
              </View>

              <View style={styles.section}>
                <SectionHeader title={t('주별 연습')} />
                <Card style={styles.weeks}>
                  {report.weeks.map((week) => {
                    const max = Math.max(1, ...report.weeks.map((item) => item.practices));
                    return (
                      <View accessibilityLabel={t('{date} 주 연습 {n}회, 학생 {m}명', { date: d(week.weekStart), n: week.practices, m: week.activeMembers })} key={week.weekStart} style={styles.weekRow}>
                        <AppText style={styles.weekLabel} tabular tone="muted" variant="meta">
                          {d(week.weekStart)}
                        </AppText>
                        <View style={styles.weekTrack}>
                          <View style={[styles.weekBar, { width: `${Math.round((week.practices / max) * 100)}%` }]} />
                        </View>
                        <AppText style={styles.weekValue} tabular variant="meta">{t.ctx('org', '{n}회', { n: week.practices })}</AppText>
                      </View>
                    );
                  })}
                </Card>
              </View>

              <View style={styles.section}>
                <SectionHeader title={t('그룹별 참여')} />
                <Card padding={false}>
                  {report.groups.map((item, index) => (
                    <View key={item.name} style={[styles.row, index < report.groups.length - 1 ? styles.divider : null]}>
                      <AppText style={styles.flex} variant="itemTitle">
                        {item.name}
                      </AppText>
                      <AppText tone="muted" variant="meta">{t('{active} / {n}명 / 연습 {p}회', { active: item.activeMembers, n: item.members, p: item.practices })}</AppText>
                    </View>
                  ))}
                </Card>
              </View>

              <View style={styles.section}>
                <SectionHeader description={t('이름, 그룹, 연습 횟수, 마지막 활동만 보여요.')} title={t('학생별 참여')} />
                {report.members.length === 0 ? (
                  <Card variant="soft">
                    <AppText tone="muted" variant="body">
                      {t('아직 가입한 학생이 없어요. 아래 초대 코드를 학생들에게 나눠 주세요.')}
                    </AppText>
                  </Card>
                ) : (
                  <Card padding={false}>
                    {report.members.map((member, index) => (
                      <View key={member.username} style={[styles.row, index < report.members.length - 1 ? styles.divider : null]}>
                        <View style={styles.flex}>
                          <AppText variant="itemTitle">{member.displayName}</AppText>
                          <AppText tone="muted" variant="meta">{t('{group} / 가입 {date}', { group: member.group || t('그룹 없음'), date: d(member.joinedAt) })}</AppText>
                        </View>
                        <View style={styles.memberRight}>
                          <AppText tabular variant="bodyStrong">{t.ctx('org', '{n}회', { n: member.practices })}</AppText>
                          <AppText tone="muted" variant="badge">
                            {member.lastActiveAt ? t('마지막 {date}', { date: d(member.lastActiveAt) }) : t('아직 없음')}
                          </AppText>
                        </View>
                      </View>
                    ))}
                  </Card>
                )}
              </View>

              <View style={styles.section}>
                <SectionHeader
                  description={t('학생은 앱의 연습 탭 면접에서 코드를 입력해 바로 참여해요. 이미 참여한 학생은 코드를 마감해도 그대로 이용할 수 있어요.')}
                  title={t('초대 코드')}
                />
                <Card padding={false}>
                  {report.invites.map((invite, index) => (
                    <View key={invite.code} style={[styles.row, index < report.invites.length - 1 ? styles.divider : null]}>
                      <View style={styles.flex}>
                        <AppText tabular variant="itemTitle">
                          {invite.code}
                        </AppText>
                        <AppText tone="muted" variant="meta">{t('{group} / {uses} / {max}명 / {until}', {
                          group: invite.group,
                          uses: invite.uses,
                          max: invite.maxUses,
                          until: invite.expiresAt ? t.ctx('org', '{date}까지', { date: d(invite.expiresAt) }) : t('제한 없음'),
                        })}</AppText>
                      </View>
                      {invite.disabled ? (
                        <StatusBadge label={t('마감')} tone="neutral" />
                      ) : (
                        <>
                          <IconButton
                            icon={Copy}
                            label={t('{code} 복사', { code: invite.code })}
                            onPress={() => void Clipboard.setStringAsync(invite.code).then(() => toast.show(t('복사했어요')))}
                            size="small"
                            variant="ghost"
                          />
                          <Button
                            onPress={() => {
                              if (demo) return;
                              void closeOrgInvite(invite.code).then(() => setReloadKey((value) => value + 1));
                            }}
                            size="small"
                            variant="ghost"
                          >
                            {t('마감하기')}
                          </Button>
                        </>
                      )}
                    </View>
                  ))}
                </Card>
                <Card style={styles.form}>
                  <AuthField label={t('반, 학과, 프로그램')} maxLength={40} onChangeText={setGroup} placeholder={t('예: 3학년 2반')} value={group} />
                  <View style={[styles.formRow, wide ? styles.tilesRow : null]}>
                    <View style={styles.flex}>
                      <AuthField keyboardType="number-pad" label={t('인원')} maxLength={3} onChangeText={setMaxUses} value={maxUses} />
                    </View>
                    <View style={styles.flex}>
                      <AuthField keyboardType="number-pad" label={t('사용 기간(일)')} maxLength={3} onChangeText={setValidDays} value={validDays} />
                    </View>
                  </View>
                  <Button variant="primary" leftIcon={<Plus color={colors.textInverse} size={iconSizes.inline} />} loading={creating} onPress={() => void createInvite()}>
                    {t('초대 코드 만들기')}
                  </Button>
                </Card>
              </View>

              <View style={styles.section}>
                <SectionHeader description={t('학생이 직접 공유한 연습만 보여요.')} title={t('학생이 공유한 연습')} />
                {!shares || shares.length === 0 ? (
                  <Card variant="soft">
                    <AppText tone="muted" variant="body">
                      {t('아직 공유된 연습이 없어요. 학생이 AI 피드백 연습 결과에서 ‘선생님께 공유하기’를 누르면 여기에 보여요.')}
                    </AppText>
                  </Card>
                ) : (
                  shares.map((share) => (
                    <Card key={share.id} style={styles.share}>
                      <AppText tone="muted" variant="meta">{t('{name} / {group} / {date} 공유', { name: share.studentName, group: share.group || t('그룹 없음'), date: d(share.sharedAt) })}</AppText>
                      <AppText variant="itemTitle">{t(share.title)}</AppText>
                      {share.payload.items.map((item, index) => (
                        <View key={index} style={styles.shareItem}>
                          <AppText variant="bodyStrong">{`${index + 1}. ${t(item.question)}`}</AppText>
                          <AppText numberOfLines={4} tone="soft" variant="meta">
                            {item.transcript || t('전사문 없음')}
                          </AppText>
                          <AppText tone="muted" variant="badge">
                            {formatAnswerDuration(item.durationMs, locale)}
                          </AppText>
                          {item.missingPoints.length ? <AppText tone="warning" variant="meta">{t('빠진 내용: {list}', { list: item.missingPoints.join(', ') })}</AppText> : null}
                          {item.nextFocus ? <AppText variant="meta">{t('다음에: {text}', { text: item.nextFocus })}</AppText> : null}
                        </View>
                      ))}
                      {share.payload.nextPractice ? <AppText tone="brand" variant="meta">{t('다음 연습: {text}', { text: share.payload.nextPractice })}</AppText> : null}
                    </Card>
                  ))
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
      <Toast message={toast.message} />
    </Screen>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card style={styles.tile}>
      <AppText tone="muted" variant="badge">
        {label}
      </AppText>
      <AppText tabular variant="pageTitle">
        {value}
      </AppText>
      <AppText tone="faint" variant="badge">
        {sub}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  heading: { gap: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { gap: spacing.md },
  tiles: { gap: spacing.md },
  tilesRow: { flexDirection: 'row' },
  tile: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  weeks: { gap: spacing.sm },
  weekRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  weekLabel: { width: 48 },
  weekTrack: { backgroundColor: colors.backgroundMuted, borderRadius: radii.badge, flex: 1, height: 10, overflow: 'hidden' },
  weekBar: { backgroundColor: colors.brand, height: '100%' },
  weekValue: { textAlign: 'right', width: 44 },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.gutter, paddingVertical: spacing.md },
  divider: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  memberRight: { alignItems: 'flex-end', gap: spacing.xxs },
  form: { gap: spacing.md },
  formRow: { gap: spacing.md },
  share: { gap: spacing.sm },
  shareItem: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xxs, paddingTop: spacing.sm },
});
