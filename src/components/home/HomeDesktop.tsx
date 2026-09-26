import { AudioLines, Bell, FileText, FileVideo2, Plus, Search } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { AppText, Button, Card, Chip, IconButton, type PressState } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatMaterialLength, formatRelativeDate } from '@/lib/format';
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
  materialCount,
  readyCount,
  onSearch,
  onNotifications,
}: {
  name: string;
  materialCount: number;
  readyCount: number;
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
        <AppText numberOfLines={1} tone="muted" variant="meta">
          {materialCount
            ? t('자료 {n}개 중 {ready}개의 마인드팩이 준비돼 있어요', { n: materialCount, ready: readyCount })
            : t('자료를 추가하면 마인드팩을 만들어 드려요')}
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
 * 이어서 보기 and the library at a glance, side by side. The continue card is
 * the one thing on the screen most likely to be wanted next; the numbers
 * beside it answer "how much is ready" without opening anything.
 */
export function HomeDesktopOverview({
  continueMaterial,
  continueFolder,
  total,
  ready,
  processing,
  onOpen,
}: {
  continueMaterial: StudyMaterial | undefined;
  continueFolder: string;
  total: number;
  ready: number;
  processing: number;
  onOpen: (material: StudyMaterial) => void;
}) {
  const t = useT();
  const kind = continueMaterial?.source.kind;
  const Icon = kind === 'video' ? FileVideo2 : kind === 'document' ? FileText : AudioLines;
  return (
    <View style={styles.overview}>
      {continueMaterial ? (
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
                {continueFolder} /{' '}
                {formatMaterialLength(
                  continueMaterial.source.kind,
                  continueMaterial.source.durationMs,
                  continueMaterial.transcript.length,
                )}{' '}
                / {formatRelativeDate(continueMaterial.updatedAt)}
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
      ) : null}
      <Card padding={spacing.gutter} style={styles.statsCard}>
        <Stat label={t('전체')} value={total} />
        <View {...decorative} style={styles.statDivider} />
        <Stat label={t('완료')} value={ready} />
        <View {...decorative} style={styles.statDivider} />
        <Stat label={t('진행 중')} value={processing} />
      </Card>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View accessibilityLabel={`${label} ${value}`} style={styles.stat}>
      <AppText tabular variant="metric">
        {value}
      </AppText>
      <AppText numberOfLines={1} tone="muted" variant="meta">
        {label}
      </AppText>
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
          accessibilityLabel={
            tab.count === undefined
              ? t('{folder} 자료', { folder: tab.label })
              : t('{folder} 자료 {n}개', { folder: tab.label, n: tab.count })
          }
          key={tab.key}
          label={tab.count === undefined ? tab.label : `${tab.label} ${tab.count}`}
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
    backgroundColor: colors.backgroundSoft,
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
  continueCard: {
    flex: 2,
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
  statsCard: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    minWidth: 0,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  statDivider: {
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    width: 1,
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
