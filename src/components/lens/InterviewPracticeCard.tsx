import { ExternalLink, MessagesSquare } from 'lucide-react-native';
import { Linking, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { INTERVIEW_URL } from '@/data/subscription-plans';
import { decorative } from '@/lib/a11y';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

export interface InterviewPracticeCardProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * The way into 면접 연습 (interview.premind.co.kr). It is a web app on the same
 * student account and plan, so this only opens it: sign in there with the same
 * e-mail. Basic practice is free; AI feedback is one free trial, then 스탠다드.
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
            자기소개서로 나올 질문에 답하고, 내가 한 말로 피드백을 받아요. 이 앱과 같은 계정으로 로그인해요.
          </AppText>
        </View>
      </View>
      <Button
        accessibilityHint="브라우저에서 면접 연습을 열어요"
        fullWidth
        onPress={() => void Linking.openURL(INTERVIEW_URL).catch(() => undefined)}
        rightIcon={<ExternalLink color={colors.text} size={iconSizes.inline} />}
        variant="outline"
      >
        면접 연습 열기
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
