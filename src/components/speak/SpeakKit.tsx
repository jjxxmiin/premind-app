import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, type AppTextTone } from '@/components/ui';
import { colors, fontFamilies, radii, shadows, spacing } from '@/theme/tokens';

/**
 * 말하기 화면의 앱다운 부품(2026-09-26 "너무 웹 같다"). 테두리 카드 대신 채운 면, 큰 제목,
 * 스픽식 둥근 녹음 버튼, Yoodli 식 지표 타일, Interview Warmup 식 인사이트 칩.
 * (공용으로 올릴 만하다: SpeakTitle, Surface, StatTile)
 */

/** 탭 첫 화면 맨 위 큰 제목(Large Title) + 한 줄 설명. */
export function SpeakTitle({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.title}>
      <AppText accessibilityRole="header" variant="display">
        {title}
      </AppText>
      {description ? (
        <AppText tone="muted" variant="body">
          {description}
        </AppText>
      ) : null}
    </View>
  );
}

export type SurfaceTone = 'raised' | 'soft' | 'brand' | 'positive';

const surfaceTones: Record<SurfaceTone, ViewStyle> = {
  /** 흰 면 + 옅은 그림자: 하나를 크게 보여 주는 카드. */
  raised: { backgroundColor: colors.surface, ...shadows.card },
  /** 옅은 회색 면: 목록, 조용한 묶음. */
  soft: { backgroundColor: colors.backgroundSoft },
  /** 옅은 주황 면: 머리 카드, 먼저 할 것. */
  brand: { backgroundColor: colors.brandSoft },
  positive: { backgroundColor: colors.positiveSoft },
};

/** 테두리 없는 면. 누르는 카드는 `SpeakCard`. */
export function Surface({
  children,
  tone = 'soft',
  padding = spacing.gutter,
  style,
  ...rest
}: PropsWithChildren<{
  tone?: SurfaceTone;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  accessible?: boolean;
  accessibilityLabel?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
}>) {
  return (
    <View {...rest} style={[styles.surface, surfaceTones[tone], { padding }, style]}>
      {children}
    </View>
  );
}

/**
 * Yoodli 결의 지표 타일: 이름, 큰 숫자와 단위, 한 줄 풀이. 2열로 놓는다.
 */
export function StatTile({
  label,
  value,
  unit,
  caption,
  captionTone = 'muted',
  detail,
  accessibilityLabel,
  style,
}: {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  captionTone?: AppTextTone;
  /** 한 줄 더: 어떻게 하면 좋은지. */
  detail?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Surface
      accessibilityLabel={accessibilityLabel ?? [label, value, unit, caption].filter(Boolean).join(' ')}
      accessible
      padding={spacing.md + spacing.xs}
      style={[styles.tile, style]}
      tone="soft"
    >
      <AppText numberOfLines={1} tone="muted" variant="label">
        {label}
      </AppText>
      <View style={styles.tileValue}>
        <AppText style={styles.bigNumber} tabular>
          {value}
        </AppText>
        {unit ? (
          <AppText numberOfLines={1} style={styles.shrink} tone="muted" variant="meta">
            {unit}
          </AppText>
        ) : null}
      </View>
      {caption ? (
        <AppText numberOfLines={2} tone={captionTone} variant="label">
          {caption}
        </AppText>
      ) : null}
      {detail ? (
        <AppText tone="muted" variant="meta">
          {detail}
        </AppText>
      ) : null}
    </Surface>
  );
}

/** 타일 2열. 홀수면 마지막 한 장은 반 폭 그대로. */
export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** 섹션 제목 줄: 앱식으로 굵고 짧게, 오른쪽에 작은 링크 하나. */
export function SpeakSectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <AppText accessibilityRole="header" style={styles.shrink} variant="heading">
        {title}
      </AppText>
      {action}
    </View>
  );
}

const TILE_GAP = spacing.sm + spacing.xs;

const styles = StyleSheet.create({
  title: { gap: spacing.xs },
  surface: { borderRadius: radii.hero },
  tile: { flexBasis: '46%', flexGrow: 1, gap: spacing.xs, minWidth: 0 },
  tileValue: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.xs },
  bigNumber: {
    color: colors.text,
    fontFamily: fontFamilies.extraBold,
    fontSize: 30,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  shrink: { flexShrink: 1, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },
  sectionTitle: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
});
