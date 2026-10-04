import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import { colors, sizes } from '@/theme/tokens';

const WORDMARK_ASPECT_RATIO = 1315 / 341;
const wordmarkSource = require('../../../assets/brand/wordmark.png');

export interface WordmarkProps {
  width?: number;
  /** White lettering for a dark or brand-colored top. */
  inverse?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The in-app logo: the PREMIND wordmark alone (2026-10-04 QA, CEO "앱 안에는
 * 심볼 없어도 될듯"). The P stays the app icon on the home screen and in the
 * store; inside the app the lettering says the name by itself.
 *
 * The brand guide requires the wordmark to stay at least 90px wide.
 */
export function Wordmark({
  width: requestedWidth = 120,
  inverse = false,
  accessibilityLabel = 'PREMIND',
  style,
  testID,
}: WordmarkProps) {
  const width = Number.isFinite(requestedWidth)
    ? Math.max(requestedWidth, sizes.wordmarkMinimumWidth)
    : 120;
  const height = width / WORDMARK_ASPECT_RATIO;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={[style, { height, width }]}
      testID={testID}
    >
      <Image
        {...decorative}
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={wordmarkSource}
        style={styles.image}
        tintColor={inverse ? colors.textInverse : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    height: '100%',
    width: '100%',
  },
});
