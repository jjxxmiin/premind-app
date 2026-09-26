import { Image } from 'expo-image';
import type { Tabs } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, type PressState } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { useAppStore } from '@/state/app-store';
import { colors, iconSizes, radii, shadows, sizes, spacing } from '@/theme/tokens';

/**
 * The props React Navigation hands a custom `tabBar`, read off expo-router's
 * `Tabs` so the (transitive) bottom-tabs package never becomes an import.
 */
type AppTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>['tabBar']>
>[0];

type Route = AppTabBarProps['state']['routes'][number];

/** Height of the row of tabs, above the system navigation bar. */
const TAB_ROW_HEIGHT = 56;

/** The launcher route: opens the 자료 추가 sheet rather than being a tab. */
const CREATE_ROUTE = 'create';
/** Drawn as the account cell at the foot of the sidebar, not as a menu item. */
const PROFILE_ROUTE = 'profile';

/** Sidebar width on a laptop or desktop window (expanded breakpoint). */
export const SIDEBAR_WIDTH = sizes.sidebar;

/**
 * The tab bar, drawn by us: a bottom bar on phones and tablets, a sidebar on
 * laptop and desktop windows.
 *
 * React Navigation's own bar takes the bottom inset from a hook that, on an
 * edge-to-edge Android window in Expo Go, reported nothing — so the bar sat
 * under the navigation bar and its labels were cut off. `SafeAreaView` from
 * react-native-safe-area-context measures the inset natively, the same way
 * every stack screen already does, so the row always clears the system bar.
 */
export function AppTabBar(props: AppTabBarProps) {
  const { breakpoint } = useLayout();
  // A laptop or desktop window gets a sidebar (2026-09-26 CEO: the web must work on
  // phone, tablet, laptop and desktop). The Tabs layout moves the bar to the left
  // at the same breakpoint (tabBarPosition), so this only changes how it is drawn.
  return breakpoint === 'expanded' ? <SideBar {...props} /> : <BottomBar {...props} />;
}

function tabLabel(options: AppTabBarProps['descriptors'][string]['options'], name: string): string {
  return typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? name;
}

function isHidden(options: AppTabBarProps['descriptors'][string]['options']): boolean {
  return StyleSheet.flatten(options.tabBarItemStyle)?.display === 'none';
}

/** The press handler every tab shares: emit tabPress, navigate unless prevented. */
function pressHandler(
  navigation: AppTabBarProps['navigation'],
  route: Route,
  focused: boolean,
) {
  return () => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  };
}

/** First letter of the name, for the account cell's round avatar. */
function initialOf(name: string): string {
  const letter = Array.from(name.trim())[0] ?? 'P';
  return letter.toUpperCase();
}

/**
 * The sidebar, top to bottom: the wordmark, the one primary action
 * (자료 추가, a filled button so it never reads as a second selected tab),
 * the menu, and the account at the foot.
 */
