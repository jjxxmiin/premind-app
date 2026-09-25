import { router } from 'expo-router';
import { ArrowRight, MessagesSquare } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

export interface InterviewPracticeCardProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * The way into 면접 연습. Since 2026-09-26 the interview practice lives in this
 * app (the 면접 tab); interview.premind.co.kr is going away. Basic practice is
 * free; AI feedback is one free trial, then 스탠다드.
 */
export function InterviewPracticeCard({ style }: InterviewPracticeCardProps) {
  return (
    <Card style={[styles.card, style]}>
      <View style={styles.head}>
        <View {...decorative} style={styles.iconWell}>
          <MessagesSquare color={colors.textSoft} size={iconSizes.inline} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <AppText variant="itemTitle">면접 연습</AppText>
          <AppText tone="muted" variant="body">
            자기소개서로 나올 질문에 답하고, 내가 한 말로 피드백을 받아요. 같은 계정, 같은 요금제로 써요.
          </AppText>
        </View>
      </View>
      <Button
        accessibilityHint="면접 탭으로 가요"
        fullWidth
        onPress={() => router.navigate('/interview')}
        rightIcon={<ArrowRight color={colors.text} size={iconSizes.inline} />}
        variant="outline"
      >
        면접 연습하기
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  head: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
    gap: spacing.xs,
  },
  iconWell: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.full,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});
