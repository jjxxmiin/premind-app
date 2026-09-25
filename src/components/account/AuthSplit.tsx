import {
  BookOpenCheck,
  FileText,
  Gauge,
  Mic,
  Timer,
  Target,
  type LucideIcon,
} from 'lucide-react-native';
import type { PropsWithChildren } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

const wordmarkSource = require('../../../assets/brand/wordmark.png');
const WORDMARK_WIDTH = 132;
const WORDMARK_HEIGHT = WORDMARK_WIDTH / (1315 / 341);

export type AuthSplitTopic = 'study' | 'interview';

/** Three facts, one per part of the product, in the order a learner meets them. */
interface PanelCopy {
  title: string;
  points: { icon: LucideIcon; text: string }[];
}

const panels: Record<AuthSplitTopic, PanelCopy> = {
  study: {
    title: '강의 하나로\n복습까지 끝내요',
    points: [
      { icon: Mic, text: '녹음하거나 올리면 마인드팩이 만들어져요' },
      { icon: BookOpenCheck, text: '대본, 요약, 마인드맵, 문제로 복습해요' },
      { icon: Gauge, text: '문제를 풀수록 이해도가 쌓여요' },
    ],
  },
  // A visitor from the interview landing reads about what they came for.
  interview: {
    title: '면접도 연습하면\n익숙해져요',
    points: [
      { icon: Timer, text: '질문마다 타이머에 맞춰 답해요' },
      { icon: FileText, text: '내가 한 말을 전사문으로 돌아봐요' },
      { icon: Target, text: '다음에 먼저 고칠 것 하나를 알려줘요' },
    ],
  },
};

/**
 * The desktop frame for 로그인 and 회원가입: a solid brand panel on the left,
 * the form on the right. Below the expanded breakpoint it renders only the
 * form, so phones and tablets keep their one-column screen.
 */
export function AuthSplit({
  children,
  topic = 'study',
}: PropsWithChildren<{ topic?: AuthSplitTopic }>) {
  const { breakpoint, height } = useLayout();
  if (breakpoint !== 'expanded') return <>{children}</>;
  return (
    <View style={[styles.row, { minHeight: height }]}>
      <BrandPanel topic={topic} />
      <View style={styles.formSide}>
        <View style={styles.formColumn}>{children}</View>
      </View>
    </View>
  );
}

/** Whether the split frame is on; the form drops its own wordmark then. */
export function useAuthSplit(): boolean {
  return useLayout().breakpoint === 'expanded';
}

function BrandPanel({ topic }: { topic: AuthSplitTopic }) {
  const t = useT();
  const { title, points } = panels[topic];
  return (
    <View style={styles.panel}>
      <Image
        {...decorative}
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={wordmarkSource}
        style={styles.wordmark}
        tintColor={colors.textInverse}
      />
      <View style={styles.panelBody}>
        <AppText style={styles.panelTitle} tone="inverse" variant="display">
          {t(title)}
        </AppText>
        <View style={styles.points}>
          {points.map(({ icon: Icon, text }) => (
            <View key={text} style={styles.point}>
              <View style={styles.pointIcon}>
                <Icon
                  {...decorative}
                  color={colors.textInverse}
                  size={iconSizes.inline}
                  strokeWidth={2.2}
                />
              </View>
              <AppText style={styles.pointText} tone="inverse" variant="body">
                {t(text)}
              </AppText>
            </View>
          ))}
        </View>
      </View>
      <AppText style={styles.panelFoot} tone="inverse" variant="meta">
        {t('(주)캐모릭스')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexGrow: 1,
  },
  panel: {
    backgroundColor: colors.brandStrong,
    flexBasis: 0,
    flexGrow: 5,
    justifyContent: 'space-between',
    maxWidth: 640,
    paddingHorizontal: spacing.massive,
    paddingVertical: spacing.huge,
  },
  wordmark: {
    height: WORDMARK_HEIGHT,
    width: WORDMARK_WIDTH,
  },
  panelBody: {
    gap: spacing.xxl,
    maxWidth: 420,
  },
  panelTitle: {
    fontSize: 34,
    lineHeight: 44,
  },
  points: {
    gap: spacing.lg,
  },
  point: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  pointIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: radii.input,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  pointText: {
    flex: 1,
    opacity: 0.94,
  },
  panelFoot: {
    opacity: 0.72,
  },
  formSide: {
    alignItems: 'center',
    flexBasis: 0,
    flexGrow: 7,
    justifyContent: 'center',
    paddingHorizontal: spacing.huge,
    paddingVertical: spacing.huge,
  },
  formColumn: {
    maxWidth: 420,
    width: '100%',
  },
});
