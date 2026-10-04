import { ChevronLeft, ChevronRight, Plus, Quote, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, IconButton, StatusBadge, TextArea } from '@/components/ui';
import { ANSWER_DURATION_OPTIONS, MAX_CUSTOM_QUESTIONS, answerDurationLabel } from '@/features/interview/custom';
import type { CustomInterviewQuestion } from '@/features/interview/types';
import { decorative } from '@/lib/a11y';
import { useLocale, useT } from '@/lib/i18n';
import { colors, iconSizes, spacing } from '@/theme/tokens';

const KIND_LABEL: Record<string, string> = {
  common: '공통 질문',
  job: '직무 질문',
  resume: '자소서 질문',
  follow_up: '꼬리질문',
};

export interface QuestionListEditorProps {
  questions: CustomInterviewQuestion[];
  onChange: (next: CustomInterviewQuestion[]) => void;
  onAdd: () => void;
  disabled?: boolean;
}

/**
 * The questions of a practice, editable: text, answer time, remove. A 자소서
 * question shows the sentence it came from; removing it removes its 꼬리질문
 * too, because a follow-up without its question makes no sense.
 */
export function QuestionListEditor({ questions, onChange, onAdd, disabled = false }: QuestionListEditorProps) {
  const t = useT();
  const locale = useLocale();
  const [page, setPage] = useState(0);
  const index = Math.min(page, Math.max(0, questions.length - 1));
  const question = questions[index];
  const update = (id: string, patch: Partial<CustomInterviewQuestion>) =>
    onChange(questions.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  const remove = (id: string) => onChange(questions.filter((question) => question.id !== id && question.parentQuestionId !== id));

  return (
    <View style={styles.list}>
      <View style={styles.navigation}>
        <IconButton disabled={disabled || index === 0} icon={ChevronLeft} label={t('이전 질문')} onPress={() => setPage(index - 1)} />
        <AppText accessibilityLiveRegion="polite" variant="label">{t('질문 {current} / {total}', { current: questions.length ? index + 1 : 0, total: questions.length })}</AppText>
        <IconButton disabled={disabled || index >= questions.length - 1} icon={ChevronRight} label={t('다음 질문')} onPress={() => setPage(index + 1)} />
      </View>
      {question ? (
        <Card key={question.id} style={[styles.card, question.kind === 'follow_up' ? styles.followUp : null]}>
          <View style={styles.head}>
            <AppText tone="muted" variant="badge">{t('{n}번 질문', { n: index + 1 })}</AppText>
            {question.kind ? <StatusBadge label={t(KIND_LABEL[question.kind] ?? '질문')} tone={question.kind === 'resume' || question.kind === 'follow_up' ? 'brand' : 'neutral'} /> : null}
            <View style={styles.spacer} />
            <IconButton
              disabled={disabled || questions.length <= 1}
              icon={Trash2}
              label={t('{n}번 질문 지우기', { n: index + 1 })}
              onPress={() => remove(question.id)}
              size="small"
              variant="ghost"
            />
          </View>
          <TextArea
            editable={!disabled}
            label={t('질문')}
            maxLength={150}
            minHeight={64}
            onChangeText={(text) => update(question.id, { question: text })}
            placeholder={t('예: 가장 도전적이었던 경험을 말해 주세요.')}
            value={question.question}
          />
          {question.sourceQuote ? (
            <View style={styles.quote}>
              <Quote {...decorative} color={colors.textFaint} size={iconSizes.dense} />
              <AppText numberOfLines={2} style={styles.flex} tone="muted" variant="meta">
                {question.sourceQuote}
              </AppText>
            </View>
          ) : null}
          <View accessibilityLabel={t('답변 시간')} accessibilityRole="radiogroup" style={styles.chips}>
            {ANSWER_DURATION_OPTIONS.map((option) => (
              <Chip
                accessibilityRole="radio"
                accessibilityState={{ selected: question.answerDurationSec === option.seconds, disabled }}
                disabled={disabled}
                key={option.seconds}
                label={answerDurationLabel(option.seconds, locale)}
                onPress={() => update(question.id, { answerDurationSec: option.seconds })}
                selected={question.answerDurationSec === option.seconds}
              />
            ))}
          </View>
        </Card>
      ) : null}
      {questions.length < MAX_CUSTOM_QUESTIONS ? (
        <Button disabled={disabled} leftIcon={<Plus color={colors.text} size={iconSizes.inline} />} onPress={() => { setPage(questions.length); onAdd(); }} variant="secondary">
          {t('질문 추가')}
        </Button>
      ) : (
        <AppText tone="muted" variant="meta">{t('질문은 {n}개까지 만들 수 있어요.', { n: MAX_CUSTOM_QUESTIONS })}</AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: { gap: spacing.md },
  followUp: { borderColor: colors.borderStrong },
  navigation: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  spacer: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  quote: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
