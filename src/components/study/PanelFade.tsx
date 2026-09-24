import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import {
  Animated,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useReducedMotion } from '@/components/ui';
import { motion } from '@/theme/tokens';

/**
 * Fades a study panel in when the tab changes. Opacity only: the panel is
 * the tallest thing in the screen's ScrollView, and a container that is
 * also translated while it settles is one more thing Android has to get
 * right when it measures how far the list can scroll. It does not need to.
 */
export function PanelFade({
  children,
  duration = motion.duration.standard,
  style,
}: PropsWithChildren<{
  duration?: number;
  style?: StyleProp<ViewStyle>;
}>) {
  const reduced = useReducedMotion();
  // The preference is unknown for the first frame and treated as reduced;
  // a panel that mounted visible must not fade in late once it resolves.
  const [initiallyReduced] = useState(reduced);
  const [opacity] = useState(() => new Animated.Value(reduced ? 1 : 0));

  useEffect(() => {
    opacity.stopAnimation();
    if (reduced || initiallyReduced) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      duration,
      easing: motion.easing.enter,
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [duration, initiallyReduced, opacity, reduced]);

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}
