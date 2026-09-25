import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { useEffect, useMemo, useRef } from 'react';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useAppStore } from '@/state/app-store';
import {
  configureStudyNotifications,
  subscribeToStudyNotificationResponses,
} from '@/services/notifications';
import { colors, fontFamilies } from '@/theme/tokens';
import { hydrateLocale } from '@/lib/i18n';
import { captureInitialReturnTo, takeReturnTo } from '@/lib/return-to';

// Before the router rewrites a signed-out visitor's address to /login.
captureInitialReturnTo();
// The saved screen language (MY → 앱 설정 → 언어); until it loads, the device language.
void hydrateLocale();

void SplashScreen.preventAutoHideAsync();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    border: colors.border,
    card: colors.surface,
    notification: colors.brand,
    primary: colors.brand,
    text: colors.text,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [fontFamilies.medium]: require('../../assets/fonts/Pretendard-Medium.ttf'),
    [fontFamilies.bold]: require('../../assets/fonts/Pretendard-Bold.ttf'),
    [fontFamilies.extraBold]: require('../../assets/fonts/Pretendard-ExtraBold.ttf'),
    [fontFamilies.black]: require('../../assets/fonts/Pretendard-Black.otf'),
  });
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
          mutations: { retry: 0 },
        },
      }),
    [],
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <RootNavigator fontsReady={fontsLoaded || Boolean(fontError)} />
          </AppProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { isHydrated, session } = useAppStore();
  const signedIn = Boolean(session);

  useEffect(() => {
    if (fontsReady && isHydrated) {
      void SplashScreen.hideAsync();
    }
  }, [fontsReady, isHydrated]);

  // Already signed in at launch: the address opened itself, so there is
  // nothing to return to after a later sign-in. Only the launch counts.
  const signedInAtLaunch = useRef<boolean | null>(null);
  useEffect(() => {
    if (!isHydrated || signedInAtLaunch.current !== null) return;
    signedInAtLaunch.current = signedIn;
    if (signedIn) takeReturnTo();
  }, [isHydrated, signedIn]);
  // Signed in after launch: login, index and signup all read the address, so
  // forget it only once they have had their turn.
  useEffect(() => {
    if (!signedIn || signedInAtLaunch.current !== false) return;
    const timer = setTimeout(() => takeReturnTo(), 1500);
    return () => clearTimeout(timer);
  }, [signedIn]);

  useEffect(() => {
    void configureStudyNotifications().catch(() => undefined);
    return subscribeToStudyNotificationResponses((materialId) => {
      if (signedIn) {
        router.push({
          pathname: '/material/[id]',
          params: { id: materialId },
        });
      }
    });
  }, [signedIn]);

  if (!fontsReady || !isHydrated) {
    return null;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
          <Stack.Screen name="signup" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="capture" options={{ presentation: 'modal' }} />
          <Stack.Screen name="record" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="processing/[id]"
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="material/[id]" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="quiz/[id]" />
          <Stack.Screen name="cards/[id]" />
          <Stack.Screen name="report/[id]" />
          <Stack.Screen name="mastery/[id]" />
          <Stack.Screen name="guide" />
          <Stack.Screen name="subscription" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="search" />
          <Stack.Screen name="interview/prepare" />
          <Stack.Screen name="interview/room/[id]" options={{ gestureEnabled: false }} />
          <Stack.Screen name="interview/preparing/[id]" options={{ gestureEnabled: false }} />
          <Stack.Screen name="interview/report/[id]" />
          <Stack.Screen name="interview/history" />
          <Stack.Screen name="interview/org" />
        </Stack.Protected>
        {/* An invite link must open before sign-in too: it checks the code, then asks to sign in. */}
        <Stack.Screen name="interview/join" />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
