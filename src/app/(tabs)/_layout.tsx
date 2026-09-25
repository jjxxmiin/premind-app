import { Tabs, router } from 'expo-router';
import {
  BarChart3,
  Gauge,
  Home,
  MessagesSquare,
  PlusCircle,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { AppTabBar } from '@/components/AppTabBar';
import { consumePendingJoinCode } from '@/features/interview/pending-join';
import { decorative } from '@/lib/a11y';
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
 * Six tabs (홈, 이해도, 추가, 평가, 면접, MY) on a bar we draw ourselves (`AppTabBar`) so the bottom safe
 * area is measured natively and labels never end up under the system bar.
 *
 * 홈 is the library; 녹음 is a launcher, not a tab — pressing it opens the
 * full-screen recorder without moving the selected tab.
 */
export default function TabsLayout() {
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
          title: '홈',
          tabBarAccessibilityLabel: '홈, 내 자료',
          tabBarIcon: tabIcon(Home),
          tabBarLabel: '홈',
        }}
      />
      <Tabs.Screen
        name="mastery"
        options={{
          title: '이해도',
          tabBarAccessibilityLabel: '이해도, 자료별 학습 상태',
          tabBarIcon: tabIcon(Gauge),
          tabBarLabel: '이해도',
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
          title: '추가',
          tabBarAccessibilityLabel: '자료 추가, 녹음하거나 파일을 올려요',
          tabBarIcon: tabIcon(PlusCircle),
          tabBarLabel: '추가',
        }}
      />
      <Tabs.Screen
        name="lens"
        options={{
          title: '평가',
          tabBarAccessibilityLabel: '발표 평가',
          tabBarIcon: tabIcon(BarChart3),
          tabBarLabel: '평가',
        }}
      />
      {/* 2026-09-26: interview.premind.co.kr 이 앱 안으로 들어왔다. 연습, 결과, 기록, 기관 참여. */}
      <Tabs.Screen
        name="interview"
        options={{
          title: '면접',
          tabBarAccessibilityLabel: '면접 연습',
          tabBarIcon: tabIcon(MessagesSquare),
          tabBarLabel: '면접',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'MY',
          tabBarAccessibilityLabel: '내 정보와 설정',
          tabBarIcon: tabIcon(UserRound),
          tabBarLabel: 'MY',
        }}
      />
      {/* Kept as routes so old links resolve; sharing is not in the bar. */}
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
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
