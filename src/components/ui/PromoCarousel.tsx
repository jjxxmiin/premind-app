import { ArrowUpRight, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import { useLayout } from '@/lib/layout';
import { colors, illustration, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export type PromoTone = 'brand' | 'positive' | 'neutral' | 'sky' | 'lavender';

export interface PromoSlide {
  id: string;
  /** Keep the headline short: the card should scan like a poster. */
  title: string;
  description?: string;
  badge?: string;
  tone?: PromoTone;
  icon: LucideIcon;
  emoji?: string;
  ctaLabel?: string;
  onPress?: () => void;
}

export interface PromoCarouselProps {
  slides: readonly PromoSlide[];
  /** Horizontal padding of the row this sits in, so cards can peek past it. */
  gutter: number;
  style?: StyleProp<ViewStyle>;
}

const toneStyles: Record<PromoTone, { card: ViewStyle; icon: string }> = {
  brand: { card: { backgroundColor: illustration.tones.apricot }, icon: colors.brand },
  positive: { card: { backgroundColor: illustration.tones.sage }, icon: colors.positive },
  neutral: { card: { backgroundColor: colors.backgroundSoft }, icon: colors.text },
  sky: { card: { backgroundColor: illustration.tones.sky }, icon: '#3D7BE8' },
  lavender: { card: { backgroundColor: illustration.tones.lavender }, icon: '#7B61D6' },
};

const CARD_GAP = spacing.md;
/** How much of the next card shows, so the row reads as swipeable. */
const PEEK = 32;

/**
 * The swipeable tips row. Each card is a flat tinted tile with an icon, a
 * one-line headline and a short link. No body copy, no shadows.
 */
export function PromoCarousel({ slides, gutter, style }: PromoCarouselProps) {
  const { width, contentMaxWidth, isTablet } = useLayout();
  const [active, setActive] = useState(0);
  const lastIndex = useRef(0);

  const columnWidth = Math.min(width, isTablet ? contentMaxWidth : width);
  const perView = isTablet && slides.length > 1 ? 2 : 1;
  const peek = slides.length > perView ? PEEK : 0;
  const pageCount = Math.max(1, slides.length - perView + 1);
  const cardWidth =
    (columnWidth - gutter * 2 - peek - CARD_GAP * (perView - 1)) / perView;
  const interval = cardWidth + CARD_GAP;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.min(
      pageCount - 1,
      Math.max(0, Math.round(event.nativeEvent.contentOffset.x / interval)),
    );
    if (index !== lastIndex.current) {
      lastIndex.current = index;
      setActive(index);
    }
  };

  return (
    <View style={style}>
      <ScrollView
        accessibilityLabel="PREMIND 활용 팁"
        contentContainerStyle={{ gap: CARD_GAP, paddingHorizontal: gutter }}
        decelerationRate="fast"
        horizontal
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={interval}
        style={{ marginHorizontal: -gutter }}
      >
        {slides.map((slide) => (
          <PromoCard key={slide.id} slide={slide} width={cardWidth} />
        ))}
      </ScrollView>

      {pageCount > 1 ? (
        <View style={styles.dots} {...decorative}>
          {Array.from({ length: pageCount }, (_, index) => (
            <View
              key={`page-${index}`}
              style={[styles.dot, index === active ? styles.dotActive : null]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PromoCard({ slide, width }: { slide: PromoSlide; width: number }) {
  const tone = toneStyles[slide.tone ?? 'brand'];
  const Icon = slide.icon;

  return (
    <Pressable
      accessibilityHint={slide.onPress ? '두 번 탭하면 열려요.' : undefined}
      accessibilityLabel={[slide.badge, slide.title, slide.description]
        .filter(Boolean)
        .join('. ')}
      accessibilityRole={slide.onPress ? 'button' : undefined}
      disabled={!slide.onPress}
      onPress={slide.onPress}
      style={({ pressed }) => [
        styles.card,
        tone.card,
        { width },
        pressed && slide.onPress ? styles.pressed : null,
      ]}
    >
      <View style={styles.iconWell} {...decorative}>
        <Icon color={tone.icon} size={22} strokeWidth={2} />
      </View>
      <View style={styles.copy}>
        {slide.badge ? (
          <AppText tone="muted" variant="badge">
            {slide.badge}
          </AppText>
        ) : null}
        <AppText numberOfLines={2} variant="itemTitle">
          {slide.title}
        </AppText>
        {slide.description ? (
          <AppText numberOfLines={2} tone="muted" variant="meta">
            {slide.description}
          </AppText>
        ) : null}
      </View>
      {slide.onPress ? (
        <View style={styles.cta}>
          <AppText variant="label">{slide.ctaLabel ?? '바로가기'}</AppText>
          <ArrowUpRight color={colors.text} size={14} strokeWidth={2.2} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    gap: spacing.md,
    minHeight: 150,
    padding: spacing.gutter,
  },
  iconWell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  cta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  dots: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingTop: spacing.md,
  },
  dot: {
    backgroundColor: colors.borderStrong,
    borderRadius: radii.full,
    height: 5,
    width: 5,
  },
  dotActive: {
    backgroundColor: colors.text,
    width: 16,
  },
  pressed: {
    opacity: 0.85,
  },
});
