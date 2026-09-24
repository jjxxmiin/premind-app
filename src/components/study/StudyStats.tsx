import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText, Card } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { colors, radii, spacing } from '@/theme/tokens';
import type { QuizAttempt, QuizQuestion, StudyConcept } from '@/types';

export interface StudyStatsProps {
  concepts: readonly StudyConcept[];
  quiz: readonly QuizQuestion[];
  /** Every attempt in the store; the tile keeps only this material's. */
  attempts: readonly QuizAttempt[];
  materialId: string;
  reviewMinutes?: number;
  style?: StyleProp<ViewStyle>;
}

type Difficulty = StudyConcept['difficulty'];

const DIFFICULTIES: readonly { key: Difficulty; label: string; color: string }[] = [
  { key: 'basic', label: '기본', color: colors.borderStrong },
  { key: 'intermediate', label: '중간', color: colors.textFaint },
  { key: 'advanced', label: '심화', color: colors.text },
];

const BAR_MAX_HEIGHT = 32;
const BAR_MIN_HEIGHT = 4;
const RING_SIZE = 48;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export interface QuizScore {
  correct: number;
  answered: number;
  total: number;
}

/** The latest answer per question decides the score; unanswered questions still count in the total. */
export function quizScoreFor(
  quiz: readonly QuizQuestion[],
  attempts: readonly QuizAttempt[],
  materialId: string,
): QuizScore {
  const latest = new Map<string, QuizAttempt>();
  for (const attempt of attempts) {
    if (attempt.materialId !== materialId) continue;
    const current = latest.get(attempt.questionId);
    if (!current || attempt.attemptedAt > current.attemptedAt) {
      latest.set(attempt.questionId, attempt);
    }
  }
  let correct = 0;
  let answered = 0;
  for (const question of quiz) {
    const attempt = latest.get(question.id);
    if (!attempt) continue;
    answered += 1;
    if (attempt.isCorrect) correct += 1;
  }
  return { correct, answered, total: quiz.length };
}

export function difficultyCounts(concepts: readonly StudyConcept[]): Record<Difficulty, number> {
  const counts: Record<Difficulty, number> = { basic: 0, intermediate: 0, advanced: 0 };
  for (const concept of concepts) counts[concept.difficulty] += 1;
  return counts;
}

/**
 * Three quiet tiles: how the concepts spread across difficulty, how the
 * last round of problems went, and how long a review takes.
 */
export function StudyStats({
  concepts,
  quiz,
  attempts,
  materialId,
  reviewMinutes,
  style,
}: StudyStatsProps) {
  const counts = difficultyCounts(concepts);
  const maxCount = Math.max(1, ...DIFFICULTIES.map((item) => counts[item.key]));
  const score = quizScoreFor(quiz, attempts, materialId);
  const ratio = score.total ? score.correct / score.total : 0;

  return (
    <View style={[styles.row, style]}>
      <Card
        accessibilityLabel={`개념 난이도, ${DIFFICULTIES.map((item) => `${item.label} ${counts[item.key]}개`).join(', ')}`}
        padding={spacing.md}
        style={styles.tile}
        variant="soft"
      >
        <AppText tone="muted" variant="badge">개념</AppText>
        <View style={styles.tileBody}>
          <View {...decorative} style={styles.bars}>
            {DIFFICULTIES.map((item) => {
              const count = counts[item.key];
              const height = count
                ? BAR_MIN_HEIGHT + ((BAR_MAX_HEIGHT - BAR_MIN_HEIGHT) * count) / maxCount
                : BAR_MIN_HEIGHT;
              return (
                <View key={item.key} style={styles.barColumn}>
                  <AppText tabular tone={count ? 'default' : 'faint'} variant="badge">
                    {count}
                  </AppText>
                  <View
                    style={[
                      styles.bar,
                      { backgroundColor: count ? item.color : colors.borderStrong, height },
                    ]}
                  />
                  <AppText tone="muted" variant="badge">{item.label}</AppText>
                </View>
              );
            })}
          </View>
        </View>
      </Card>

      <Card
        accessibilityLabel={
          score.answered
            ? `문제, ${score.total}개 중 ${score.correct}개 맞혔어요`
            : '문제, 아직 안 풀었어요'
        }
        padding={spacing.md}
        style={styles.tile}
        variant="soft"
      >
        <AppText tone="muted" variant="badge">문제</AppText>
        <View style={styles.tileBody}>
          {score.answered ? (
            <View {...decorative} style={styles.ring}>
              <Svg height={RING_SIZE} width={RING_SIZE}>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  fill="none"
                  r={RING_RADIUS}
                  stroke={colors.borderStrong}
                  strokeWidth={RING_STROKE}
                />
                {ratio > 0 ? (
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    fill="none"
                    origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                    r={RING_RADIUS}
                    rotation={-90}
                    stroke={colors.text}
                    strokeDasharray={`${RING_CIRCUMFERENCE * ratio} ${RING_CIRCUMFERENCE}`}
                    strokeLinecap="round"
                    strokeWidth={RING_STROKE}
                  />
                ) : null}
              </Svg>
              <View style={styles.ringLabel}>
                <AppText tabular variant="badge">
                  {score.correct}/{score.total}
                </AppText>
              </View>
            </View>
          ) : (
            <AppText align="center" tone="muted" variant="badge">
              아직 안 풀었어요
            </AppText>
          )}
        </View>
      </Card>

      <Card
        accessibilityLabel={reviewMinutes ? `복습 ${reviewMinutes}분` : '복습 시간 미정'}
        padding={spacing.md}
        style={styles.tile}
        variant="soft"
      >
        <AppText tone="muted" variant="badge">복습</AppText>
        <View style={styles.tileBody}>
          {reviewMinutes ? (
            <View {...decorative} style={styles.metric}>
              <AppText variant="metric">{reviewMinutes}</AppText>
              <AppText tone="muted" variant="label">분</AppText>
            </View>
          ) : (
            <AppText tone="faint" variant="metric">—</AppText>
          )}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, gap: spacing.sm, minWidth: 0 },
  tileBody: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: RING_SIZE + spacing.md,
  },
  bars: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.xs },
  barColumn: { alignItems: 'center', gap: spacing.xxs, minWidth: 22 },
  bar: { borderRadius: radii.badge / 2, width: 12 },
  ring: { alignItems: 'center', justifyContent: 'center' },
  ringLabel: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  metric: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.xxs },
});
