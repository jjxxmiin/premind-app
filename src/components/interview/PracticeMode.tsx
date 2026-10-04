import { router } from 'expo-router';
import { Video } from 'lucide-react-native';
import { StyleSheet, Switch, View } from 'react-native';
import { AppText, Button, Card, SectionHeader, StatusBadge } from '@/components/ui';
import { INTERVIEW_DISCLAIMER } from '@/features/interview/company-packs';
import { totalAnswerLabel } from '@/features/interview/custom';
import { aiPriceLabel } from '@/features/interview/practice-charge';
import { PLAN } from '@/features/interview/pricing';
import type { InterviewPreparation } from '@/features/interview/use-interview-preparation';
import { decorative } from '@/lib/a11y';
import { useLocale, useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { colors, iconSizes, spacing } from '@/theme/tokens';

export function PracticeMode({ preparation }: { readonly preparation: InterviewPreparation }) {
  const t = useT();
  const locale = useLocale();
  const { breakpoint } = useLayout();
  const { title, questionCount, pack, filled, setMode, mode, demo, allowance, aiProblem, canRecordVideo, video, setVideo } = preparation;
  return (
            <View style={styles.section}>
              <Card variant="soft" style={styles.summary}>
                <AppText variant="itemTitle">{t(title)}</AppText>
                <AppText tone="muted" variant="meta">
                  {t('질문 {count}개 / 최대 {time}', {
                    count: questionCount,
                    time: totalAnswerLabel(
                      pack ? pack.questions.map((question) => ({ answerDurationSec: question.maxDurationMs / 1000 })) : filled,
                      locale,
                    ),
                  })}
                </AppText>
              </Card>
              <SectionHeader title={t('어떻게 연습할까요?')} />
              <View accessibilityLabel={t('연습 방식')} style={[styles.modes, breakpoint !== 'compact' ? styles.modesRow : null]}>
                <ModeOption
                  body={t('녹음 없이 타이머로 연습해요.')}
                  onPress={() => setMode('basic')}
                  price={t('무료')}
                  selected={mode === 'basic'}
                  title={t('기본 연습')}
                />
                <ModeOption
                  body={t('답변을 녹음하고 피드백을 받아요.')}
                  onPress={() => setMode('ai')}
                  price={demo ? t('데모에서는 못 써요') : t(aiPriceLabel(allowance, locale))}
                  selected={mode === 'ai'}
                  title={t('AI 피드백 연습')}
                />
              </View>
              {mode === 'ai' ? (
                <Card style={styles.aiNotes}>
                  {demo ? (
                    <AppText tone="muted" variant="meta">
                      {t('데모에서는 AI 피드백을 사용할 수 없어요. 기본 연습으로 시작해 주세요.')}
                    </AppText>
                  ) : aiProblem ? (
                    <View style={styles.section}>
                      <AppText tone="negative" variant="meta">
                        {t(aiProblem)}
                      </AppText>
                      <Button onPress={() => router.push('/subscription')} variant="outline">
                        {t('요금제 보기')}
                      </Button>
                    </View>
                  ) : (
                    <AppText tone="muted" variant="meta">
                      {t('첫 답변을 시작할 때 한 번으로 세요. 스탠다드는 매달 {n}회예요. 녹음은 이 기기에만 두고, 글로 옮긴 뒤 바로 지워요.', { n: PLAN.aiStandardMonthly })}
                    </AppText>
                  )}
                  {canRecordVideo && !demo ? (
                    <View style={styles.toggle}>
                      <Video {...decorative} color={colors.textSoft} size={iconSizes.inline} />
                      <View style={styles.flex}>
                        <AppText variant="bodyStrong">{t('내 모습도 녹화하기')}</AppText>
                        <AppText tone="muted" variant="meta">
                          {t('이 브라우저에만 저장해요.')}
                        </AppText>
                      </View>
                      <Switch accessibilityLabel={t('내 모습도 녹화하기')} onValueChange={setVideo} thumbColor={colors.surface} trackColor={{ false: colors.borderStrong, true: colors.brand }} value={video} />
                    </View>
                  ) : null}
                </Card>
              ) : null}
              {pack ? (
                <AppText tone="faint" variant="badge">
                  {t(INTERVIEW_DISCLAIMER).replace(/\n/g, ' ')}
                </AppText>
              ) : null}
            </View>
  );
}
function ModeOption({ title, body, price, selected, onPress }: { readonly title: string; readonly body: string; readonly price: string; readonly selected: boolean; readonly onPress: () => void }) {
  return (
    <Card accessibilityLabel={title + ', ' + price + '. ' + body} onPress={onPress} selected={selected} style={styles.option} variant="outlined">
      <AppText variant="itemTitle">{title}</AppText>
      <StatusBadge label={price} tone={selected ? 'brand' : 'neutral'} />
      <AppText tone="muted" variant="meta">{body}</AppText>
    </Card>
  );
}
const styles = StyleSheet.create({
  section: { gap: spacing.md }, summary: { gap: spacing.xxs }, modes: { gap: spacing.md },
  modesRow: { flexDirection: 'row' }, option: { flex: 1, gap: spacing.sm }, aiNotes: { gap: spacing.md },
  toggle: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, flex: { flex: 1, minWidth: 0 },
});
