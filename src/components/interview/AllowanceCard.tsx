import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, ProgressBar } from '@/components/ui';
import type { InterviewAllowance } from '@/features/interview/interview-api';
import { PLAN } from '@/features/interview/pricing';
import { decorative } from '@/lib/a11y';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

function renewDate(ms: number | null): string | null {
  if (!ms) return null;
  const date = new Date(ms);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 이번 달 AI 피드백 연습이 몇 번 남았는지. 결제는 앱의 요금제 화면(웹에서만
 * 결제)으로 보낸다. 면접은 PREMIND 학생 요금제의 한 줄이다.
 */
export function AllowanceCard({ allowance, demo = false }: { allowance: InterviewAllowance | null; demo?: boolean }) {
  const standard = allowance?.plan === 'standard';
  const left = allowance ? (allowance.ai.freeTrial ? 1 : Math.max(0, allowance.ai.limit - allowance.ai.used)) : null;
  const headline = !allowance
    ? '남은 횟수를 확인하고 있어요'
    : allowance.ai.freeTrial
      ? 'AI 피드백 무료 체험 1회가 남았어요'
      : standard
        ? `이번 달 AI 피드백 ${left}회 남았어요`
        : 'AI 피드백 무료 체험을 썼어요';
  const detail = standard
    ? `스탠다드는 매달 ${allowance?.ai.limit ?? PLAN.aiStandardMonthly}회예요.${renewDate(allowance?.periodEnd ?? null) ? ` ${renewDate(allowance?.periodEnd ?? null)}에 다시 채워져요.` : ''}`
    : `기본 연습은 언제나 무료예요. 스탠다드는 AI 피드백 연습을 매달 ${PLAN.aiStandardMonthly}회 할 수 있어요.`;
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View {...decorative} style={styles.icon}>
          <Sparkles color={colors.brand} size={iconSizes.inline} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <AppText tone="muted" variant="meta">
            {standard ? '스탠다드' : '무료'}
          </AppText>
          <AppText variant="itemTitle">{headline}</AppText>
        </View>
      </View>
      {standard && allowance ? (
        <ProgressBar
          label="이번 달 AI 피드백 연습"
          max={Math.max(1, allowance.ai.limit)}
          tone="brand"
          value={Math.min(allowance.ai.used, allowance.ai.limit)}
        />
      ) : null}
      <AppText tone="muted" variant="meta">
        {demo ? '데모에서는 AI 피드백 없이 기본 연습만 할 수 있어요.' : detail}
      </AppText>
      {!standard ? (
        <Button fullWidth onPress={() => router.push('/subscription')} variant="outline">
          요금제 보기
        </Button>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: radii.full,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  flex: { flex: 1, gap: spacing.xxs, minWidth: 0 },
});
