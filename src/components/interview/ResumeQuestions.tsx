import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { QuestionListEditor } from '@/components/interview/QuestionListEditor';
import { AppText, AuthField, Button, Card, SectionHeader, TextArea } from '@/components/ui';
import { GUIDED_INPUT_LIMITS } from '@/features/interview/guided';
import { blankQuestion, MIN_RESUME_LENGTH, type InterviewPreparation } from '@/features/interview/use-interview-preparation';
import { useT } from '@/lib/i18n';
import { spacing } from '@/theme/tokens';

export function ResumeQuestions({ preparation }: { readonly preparation: InterviewPreparation }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [showPosting, setShowPosting] = useState(false);
  const { form, setForm, resumeText, questions, setQuestions, filled, generationMode, notice, expanding, server, resumeReady, allowance, expandFromResume } = preparation;
  if (questions.length > 0 && !editing) {
    return (
      <View style={styles.section}>
        <SectionHeader actionLabel={t('입력 수정')} onAction={() => setEditing(true)} title={t('질문 {n}개', { n: filled.length })}
          description={t(generationMode === 'ai' ? '자기소개서에서 만든 질문이에요. 한 개씩 확인하고 고쳐 보세요.' : '기본 질문을 준비했어요. 한 개씩 확인하고 고쳐 보세요.')} />
        {notice ? <Card variant="soft"><AppText variant="meta">{notice}</AppText></Card> : null}
        <QuestionListEditor disabled={expanding} onAdd={() => setQuestions((current) => [...current, blankQuestion()])} onChange={setQuestions} questions={questions} />
        {server && resumeReady ? (
          <View style={styles.section}>
            <Button disabled={expanding} loading={expanding} onPress={() => void expandFromResume()} variant="outline">{t('질문 더 만들기')}</Button>
            <AppText tone="muted" variant="meta">
              {allowance
                ? t('질문 생성 {n}회 남음 / 질문과 꼬리질문 추가 시 1회 사용', { n: Math.max(0, allowance.questions.limit - allowance.questions.used) })
                : t('질문과 꼬리질문을 추가하면 질문 생성 1회를 사용해요.')}
            </AppText>
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <AppText tone="muted" variant="meta">{t(questions.length > 0 ? '입력 수정은 새로 추가하는 질문에 반영돼요.' : '회사나 직무 중 하나만 적어도 시작할 수 있어요.')}</AppText>
      <AuthField label={t('지원 회사')} maxLength={GUIDED_INPUT_LIMITS.company} onChangeText={(company) => setForm((current) => ({ ...current, company }))} placeholder={t('예: 삼성전자')} value={form.company} />
      <AuthField label={t('직무')} maxLength={GUIDED_INPUT_LIMITS.jobRole} onChangeText={(jobRole) => setForm((current) => ({ ...current, jobRole }))} placeholder={t('예: 영업관리')} value={form.jobRole} />
      <TextArea hint={t('{n}자 / 맞춤 질문은 {min}자 이상', { n: resumeText.length, min: MIN_RESUME_LENGTH })}
        label={t('자기소개서 (선택)')} maxLength={GUIDED_INPUT_LIMITS.resumeText} minHeight={160}
        onChangeText={(resumeText) => setForm((current) => ({ ...current, resumeText }))}
        placeholder={t('내용을 붙여 넣으면 내 경험에 맞는 질문을 만들어요.')} value={form.resumeText} />
      <AppText tone="faint" variant="badge">{t('자기소개서는 저장하지 않아요.')}</AppText>
      {showPosting || form.jobDescription ? (
        <TextArea label={t('채용 공고 (선택)')} maxLength={GUIDED_INPUT_LIMITS.jobDescription} minHeight={88}
          onChangeText={(jobDescription) => setForm((current) => ({ ...current, jobDescription }))} value={form.jobDescription} />
      ) : <Button onPress={() => setShowPosting(true)} variant="ghost">{t('채용 공고 추가')}</Button>}
      {questions.length > 0 ? <Button onPress={() => setEditing(false)} variant="secondary">{t('질문으로 돌아가기')}</Button> : null}
    </View>
  );
}
const styles = StyleSheet.create({ section: { gap: spacing.md } });
