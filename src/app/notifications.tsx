import { router } from 'expo-router';
import {
  BadgeCheck,
  BellOff,
  ChevronRight,
  Headphones,
  SlidersHorizontal,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  IconButton,
  Screen,
  StatusBadge,
} from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatRelativeDate } from '@/lib/format';
import { useT, type T } from '@/lib/i18n';
import { goBackOrReplace } from '@/lib/navigation';
import { useAppStore } from '@/state/app-store';
import { colors, iconSizes, radii, sizes, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

function presentation(material: StudyMaterial, t: T): {
  icon: LucideIcon;
  label: string;
  tone: 'positive' | 'negative' | 'brand';
  title: string;
  description: string;
} {
  if (material.status === 'ready') {
    return {
      icon: BadgeCheck,
      label: t('준비 완료'),
      tone: 'positive',
      title: t('마인드팩이 준비됐어요'),
      description: t('대본, 요약, 마인드맵, 문제를 바로 볼 수 있어요.'),
    };
  }
  if (material.status === 'failed') {
    return {
      icon: TriangleAlert,
      label: t('확인 필요'),
      tone: 'negative',
      title: t('마인드팩을 만들지 못했어요'),
      description: t(material.lastError ?? '원본은 그대로 있어요. 눌러서 다시 시도해 주세요.'),
    };
  }
  return {
    icon: Headphones,
    label: t('진행 중'),
    tone: 'brand',
    title: t('마인드팩을 만들고 있어요'),
    description: t(material.progressLabel),
  };
}

export default function NotificationsScreen() {
  const t = useT();
  const { materials, settings } = useAppStore();
  const notifications = [...materials]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 20);

  const openMaterial = (material: StudyMaterial) => {
    router.push(
      material.status === 'ready'
        ? { pathname: '/material/[id]', params: { id: material.id } }
        : { pathname: '/processing/[id]', params: { id: material.id } },
    );
  };

  return (
    <Screen
      maxWidth={680}
      padded={false}
      scroll
      scrollViewProps={{ showsVerticalScrollIndicator: false }}
    >
      <AppHeader
        onBack={() => goBackOrReplace('/(tabs)')}
        right={
          <IconButton
            icon={SlidersHorizontal}
            label={t('설정')}
            onPress={() => router.push('/(tabs)/profile')}
          />
        }
        title={t('알림')}
      />

      <View style={styles.content}>
        {!settings.notificationsEnabled ? (
          <Card padding={false}>
            <View style={styles.permissionRow}>
              <View {...decorative} style={styles.iconWell}>
                <BellOff color={colors.text} size={iconSizes.section} strokeWidth={1.9} />
              </View>
              <View style={styles.flex}>
                <AppText variant="itemTitle">{t('알림이 꺼져 있어요')}</AppText>
                <AppText tone="muted" variant="meta">
                  {t('켜면 마인드팩이 준비될 때 알려드려요.')}
                </AppText>
              </View>
              <Button
                onPress={() => router.push('/(tabs)/profile')}
                size="small"
                variant="primary"
              >
                {t('켜기')}
              </Button>
            </View>
          </Card>
        ) : null}

        {notifications.length === 0 ? (
          <EmptyState
            description={t('마인드팩을 만들면 진행 소식이 여기에 모여요')}
            icon={BellOff}
            title={t('아직 알림이 없어요')}
          />
        ) : (
          <View style={styles.list}>
            <AppText style={styles.listCaption} tone="muted" variant="meta">
              {t('최근 소식')}
            </AppText>
            <Card padding={false}>
              {notifications.map((material, index) => {
                const item = presentation(material, t);
                const Icon = item.icon;
                const last = index === notifications.length - 1;
                return (
                  <Pressable
                    accessibilityLabel={`${item.title}. ${material.title}`}
                    accessibilityRole="button"
                    key={material.id}
                    onPress={() => openMaterial(material)}
                    style={({ pressed }) => [
                      styles.row,
                      !last ? styles.rowDivider : null,
                      pressed ? styles.rowPressed : null,
                    ]}
                  >
                    <View {...decorative} style={styles.iconWell}>
                      <Icon color={colors.text} size={iconSizes.section} strokeWidth={1.9} />
                    </View>
                    <View style={styles.flex}>
                      <AppText numberOfLines={2} variant="itemTitle">
                        {item.title}
                      </AppText>
                      <AppText numberOfLines={1} tone="soft" variant="meta">
                        {material.title}
                      </AppText>
                      <AppText numberOfLines={2} tone="muted" variant="meta">
                        {item.description}
                      </AppText>
                      <View style={styles.footerRow}>
                        <AppText tone="faint" variant="badge">
                          {formatRelativeDate(material.updatedAt)}
                        </AppText>
                        <StatusBadge label={item.label} tone={item.tone} />
                      </View>
                    </View>
                    <ChevronRight
                      {...decorative}
                      color={colors.textFaint}
                      size={iconSizes.section}
                      strokeWidth={1.8}
                    />
                  </Pressable>
                );
              })}
            </Card>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  permissionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  iconWell: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.input,
    flexShrink: 0,
    height: sizes.iconButton,
    justifyContent: 'center',
    width: sizes.iconButton,
  },
  list: {
    gap: spacing.md,
  },
  listCaption: {
    paddingHorizontal: spacing.none,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    backgroundColor: colors.backgroundSoft,
  },
  flex: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
});
