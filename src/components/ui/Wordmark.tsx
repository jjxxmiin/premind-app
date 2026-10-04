import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import { colors, sizes, spacing } from '@/theme/tokens';

const WORDMARK_ASPECT_RATIO = 1315 / 341;
const wordmarkSource = require('../../../assets/brand/wordmark.png');
// The app icon's P, cut tight on transparency (scripts/refresh-brand-icons.mjs).
const symbolSource = require('../../../assets/brand/symbol.png');
const SYMBOL_ASPECT_RATIO = 421 / 512;
// A little taller than the wordmark image, so the P reads a touch above the
// lettering's cap height, its point dropping below the baseline.
const SYMBOL_SCALE = 1.1;
// On a colored panel the P sits on the icon's cream rounded tile.
const ICON_CREAM = '#FDF6EB';
const TILE_SCALE = 1.5;
const TILE_RADIUS = 0.24;

export interface WordmarkProps {
  /** Width of the PREMIND lettering; the icon tile sits before it. */
  width?: number;
  /** White lettering for a dark or brand-colored panel. */
  inverse?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The in-app logo: the app icon followed by the PREMIND wordmark (2026-10-04).
 * The brand guide requires the lettering to stay at least 90px wide.
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
  const symbolHeight = Math.round(height * SYMBOL_SCALE);
  const symbol = (
    <Image
      {...decorative}
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      source={symbolSource}
      style={{ height: symbolHeight, width: symbolHeight * SYMBOL_ASPECT_RATIO }}
    />
  );
  const tile = Math.round(symbolHeight * TILE_SCALE);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={[styles.row, style]}
      testID={testID}
    >
      {inverse ? (
        <View style={[styles.tile, { borderRadius: tile * TILE_RADIUS, height: tile, width: tile }]}>
          {symbol}
        </View>
      ) : (
        symbol
      )}
      <Image
        {...decorative}
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={wordmarkSource}
        style={{ height, width }}
        tintColor={inverse ? colors.textInverse : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    alignItems: 'center',
    backgroundColor: ICON_CREAM,
    justifyContent: 'center',
  },
});