function SideBar({ state, descriptors, navigation }: AppTabBarProps) {
  const t = useT();
  const { session } = useAppStore();
  const displayName = session?.user.name?.trim() || t('PREMIND 사용자');
  const email = session?.user.email ?? '';

  const entries = state.routes
    .map((route, index) => ({ route, index, descriptor: descriptors[route.key] }))
    .filter(
      (entry): entry is typeof entry & { descriptor: NonNullable<typeof entry.descriptor> } =>
        Boolean(entry.descriptor) && !isHidden(entry.descriptor!.options),
    );
  const create = entries.find((entry) => entry.route.name === CREATE_ROUTE);
  const profile = entries.find((entry) => entry.route.name === PROFILE_ROUTE);
  const menu = entries.filter(
    (entry) => entry.route.name !== CREATE_ROUTE && entry.route.name !== PROFILE_ROUTE,
  );

  return (
    <SafeAreaView edges={['top', 'bottom', 'left']} style={styles.side}>
      <Image
        accessibilityLabel="PREMIND"
        contentFit="contain"
        source={require('../../assets/brand/wordmark.png')}
        style={styles.sideWordmark}
      />

      {create ? (
        <Pressable
          accessibilityLabel={create.descriptor.options.tabBarAccessibilityLabel ?? t('자료 추가')}
          accessibilityRole="button"
          key={create.route.key}
          onPress={pressHandler(navigation, create.route, state.index === create.index)}
          style={({ hovered, pressed }: PressState) => [
            styles.addButton,
            hovered && !pressed ? styles.addButtonHover : null,
            pressed ? styles.addButtonPressed : null,
          ]}
          testID={create.descriptor.options.tabBarButtonTestID}
        >
          <Plus {...decorative} color={colors.textInverse} size={iconSizes.inline + 2} strokeWidth={2.4} />
          <AppText style={styles.addLabel} variant="label">
            {t('자료 추가')}
          </AppText>
        </Pressable>
      ) : null}

      <View accessibilityRole="tablist" style={styles.sideList}>
        {menu.map(({ route, index, descriptor }) => {
          const { options } = descriptor;
          const focused = state.index === index;
          const color = focused ? colors.brandText : colors.textSoft;
          const label = tabLabel(options, route.name);
          const icon = options.tabBarIcon?.({ focused, color, size: 20 });
          return (
            <Pressable
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={route.key}
              onPress={pressHandler(navigation, route, focused)}
              style={({ hovered, pressed }: PressState) => [
                styles.sideItem,
                focused ? styles.sideItemOn : hovered ? styles.sideItemHover : null,
                pressed ? styles.pressed : null,
              ]}
              testID={options.tabBarButtonTestID}
            >
              <View style={styles.sideIcon}>{icon}</View>
              <AppText numberOfLines={1} style={[styles.sideLabel, { color }]} variant="label">
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sideSpacer} />

      {profile ? (
        <Pressable
          accessibilityLabel={
            profile.descriptor.options.tabBarAccessibilityLabel ?? tabLabel(profile.descriptor.options, profile.route.name)
          }
          accessibilityRole="tab"
          accessibilityState={{ selected: state.index === profile.index }}
          key={profile.route.key}
          onPress={pressHandler(navigation, profile.route, state.index === profile.index)}
          style={({ hovered, pressed }: PressState) => [
            styles.account,
            state.index === profile.index ? styles.sideItemOn : hovered ? styles.sideItemHover : null,
            pressed ? styles.pressed : null,
          ]}
          testID={profile.descriptor.options.tabBarButtonTestID}
        >
          <View {...decorative} style={styles.avatar}>
            <AppText style={styles.avatarLetter} variant="label">
              {initialOf(displayName)}
            </AppText>
          </View>
          <View style={styles.accountCopy}>
            <AppText numberOfLines={1} variant="label">
              {displayName}
            </AppText>
            {email ? (
              <AppText numberOfLines={1} tone="muted" variant="badge">
                {email}
              </AppText>
            ) : null}
          </View>
          <ChevronRight {...decorative} color={colors.textFaint} size={iconSizes.inline} strokeWidth={2} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function BottomBar({ state, descriptors, navigation }: AppTabBarProps) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.bar}>
      <View accessibilityRole="tablist" style={styles.row}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          if (!descriptor) return null;
          const { options } = descriptor;
          if (isHidden(options)) return null;

          const focused = state.index === index;
          // The middle launcher is the one "go" of the bar: a small brand disc,
          // so the add button reads as an action and not as a sixth place.
          const launcher = route.name === CREATE_ROUTE;
          const color = focused ? colors.brand : colors.textMuted;
          const label = tabLabel(options, route.name);
          const icon = launcher ? (
            <View {...decorative} style={styles.launcherDisc}>
              <Plus color={colors.textInverse} size={iconSizes.section} strokeWidth={2.4} />
            </View>
          ) : (
            options.tabBarIcon?.({ focused, color, size: 22 })
          );

          return (
            <Pressable
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={route.key}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route.key })
              }
              onPress={pressHandler(navigation, route, focused)}
              style={({ pressed }) => [styles.item, pressed ? styles.pressed : null]}
              testID={options.tabBarButtonTestID}
            >
              <View style={styles.icon}>{icon}</View>
              <AppText
                maxFontSizeMultiplier={1.4}
                style={[styles.label, { color: launcher ? colors.textSoft : color }]}
                variant="badge"
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  side: {
    backgroundColor: colors.surface,
    borderRightColor: colors.border,
    borderRightWidth: StyleSheet.hairlineWidth,
    height: '100%',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    width: SIDEBAR_WIDTH,
  },
  sideWordmark: {
    height: 22,
    marginBottom: spacing.xl,
    marginLeft: spacing.sm,
    width: 110,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radii.button,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    minHeight: sizes.button,
    paddingHorizontal: spacing.md,
    ...shadows.subtle,
  },
  addButtonHover: {
    backgroundColor: colors.brandStrong,
    ...shadows.card,
  },
  addButtonPressed: {
    backgroundColor: colors.brandPressed,
    transform: [{ scale: 0.98 }],
  },
  addLabel: {
    color: colors.textInverse,
  },
  sideList: {
    gap: spacing.xxs,
  },
  sideItem: {
    alignItems: 'center',
    borderRadius: radii.input,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  sideItemOn: {
    backgroundColor: colors.brandSubtle,
  },
  sideItemHover: {
    backgroundColor: colors.hover,
  },
  sideIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
  },
  sideLabel: {
    flex: 1,
    minWidth: 0,
  },
  sideSpacer: {
    flex: 1,
  },
  account: {
    alignItems: 'center',
    borderRadius: radii.input,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: radii.full,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  avatarLetter: {
    color: colors.brandText,
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
  },
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    height: TAB_ROW_HEIGHT,
    paddingHorizontal: spacing.sm,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingTop: 6,
  },
  icon: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
  },
  launcherDisc: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radii.full,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
