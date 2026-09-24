import { Platform } from 'react-native';

interface DecorativeProps {
  'aria-hidden'?: boolean;
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: 'no-hide-descendants';
}

/**
 * Spread onto an element that carries no information of its own — an icon
 * beside its own label, a divider, an avatar initial, a modal scrim — so screen
 * readers skip it instead of announcing it twice or announcing nothing useful.
 *
 * Platform-split because there is no single prop that works everywhere:
 * `accessibilityElementsHidden` is iOS-only (Android needs
 * `importantForAccessibility`), and on web it is not a DOM attribute at all —
 * React Native Web passes it straight through to the DOM, where React warns
 * about an unrecognized prop on every render.
 *
 * @example
 * <Search {...decorative} color={colors.textMuted} size={18} />
 */
export const decorative: DecorativeProps =
  Platform.OS === 'web'
    ? { 'aria-hidden': true }
    : {
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      };
