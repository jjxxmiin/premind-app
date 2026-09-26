import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, StatusBadge } from '@/components/ui';
import { resolveSessionSource } from '@/features/interview/session-source';
import type { InterviewSession } from '@/features/interview/types';
import {
  answeredQuestionCount,
  lastActivity,
  modeLabel,
  relativeDay,
  sessionStatusLabel,
} from '@/features/interview/view-model';
import { decorative } from '@/lib/a11y';
import { useLocale, useT } from '@/lib/i18n';
import { colors, iconSizes, spacing } from '@/theme/tokens';

export interface InterviewSessionRowProps {
  session: InterviewSession;
  onPress: () => void;
  last?: boolean;
  /** "진행 중" chip; off where the section title already says it. */
  showStatus?: boolean;
}

/** One practice in a list: what was practised, how far, and when (title + one line). */
export function InterviewSessionRow({ session, onPress, last = false, showStatus = true }: InterviewSessionRowProps) {
  const t = useT();
  const locale = useLocale();
  const source = resolveSessionSource(session);
  const title = t(source?.title ?? '질문 정보를 찾을 수 없는 면접');
  const total = source?.questions.length ?? 0;
  const status = sessionStatusLabel(session);
  const statusLabel = t(status.label);
  // 2026-09-26 덜어내기: 메타는 한 줄 둘(얼마나, 언제). 방식과 말한 시간은 결과 화면에.
  const meta = [
    t('{done} / {total}개 답변', { done: answeredQuestionCount(session), total }),
    relativeDay(lastActivity(session), new Date(), locale),
  ].join(' / ');
  const inProgress = session.status !== 'completed';
  return (
    <Pressable
      accessibilityLabel={`${title}, ${t(modeLabel(session))}, ${statusLabel}, ${meta}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [styles.row, !last ? styles.divider : null, hovered || pressed ? styles.pressed : null]}
    >
      <View style={styles.flex}>
        <AppText numberOfLines={1} variant="itemTitle">
          {title}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="meta">
          {meta}
        </AppText>
      </View>
      {inProgress && showStatus ? <StatusBadge label={statusLabel} style={styles.badge} tone={status.tone} /> : null}
      <ChevronRight {...decorative} color={colors.textFaint} size={iconSizes.inline} />
    </Pressable>
  );
}

/** A practice kept on the server only (another device or the old interview site). */
export function RemoteSessionRow({ title, updatedAt, onPress, last = false }: { title: string; updatedAt: number; onPress: () => void; last?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const when = relativeDay(new Date(updatedAt).toISOString(), new Date(), locale);
  return (
    <Pressable
      accessibilityLabel={`${t(title)}, ${t('다른 기기의 기록')}, ${when}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [styles.row, !last ? styles.divider : null, hovered || pressed ? styles.pressed : null]}
    >
      <View style={styles.flex}>
        <AppText numberOfLines={1} variant="itemTitle">
          {t(title)}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="meta">
          {t('다른 기기의 기록 / 녹음 없음 / {when}', { when })}
        </AppText>
      </View>
      <ChevronRight {...decorative} color={colors.textFaint} size={iconSizes.inline} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    cursor: 'pointer',
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
  badge: {
    alignSelf: 'center',
    flexShrink: 0,
  },
  pressed: {
    backgroundColor: colors.backgroundSoft,
  },
  flex: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
});
