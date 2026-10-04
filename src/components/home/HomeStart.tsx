import { ChevronRight, FileText, Link2, Mic, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { MediaArtwork } from '@/components/MediaArtwork';
import { AppText, type PressState } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatRelativeDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

/**
 * The top of the phone home (2026-10-04, after wrtn's home): a greeting, the
 * three ways to start a 마인드팩 as tiles, and the one 자료 most likely wanted
 * next. It sits in the 전체 page's list header, so it scrolls away and the
 * library keeps the whole screen once the reader is past it.
 */
export function HomeStart({
  name,
  continueMaterial,
  continueFolder,
  onRecord,
  onImport,
  onYoutube,
  onOpen,
}: {
  readonly name: string;
  readonly continueMaterial?: StudyMaterial;
  readonly continueFolder?: string;
  readonly onRecord: () => void;
  readonly onImport: () => void;
  readonly onYoutube: () => void;
  readonly onOpen: (material: StudyMaterial) => void;
}) {
  const t = useT();
  return (
    <View style={styles.root}>
      <AppText accessibilityRole="header" numberOfLines={1} variant="pageTitle">
        {name ? t('안녕하세요, {name}님', { name }) : t('안녕하세요')}
      </AppText>

      <View style={styles.tiles}>
        {/* 녹음 is the product's core action, so it alone carries the accent. */}
        <StartTile accent icon={Mic} label={t('녹음')} onPress={onRecord} testID="home-start-record" />
        <StartTile icon={FileText} label={t('파일')} onPress={onImport} testID="home-start-import" />
        <StartTile icon={Link2} label={t('유튜브')} onPress={onYoutube} testID="home-start-youtube" />
      </View>

      {continueMaterial ? (
        <Pressable
          accessibilityLabel={t('이어서 보기, {title}', { title: continueMaterial.title })}
          accessibilityRole="button"
          onPress={() => onOpen(continueMaterial)}
          style={({ hovered, pressed }: PressState) => [
            styles.continue,
            hovered ? styles.continueHover : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <MediaArtwork compact kind={continueMaterial.source.kind} status={continueMaterial.status} />
          <View style={styles.flex}>
            <AppText tone="brand" variant="label">
              {t('이어서 보기')}
            </AppText>
            <AppText numberOfLines={1} variant="itemTitle">
              {continueMaterial.title}
            </AppText>
            <AppText numberOfLines={1} tabular tone="muted" variant="meta">
              {continueFolder ? `${continueFolder} / ` : ''}
              {formatRelativeDate(continueMaterial.updatedAt)}
            </AppText>
          </View>
          <ChevronRight {...decorative} color={colors.textFaint} size={iconSizes.section} strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </View>
  );
}

function StartTile({
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
      style={({ hovered, pressed }: PressState) => [
        styles.tile,
        hovered ? styles.tileHover : null,
        pressed ? styles.pressed : null,
      ]}
      testID={testID}
    >
      <View {...decorative} style={[styles.tileIcon, accent ? styles.tileIconAccent : null]}>
        <Icon
          color={accent ? colors.textInverse : colors.text}
          size={iconSizes.section}
          strokeWidth={2}
        />
      </View>
      <AppText variant="label">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tile: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.card,
    flex: 1,
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  tileHover: {
    backgroundColor: colors.hoverStrong,
  },
  tileIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  tileIconAccent: {
    backgroundColor: colors.brand,
  },
  continue: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  continueHover: {
    backgroundColor: colors.hover,
  },
  flex: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});
