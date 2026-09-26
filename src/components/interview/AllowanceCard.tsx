import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Surface } from '@/components/speak/SpeakKit';
import { AppText } from '@/components/ui';
import type { InterviewAllowance } from '@/features/interview/interview-api';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, spacing } from '@/theme/tokens';

/**
 * 이번 달 AI 피드백 연습이 몇 번 남았는지. 결제는 앱의 요금제 화면(웹에서만
 * 결제)으로 보낸다. 면접은 PREMIND 학생 요금제의 한 줄이다.
 * 2026-09-26 덜어내기: 흰 카드에 한 문장. 무료면 카드가 요금제 화면을 연다.
 */
export function AllowanceCard({ allowance, demo = false }: { allowance: InterviewAllowance | null; demo?: boolean }) {
  const t = useT();
  const standard = allowance?.plan === 'standard';
  const left = allowance ? (allowance.ai.freeTrial ? 1 : Math.max(0, allowance.ai.limit - allowance.ai.used)) : null;
  const headline = demo
    ? t('데모에서는 기본 연습만 할 수 있어요')
    : !allowance
      ? t('남은 횟수를 확인하고 있어요')
    : allowance.ai.freeTrial
      ? t('AI 피드백 무료 체험 1회가 남았어요')
      : standard
        ? t('이번 달 AI 피드백 {n}회 남았어요', { n: left })
        : t('AI 피드백 무료 체험을 썼어요');
  // 2026-09-26 덜어내기: 한 줄(숫자는 문장 안에 한 번). 무료면 줄 전체가 요금제 화면을 연다(따로 버튼 없음).
  const row = (
    <View style={styles.head}>
      <AppText style={styles.flex} variant="bodyStrong">
        {headline}
      </AppText>
      {!standard ? <ChevronRight {...decorative} color={colors.textFaint} size={iconSizes.inline} /> : null}
    </View>
  );
  if (standard) {
    return (
      <Surface accessibilityLabel={headline} accessible tone="raised">
        {row}
      </Surface>
    );
  }
  return (
    <Pressable
      accessibilityHint={t('요금제 보기')}
      accessibilityLabel={headline}
      accessibilityRole="button"
      onPress={() => router.push('/subscription')}
      style={({ pressed }) => [styles.press, pressed ? styles.pressed : null]}
    >
      <Surface tone="raised">{row}</Surface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  press: { cursor: 'pointer' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
