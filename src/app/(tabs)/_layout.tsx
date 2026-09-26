import { Tabs, router } from 'expo-router';
import {
  Gauge,
  Home,
  MicVocal,
  PlusCircle,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { AppTabBar } from '@/components/AppTabBar';
import { consumePendingJoinCode } from '@/features/interview/pending-join';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { colors, iconSizes } from '@/theme/tokens';

function tabIcon(Icon: LucideIcon) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <View {...decorative} style={styles.iconWell}>
        <Icon
          color={color}
          size={iconSizes.tab}
          strokeWidth={focused ? 2.3 : 1.9}
        />
      </View>
    );
  };
}

/**
 * Five tabs (홈, 복습, 추가, 연습, MY; 2026-09-26 CEO: 이해도 → 복습, 말하기 → 연습) on a bar we draw ourselves (`AppTabBar`) so the bottom safe
 * area is measured natively and labels never end up under the system bar.
 *
 * 배우기(홈, 이해도) and 말하기 (발표 평가 + 면접 연습, since 2026-09-26) are
 * the two halves; 홈 is the library; 녹음 is a launcher, not a tab — pressing it opens the
 * full-screen recorder without moving the selected tab.
 */
export default function TabsLayout() {
  const t = useT();
  const { breakpoint } = useLayout();
  // An institution's invite link opened before sign-in: finish joining now.
  useEffect(() => {
    void consumePendingJoinCode().then((code) => {
      if (code) router.push({ pathname: '/interview/join', params: { code } });
    });
  }, []);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Laptop and desktop windows: the bar becomes a sidebar on the left.
        tabBarPosition: breakpoint === 'expanded' ? 'left' : 'bottom',
        sceneStyle: { backgroundColor: colors.background },
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('홈'),
          tabBarAccessibilityLabel: t('홈, 내 자료'),
          tabBarIcon: tabIcon(Home),
          tabBarLabel: t('홈'),
        }}
      />
      <Tabs.Screen
        name="mastery"
        options={{
          title: t('복습'),
          tabBarAccessibilityLabel: t('복습, 자료별 이해도와 다시 볼 곳'),
          tabBarIcon: tabIcon(Gauge),
          tabBarLabel: t('복습'),
        }}
      />
      {/* Not a tab: one button for every way to start a 마인드팩. It opens
          the 자료 추가 sheet on 홈 (녹음, 파일, 유튜브 링크) rather than
          jumping straight into the recorder, because uploading a PDF was the
          hardest thing in the app to find. */}
      <Tabs.Screen
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push({
              pathname: '/(tabs)',
              params: { add: String(Date.now()) },
            });
          },
        }}
        name="create"
        options={{
          title: t('추가'),
          tabBarAccessibilityLabel: t('자료 추가, 녹음하거나 파일을 올려요'),
          tabBarIcon: tabIcon(PlusCircle),
          tabBarLabel: t('추가'),
        }}
      />
      {/* 말하기: 발표 평가와 면접 연습(2026-09-26 합침). 안에서 발표, 면접을 고른다. */}
      <Tabs.Screen
        name="speak"
        options={{
          title: t('연습'),
          tabBarAccessibilityLabel: t('연습, 발표 평가와 면접 연습'),
          tabBarIcon: tabIcon(MicVocal),
          tabBarLabel: t('연습'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('MY'),
          tabBarAccessibilityLabel: t('내 정보와 설정'),
          tabBarIcon: tabIcon(UserRound),
          tabBarLabel: t('MY'),
        }}
      />
      {/* Kept as routes so old links resolve; sharing is not in the bar. */}
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="lens" options={{ href: null }} />
      <Tabs.Screen name="interview" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWell: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    width: 32,
  },
});
