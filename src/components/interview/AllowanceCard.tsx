import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { MiniRing, Surface } from '@/components/speak/SpeakKit';
import { AppText, Button } from '@/components/ui';
import type { InterviewAllowance } from '@/features/interview/interview-api';
import { PLAN } from '@/features/interview/pricing';
import { enShortDate, useLocale, useT, type AppLocale } from '@/lib/i18n';
import { colors, spacing } from '@/theme/tokens';

function renewDate(ms: number | null, locale: AppLocale): string | null {
  if (!ms) return null;
  const date = new Date(ms);
  if (locale === 'en') return enShortDate(date);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 이번 달 AI 피드백 연습이 몇 번 남았는지. 결제는 앱의 요금제 화면(웹에서만
 * 결제)으로 보낸다. 면접은 PREMIND 학생 요금제의 한 줄이다.
 * 2026-09-26 앱다운: 막대 대신 작은 링 하나(가운데 남은 횟수) + 한 문장, 채운 면.
 */
export function AllowanceCard({ allowance, demo = false }: { allowance: InterviewAllowance | null; demo?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const standard = allowance?.plan === 'standard';
  const left = allowance ? (allowance.ai.freeTrial ? 1 : Math.max(0, allowance.ai.limit - allowance.ai.used)) : null;
  const ringMax = standard ? Math.max(1, allowance?.ai.limit ?? 1) : 1;
  const headline = demo
    ? t('데모에서는 기본 연습만 할 수 있어요')
    : !allowance
      ? t('남은 횟수를 확인하고 있어요')
    : allowance.ai.freeTrial
      ? t('AI 피드백 무료 체험 1회가 남았어요')
      : standard
        ? t('이번 달 AI 피드백 {n}회 남았어요', { n: left })
        : t('AI 피드백 무료 체험을 썼어요');
  const renew = renewDate(allowance?.periodEnd ?? null, locale);
  const detail = standard
    ? `${t('스탠다드는 매달 {n}회예요.', { n: allowance?.ai.limit ?? PLAN.aiStandardMonthly })}${renew ? ` ${t('{date}에 다시 채워져요.', { date: renew })}` : ''}`
    : t('기본 연습은 언제나 무료예요. 스탠다드는 AI 피드백 연습을 매달 {n}회 할 수 있어요.', { n: PLAN.aiStandardMonthly });
  return (
    <Surface style={styles.card} tone="soft">
      <View style={styles.head}>
        <MiniRing max={ringMax} size={56} stroke={6} value={demo ? 0 : left ?? 0}>
          <AppText tabular variant="heading">
            {demo || left === null ? '0' : String(left)}
          </AppText>
        </MiniRing>
        <View style={styles.flex}>
          <AppText tone="muted" variant="meta">
            {t(standard ? '스탠다드' : '무료')}
          </AppText>
          <AppText variant="itemTitle">{headline}</AppText>
        </View>
      </View>
      <AppText tone="muted" variant="meta">
        {demo ? t('로그인하면 AI 피드백 연습 첫 회를 무료로 해 볼 수 있어요.') : detail}
      </AppText>
      {!standard ? (
        <Button fullWidth onPress={() => router.push('/subscription')} style={styles.plan} variant="outline">
          {t('요금제 보기')}
        </Button>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  plan: { borderColor: colors.transparent },
});
