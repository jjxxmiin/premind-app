import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import { sizes } from '@/theme/tokens';

const WORDMARK_ASPECT_RATIO = 1315 / 341;
const wordmarkSource = require('../../../assets/brand/wordmark.png');

export interface WordmarkProps {
  width?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The brand guide requires the wordmark to stay at least 90px wide. Use the
 * standalone symbol asset for smaller placements rather than shrinking this.
 */
export function Wordmark({
  width: requestedWidth = 120,
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
