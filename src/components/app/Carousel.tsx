import { Children, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLayout } from '@/lib/layout';
import { spacing } from '@/theme/tokens';

export interface CarouselProps {
  children: ReactNode;
  /** Card width. Default: most of a phone screen so the next card peeks in. */
  itemWidth?: number;
  gap?: number;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * 옆으로 넘기는 카드 줄(앱 스토어, 토스 카드 줄). 다음 카드가 조금 보여 넘길 수 있다는 걸 알린다.
 * 화면 가장자리까지 번지고(bleed) 첫 카드는 본문 여백에 맞춘다. 카드마다 멈춘다(snap).
 */
export function Carousel({ children, itemWidth, gap = spacing.md, accessibilityLabel, testID }: CarouselProps) {
  const { width, gutter, breakpoint } = useLayout();
  const cardWidth = itemWidth ?? (breakpoint === 'compact' ? Math.round(width * 0.78) : 300);
  const items = Children.toArray(children);
  return (
    <ScrollView
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={[styles.row, { gap, paddingHorizontal: gutter }]}
      decelerationRate="fast"
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToAlignment="start"
      snapToInterval={cardWidth + gap}
      style={{ marginHorizontal: -gutter }}
      testID={testID}
    >
      {items.map((child, index) => (
        <View key={index} style={{ width: cardWidth }}>
          {child}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'stretch' },
});
