import type { PressableStateCallbackType } from 'react-native';

/**
 * What a Pressable style callback receives. React Native types only `pressed`;
 * react-native-web also passes `hovered` and `focused`, which is what gives the
 * web build its hover states. Native never sets them, so every hover style is
 * a web-only refinement by construction.
 */
export type PressState = PressableStateCallbackType & {
  hovered?: boolean;
  focused?: boolean;
};
