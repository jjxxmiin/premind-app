import { ArrowUp, FileText, Link2, Mic, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, type PressState } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { inputReset } from '@/theme/input-reset';
import { colors, fontFamilies, illustration, radii, spacing, typography } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

/**
 * The top of the phone home in direction D (2026-10-04, CEO "D로 가"): on the
 * dark top, a greeting and one box that starts a 마인드팩 — paste a YouTube
 * link and send it, or tap 녹음, 파일, 링크. It sits in the 전체 page's list
 * header, so it scrolls away and the library keeps the screen after it.
 */
export function HomeHero({
  name,
  onRecord,
  onImport,
  onLink,
}: {
  readonly name: string;
  readonly onRecord: () => void;
  readonly onImport: () => void;
  /** Opens the YouTube dialog, pre-filled with whatever was typed here. */
  readonly onLink: (text: string) => void;
}) {
  const t = useT();
  const [text, setText] = useState('');
  const send = () => {
    onLink(text.trim());
    setText('');
  };
  return (
    <View style={styles.hero}>
      <AppText accessibilityRole="header" style={styles.greeting} variant="pageTitle">
        {name
          ? t('{name}님, 오늘은 무엇을 공부할까요?', { name })
          : t('오늘은 무엇을 공부할까요?')}
      </AppText>
      <View style={styles.box}>
        <TextInput
          accessibilityLabel={t('유튜브 링크')}
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="url"
          onChangeText={setText}
          onSubmitEditing={() => (text.trim() ? send() : undefined)}
          // Short enough for a 360dp phone at a large font size (2026-10-04 QA: the
          // longer line ran past the dark box).
          numberOfLines={1}
          placeholder={t('유튜브 링크를 붙여 넣어 보세요')}
          placeholderTextColor={colors.stageMuted}
          returnKeyType="send"
          style={[styles.input, inputReset]}
          testID="home-start-input"
          value={text}
        />
        <View style={styles.actions}>
          {/* 녹음 is the product's core action, so it alone carries the accent. */}
          <StartChip accent icon={Mic} label={t.ctx('start', '녹음')} onPress={onRecord} testID="home-start-record" />
          <StartChip icon={FileText} label={t('파일')} onPress={onImport} testID="home-start-import" />
          <StartChip icon={Link2} label={t('링크')} onPress={() => onLink(text.trim())} testID="home-start-youtube" />
          <View style={styles.flex} />
          <Pressable
            accessibilityLabel={t('유튜브 링크로 만들기')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !text.trim() }}
            disabled={!text.trim()}
            onPress={send}
            style={({ pressed }: PressState) => [
              styles.send,
              !text.trim() ? styles.sendIdle : null,
              pressed ? styles.pressed : null,
            ]}
            testID="home-start-send"
          >
            <ArrowUp {...decorative} color={colors.text} size={18} strokeWidth={2.6} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function StartChip({
  icon: Icon,
  label,
  onPress,
  accent = false,
  testID,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onPress: () => void;
  readonly accent?: boolean;
  readonly testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }: PressState) => [
        styles.chip,
        accent ? styles.chipAccent : null,
        pressed ? styles.pressed : null,
      ]}
      testID={testID}
    >
      <Icon {...decorative} color={colors.textInverse} size={16} strokeWidth={2.2} />
      <AppText style={styles.chipLabel} variant="label">
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * 오늘의 복습 (direction D): the two quickest ways back into the newest ready
 * 마인드팩, as pastel tiles — its 문제, and its 암기 카드. Nothing appears
 * until a 마인드팩 is ready.
 */
export function TodayReview({
  material,
  onQuiz,
  onCards,
}: {
  readonly material?: StudyMaterial;
  readonly onQuiz: (material: StudyMaterial) => void;
  readonly onCards: (material: StudyMaterial) => void;
}) {
  const t = useT();
  if (!material) return null;
  const questions = material.quiz.length;
  return (
    <View style={styles.review}>
      <AppText accessibilityRole="header" variant="heading">
        {t('오늘의 복습')}
      </AppText>
      <View style={styles.reviewRow}>
        {questions > 0 ? (
          <ReviewTile
            caption={t('문제 {n}개', { n: questions })}
            captionColor={REVIEW_TONES.quiz.ink}
            fill={REVIEW_TONES.quiz.fill}
            onPress={() => onQuiz(material)}
            testID="home-review-quiz"
            title={material.title}
          />
        ) : null}
        <ReviewTile
          caption={t('암기 카드')}
          captionColor={REVIEW_TONES.cards.ink}
          fill={REVIEW_TONES.cards.fill}
          onPress={() => onCards(material)}
          testID="home-review-cards"
          title={material.title}
        />
      </View>
    </View>
  );
}

/** Lavender for 문제, sky for 카드: the illustration washes, darkened ink on top. */
const REVIEW_TONES = {
  quiz: { fill: illustration.tones.lavender, ink: '#5B47B8' },
  cards: { fill: illustration.tones.sky, ink: '#2F68C8' },
} as const;

function ReviewTile({
  caption,
  captionColor,
  fill,
  title,
  onPress,
  testID,
}: {
  readonly caption: string;
  readonly captionColor: string;
  readonly fill: string;
  readonly title: string;
  readonly onPress: () => void;
  readonly testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`${caption}, ${title}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }: PressState) => [styles.tile, { backgroundColor: fill }, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <AppText style={{ color: captionColor }} variant="badge">
        {caption}
      </AppText>
      <AppText numberOfLines={2} variant="itemTitle">
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.sm },
  greeting: { color: colors.textInverse },
  box: {
    backgroundColor: colors.stageRaised,
    borderRadius: 24,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  input: {
    color: colors.textInverse,
    fontFamily: fontFamilies.medium,
    fontSize: typography.body.fontSize,
    minHeight: 24,
  },
  actions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.stageBorder,
    borderRadius: radii.full,
    flexDirection: 'row',
    gap: spacing.xs + 2,
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  chipAccent: { backgroundColor: colors.brand },
  chipLabel: { color: colors.textInverse },
  send: {
    alignItems: 'center',
    backgroundColor: colors.textInverse,
    borderRadius: radii.full,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  sendIdle: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  review: { gap: spacing.md },
  reviewRow: { flexDirection: 'row', gap: spacing.md },
  tile: {
    borderRadius: 22,
    flex: 1,
    gap: spacing.lg,
    minHeight: 104,
    padding: spacing.lg,
  },
});
