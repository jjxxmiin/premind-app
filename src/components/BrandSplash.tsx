import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { colors, spacing } from '@/theme/tokens';

import { AppText } from './ui/AppText';

const symbolSource = require('../../assets/brand/splash-symbol.png');

/** Matches `expo-splash-screen`'s `imageWidth` in app.json — see below. */
const SYMBOL_SIZE = 120;
const useNativeDriver = Platform.OS !== 'web';

/**
 * The launch screen, continuing the native splash rather than replacing it.
 *
 * The native splash (app.json) draws this exact symbol at this exact size on
 * this exact white background, so the handoff from the OS to React is
 * invisible: the symbol never moves, and the one-line promise simply fades in
 * underneath it.
 */
export function BrandSplash() {
  // `useState` rather than `useRef`: the value is read while rendering (the
  // tagline interpolates from it), which is exactly what a ref must not be used for.
  const [entry] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      entry.setValue(1);
      return;
    }

    const animation = Animated.timing(entry, {
      toValue: 1,
      duration: 420,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [entry, reduceMotion]);

  return (
    <View accessibilityLabel="PREMIND" style={styles.container}>
      <Image
        accessible={false}
        resizeMode="contain"
        source={symbolSource}
        style={styles.symbol}
      />
      <Animated.View style={{ opacity: entry }}>
        <AppText align="center" tone="muted" variant="body">
          수업을 담기만 하면 복습이 준비돼요
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.xl,
    justifyContent: 'center',
    paddingHorizontal: spacing.gutter,
  },
  symbol: {
    height: SYMBOL_SIZE,
    width: SYMBOL_SIZE,
  },
});
