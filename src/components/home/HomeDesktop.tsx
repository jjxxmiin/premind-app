import { AudioLines, Bell, FileText, FileVideo2, Plus, Search } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { AppText, Button, Card, Chip, IconButton, type PressState } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatRelativeDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, radii, sizes, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

import type { SubjectTab } from './SubjectTabs';

/**
 * The top of the desktop home: the greeting on the left, search and
 * notifications on the right. On a wide window the sidebar already carries
 * the wordmark, so the header carries the page's one title instead.
 */
export function HomeDesktopHeader({
  name,
  onSearch,
  onNotifications,
}: {
  name: string;
  onSearch: () => void;
  onNotifications: () => void;
}) {
  const t = useT();
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <AppText accessibilityRole="header" numberOfLines={1} variant="pageTitle">
          {t('안녕하세요, {name}님', { name })}
        </AppText>
      </View>
      <View style={styles.headerActions}>
        <Pressable
          accessibilityLabel={t('검색')}
          accessibilityRole="button"
          onPress={onSearch}
          style={({ hovered, pressed }: PressState) => [
            styles.searchBox,
            hovered ? styles.searchBoxHover : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Search {...decorative} color={colors.textMuted} size={iconSizes.inline} strokeWidth={2} />
          <AppText numberOfLines={1} tone="faint" variant="meta">
            {t('제목, 파일명, 폴더')}
          </AppText>
        </Pressable>
        <IconButton icon={Bell} label={t('알림')} onPress={onNotifications} variant="neutral" />
      </View>
    </View>
  );
}

/**
 * 이어서 보기: the one thing on the screen most likely to be wanted next.
 * The count tiles that stood beside it (전체, 완료, 진행 중) went in the
 * 2026-09-26 declutter; the grid under it already shows the library.
 */
export function HomeDesktopOverview({
  continueMaterial,
  continueFolder,
  onOpen,
}: {
  continueMaterial: StudyMaterial;
  continueFolder: string;
  onOpen: (material: StudyMaterial) => void;
}) {
  const t = useT();
  const kind = continueMaterial.source.kind;
  const Icon = kind === 'video' ? FileVideo2 : kind === 'document' ? FileText : AudioLines;
  return (
    <View style={styles.overview}>
      <Card
        padding={spacing.gutter}
        style={styles.continueCard}
      >
        <View style={styles.continueRow}>
          <View {...decorative} style={styles.continueIcon}>
            <Icon color={colors.brand} size={24} strokeWidth={1.8} />
          </View>
          <View style={styles.flex}>
            <AppText numberOfLines={1} variant="heading">
              {continueMaterial.title}
            </AppText>
            <AppText numberOfLines={1} tabular tone="muted" variant="meta">
              {continueFolder} / {formatRelativeDate(continueMaterial.updatedAt)}
            </AppText>
          </View>
          <Button
            accessibilityLabel={t('이어서 보기, {title}', { title: continueMaterial.title })}
            onPress={() => onOpen(continueMaterial)}
            size="small"
            variant="primary"
          >
            {t('이어서 보기')}
          </Button>
        </View>
      </Card>
    </View>
  );
}

/**
 * The folders as chips that wrap, instead of the phone's swipeable strip:
 * on a wide window every folder fits on screen at once, and a chip reads as
 * "a filter on the grid below" where an underlined tab reads as "a page".
 */
export function FolderChips({
  tabs,
  activeIndex,
  onSelect,
  onAddPress,
}: {
  tabs: readonly SubjectTab[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAddPress: (event: GestureResponderEvent) => void;
}) {
  const t = useT();
  return (
    <View style={styles.chips}>
      {tabs.map((tab, index) => (
        <Chip
          accessibilityLabel={t('{folder} 자료', { folder: tab.label })}
          key={tab.key}
          label={tab.label}
          onPress={() => onSelect(index)}
          selected={index === activeIndex}
          style={styles.chip}
        />
      ))}
      <Pressable
        accessibilityHint={t('새 폴더를 만들어요')}
        accessibilityLabel={t('새 폴더')}
        accessibilityRole="button"
        onPress={onAddPress}
        style={({ hovered, pressed }: PressState) => [
          styles.addChip,
          hovered ? styles.addChipHover : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <Plus {...decorative} color={colors.textMuted} size={iconSizes.dense} strokeWidth={2.2} />
        <AppText tone="muted" variant="label">
          {t('새 폴더')}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xl,
    paddingTop: spacing.xl,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.input,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    height: sizes.iconButton,
    paddingHorizontal: spacing.md,
    width: 260,
  },
  searchBoxHover: {
    backgroundColor: colors.surface,
    borderColor: colors.borderHover,
  },
  overview: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  // White on the grey page, no rule around it.
  continueCard: {
    borderColor: colors.surface,
    flex: 1,
    minWidth: 0,
  },
  continueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  continueIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSubtle,
    borderRadius: radii.tile,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    maxWidth: 260,
  },
  addChip: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.chip,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: sizes.chip,
    paddingHorizontal: 14,
  },
  addChipHover: {
    backgroundColor: colors.hover,
    borderColor: colors.borderHover,
  },
});
