import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { PackPicker } from '@/components/interview/PackPicker';
import { PracticeMode } from '@/components/interview/PracticeMode';
import { QuestionListEditor } from '@/components/interview/QuestionListEditor';
import { ResumeQuestions } from '@/components/interview/ResumeQuestions';
import { AppText, AuthField, Button, Screen } from '@/components/ui';
import { UNTITLED_SET_TITLE } from '@/features/interview/custom';
import { blankQuestion, useInterviewPreparation } from '@/features/interview/use-interview-preparation';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { colors, spacing } from '@/theme/tokens';

export default function InterviewPrepareScreen() {
  const t = useT();
  const { breakpoint, gutter } = useLayout();
  const preparation = useInterviewPreparation();
  const { params, from, step, setStep, error, questions, preparing, prepareFromResume, expanding, toModeStep, mode, aiProblem, demo, account, starting, start } = preparation;
  const scroll = useRef<ScrollView>(null);
  const generated = from === 'resume' && questions.length > 0;
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step, generated]);

  return (
    <Screen padded={false} maxWidth={breakpoint === 'expanded' ? 820 : undefined}>
      <AppHeader onBack={() => step === 'mode' && !params.company && !params.again ? setStep('questions') : router.back()}
        subtitle={t(step === 'questions' ? '1 / 2 질문 준비' : '2 / 2 연습 방식')}
        title={t(step === 'mode' ? '연습 방식' : from === 'packs' ? '질문 고르기' : from === 'custom' ? '질문 만들기' : '자기소개서')} />
      <ScrollView keyboardShouldPersistTaps="handled" ref={scroll} style={styles.scroll}>
        <View style={[styles.content, { paddingHorizontal: gutter }]}>
          {step === 'mode' ? <PracticeMode preparation={preparation} />
            : from === 'packs' ? <PackPicker onPick={preparation.setPackId} selected={preparation.packId} />
              : from === 'resume' ? <ResumeQuestions preparation={preparation} />
                : <View style={styles.section}>
                  <AuthField label={t('연습 이름 (선택)')} maxLength={60} onChangeText={preparation.setCustomTitle} placeholder={t(UNTITLED_SET_TITLE)} value={preparation.customTitle} />
                  <QuestionListEditor onAdd={() => preparation.setQuestions((current) => [...current, blankQuestion()])} onChange={preparation.setQuestions} questions={questions} />
                </View>}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingHorizontal: gutter }]}>
        {error ? <AppText accessibilityRole="alert" tone="negative" variant="meta">{error}</AppText> : null}
        {step === 'questions' ? (
          from === 'resume' && questions.length === 0
            ? <Button variant="primary" fullWidth loading={preparing} onPress={() => void prepareFromResume()} size="large">{t('질문 만들기')}</Button>
            : <Button variant="primary" disabled={expanding} fullWidth onPress={toModeStep} size="large">{t('다음')}</Button>
        ) : (
          <Button variant="primary" disabled={(mode === 'ai' && (Boolean(aiProblem) || demo)) || account.status === 'loading'} fullWidth loading={starting} onPress={() => void start()} size="large">
            {t(mode === 'ai' ? 'AI 연습 시작' : '무료 연습 시작')}
          </Button>
        )}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  section: { gap: spacing.md },
  footer: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.sm, paddingBottom: spacing.gutter, paddingTop: spacing.md },
});
