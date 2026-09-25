import { ChevronRight, CloudDownload, MessagesSquare } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, StatusBadge } from '@/components/ui';
import { resolveSessionSource } from '@/features/interview/session-source';
import type { InterviewSession } from '@/features/interview/types';
import {
  answeredQuestionCount,
  formatAnswerDuration,
  lastActivity,
  modeLabel,
  relativeDay,
  sessionStatusLabel,
  totalSpeakingMs,
} from '@/features/interview/view-model';
import { decorative } from '@/lib/a11y';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

export interface InterviewSessionRowProps {
  session: InterviewSession;
  onPress: () => void;
  last?: boolean;
}

/** One practice in a list: what was practised, how far, and when. */
export function InterviewSessionRow({ session, onPress, last = false }: InterviewSessionRowProps) {
  const source = resolveSessionSource(session);
  const title = source?.title ?? '질문 정보를 찾을 수 없는 면접';
  const total = source?.questions.length ?? 0;
  const status = sessionStatusLabel(session);
  const meta = [
    modeLabel(session),
    `${answeredQuestionCount(session)} / ${total}개 답변`,
    formatAnswerDuration(totalSpeakingMs(session)),
    relativeDay(lastActivity(session)),
  ].join(' / ');
  return (
    <Pressable
      accessibilityLabel={`${title}, ${status.label}, ${meta}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last ? styles.divider : null, pressed ? styles.pressed : null]}
    >
      <View {...decorative} style={styles.icon}>
        <MessagesSquare color={colors.textSoft} size={iconSizes.inline} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <AppText numberOfLines={1} variant="itemTitle">
          {title}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="meta">
          {meta}
        </AppText>
      </View>
      <StatusBadge label={status.label} tone={status.tone} />
      <ChevronRight {...decorative} color={colors.textFaint} size={iconSizes.inline} />
    </Pressable>
  );
}

/** A practice kept on the server only (another device or the old interview site). */
export function RemoteSessionRow({ title, updatedAt, onPress, last = false }: { title: string; updatedAt: number; onPress: () => void; last?: boolean }) {
  const when = relativeDay(new Date(updatedAt).toISOString());
  return (
    <Pressable
      accessibilityLabel={`${title}, 다른 기기의 기록, ${when}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last ? styles.divider : null, pressed ? styles.pressed : null]}
    >
      <View {...decorative} style={styles.icon}>
        <CloudDownload color={colors.textSoft} size={iconSizes.inline} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <AppText numberOfLines={1} variant="itemTitle">
          {title}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="meta">
          {`다른 기기의 기록 / 녹음 없음 / ${when}`}
        </AppText>
      </View>
      <ChevronRight {...decorative} color={colors.textFaint} size={iconSizes.inline} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  divider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    backgroundColor: colors.backgroundSoft,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  flex: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
});
