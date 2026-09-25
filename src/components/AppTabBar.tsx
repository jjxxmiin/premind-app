import { Image } from 'expo-image';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { useLayout } from '@/lib/layout';
import { colors, radii, spacing } from '@/theme/tokens';

/**
 * The props React Navigation hands a custom `tabBar`, read off expo-router's
 * `Tabs` so the (transitive) bottom-tabs package never becomes an import.
 */
type AppTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>['tabBar']>
>[0];

/** Height of the row of tabs, above the system navigation bar. */
const TAB_ROW_HEIGHT = 56;

/**
 * The bottom tab bar, drawn by us.
 *
 * React Navigation's own bar takes the bottom inset from a hook that, on an
 * edge-to-edge Android window in Expo Go, reported nothing — so the bar sat
 * under the navigation bar and its labels were cut off. `SafeAreaView` from
 * react-native-safe-area-context measures the inset natively, the same way
 * every stack screen already does, so the row always clears the system bar.
 */
/** Sidebar width on a laptop or desktop window (expanded breakpoint). */
export const SIDEBAR_WIDTH = 232;

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

function SideBar({ state, descriptors, navigation }: AppTabBarProps) {
  return (
    <SafeAreaView edges={['top', 'bottom', 'left']} style={styles.side}>
      <Image
        accessibilityLabel="PREMIND"
        contentFit="contain"
        source={require('../../assets/brand/wordmark.png')}
        style={styles.sideWordmark}
      />
      <View accessibilityRole="tablist" style={styles.sideList}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          if (!descriptor) return null;
          const { options } = descriptor;
          if (StyleSheet.flatten(options.tabBarItemStyle)?.display === 'none') return null;
          const focused = state.index === index;
          const primary = route.name === 'create';
          const color = primary ? colors.textInverse : focused ? colors.brand : colors.textSoft;
          const label = tabLabel(options, route.name);
          const icon = options.tabBarIcon?.({ focused, color, size: 20 });
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={route.key}
              onPress={onPress}
              style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                styles.sideItem,
                primary ? styles.sidePrimary : focused ? styles.sideItemOn : hovered ? styles.sideItemHover : null,
                pressed ? styles.pressed : null,
              ]}
              testID={options.tabBarButtonTestID}
            >
              <View style={styles.icon}>{icon}</View>
              <AppText style={[styles.sideLabel, { color }]} variant="body">
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
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
          const hidden =
            StyleSheet.flatten(options.tabBarItemStyle)?.display === 'none';
          if (hidden) return null;

          const focused = state.index === index;
          const color = focused ? colors.brand : colors.textMuted;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;
          const icon = options.tabBarIcon?.({ focused, color, size: 22 });

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={route.key}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route.key })
              }
              onPress={onPress}
              style={({ pressed }) => [styles.item, pressed ? styles.pressed : null]}
              testID={options.tabBarButtonTestID}
            >
              <View style={styles.icon}>{icon}</View>
              <AppText
                maxFontSizeMultiplier={1.4}
                style={[styles.label, { color }]}
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
  sideList: {
    gap: spacing.xs,
  },
  sideItem: {
    alignItems: 'center',
    borderRadius: radii.button,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  sideItemOn: {
    backgroundColor: colors.backgroundSoft,
  },
  sideItemHover: {
    backgroundColor: colors.backgroundSoft,
  },
  sidePrimary: {
    backgroundColor: colors.brand,
    marginVertical: spacing.sm,
  },
  sideLabel: {
    fontSize: 15,
    fontWeight: '600',
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
  label: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
