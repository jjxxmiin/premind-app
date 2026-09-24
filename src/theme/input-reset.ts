import type { TextStyle } from 'react-native';

/**
 * Kept as a compatibility style for every shared text input.
 *
 * A static React Native style cannot safely recreate the browser's
 * `:focus-visible` behaviour. Leaving this empty preserves the platform focus
 * indicator for keyboard users; fields with a custom focused border may layer
 * that enhancement on top without making unwrapped inputs invisible.
 */
export const inputReset: TextStyle | null = null;
