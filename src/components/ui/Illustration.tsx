import { Image, type ImageProps } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { decorative } from '@/lib/a11y';

export interface IllustrationProps {
  source: ImageProps['source'];
  accessibilityLabel?: string;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: ImageProps['style'];
  /** Changes when a virtualized cell is reused, preventing a stale frame. */
  recyclingKey?: string;
}

/**
 * One image policy for generated artwork and content covers.
 *
 * `expo-image` keeps remote posters cached and fades them in; local 3D artwork
 * uses the exact same sizing rules, so state screens do not each invent their
 * own image behaviour.
 */
export function Illustration({
  source,
  accessibilityLabel,
  aspectRatio = 1,
  style,
  imageStyle,
  recyclingKey,
}: IllustrationProps) {
  const accessibilityProps = accessibilityLabel
    ? { accessibilityLabel, accessible: true }
    : { ...decorative, accessible: false };

  return (
    <View style={[styles.frame, { aspectRatio }, style]}>
      <Image
        {...accessibilityProps}
        cachePolicy="memory-disk"
        contentFit="contain"
        recyclingKey={recyclingKey}
        source={source}
        style={[styles.image, imageStyle]}
        transition={180}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    width: '100%',
  },
  image: {
    height: '100%',
    width: '100%',
  },
});
