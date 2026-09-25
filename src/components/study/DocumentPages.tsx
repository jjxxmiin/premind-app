import { Image } from 'expo-image';
import { useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/ui';
import { pageNumberOf } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import type { TranscriptSegment } from '@/types';

/** Where one rendered page lives, and the header that fetches it. */
export interface PageImageSource {
  uri: string;
  headers: Record<string, string>;
}

export interface DocumentPagesProps {
  /** One entry per page, in order, as the server read them. */
  segments: readonly TranscriptSegment[];
  /**
   * The rendered image for a page, or `undefined` when there is none. A slide
   * deck has none at all, and neither does a document processed before the
   * server started rendering them; both fall back to the page text.
   */
  pageImage?: (page: number) => PageImageSource | undefined;
  /** Opens that page large. Receives the page number, counting from 1. */
  onOpenPage: (page: number) => void;
}

/**
 * How tall a page card is, as a fraction of its width. Between A4 upright
 * (1.41) and a 16:9 slide (0.56), because it has to work for both and a
 * full-height A4 would push everything below it off the screen.
 */
const PAGE_ASPECT = 0.78;
/** How much of the neighbouring page peeks in, hinting that it scrolls. */
const PEEK = 32;
/** The page-number pill: `sizes.badge` tall, then the gap under it. */
const BADGE_BLOCK = 22 + spacing.sm;

/**
 * The pages of an uploaded document, where a video would have its player.
 *
 * A PDF shows the page as it was actually drawn. That matters more than it
 * sounds: a slide is its diagram, its table and its layout as much as its
 * words, and the text pulled out of it — which is what the summary and the
 * questions are built from — is not what the reader came to look at. Tapping
 * a page opens it full screen.
 *
 * A slide deck (.pptx) has no page raster to render without a full office
 * suite behind the server, so those fall back to the extracted text, one card
 * per page. Both are numbered identically: card N is page N is `page: N`.
 */
export function DocumentPages({
  segments,
  pageImage,
  onOpenPage,
}: DocumentPagesProps) {
  const t = useT();
  const [width, setWidth] = useState(0);
  const [current, setCurrent] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const pageWidth = width > 0 ? width - PEEK : 0;
  const step = pageWidth + spacing.md;
  const pageHeight = pageWidth * PAGE_ASPECT;
  /**
   * How many lines of page text fit, for the decks with no image. Clipping by
   * height alone cuts the last line through the middle of its glyphs, which
   * reads as a rendering fault rather than as a page continuing;
   * `numberOfLines` ends it on a clean line with an ellipsis instead.
   */
  const lines = Math.max(
    3,
    Math.floor(
      (pageHeight - spacing.lg * 2 - BADGE_BLOCK) / typography.body.lineHeight,
    ),
  );

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (step <= 0) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / step);
    setCurrent(Math.max(0, Math.min(segments.length - 1, index)));
  };

  if (segments.length === 0) return null;

  return (
    <View onLayout={handleLayout} style={styles.block}>
      <View style={styles.head}>
        <AppText accessibilityRole="header" variant="heading">
          {t('문서 보기')}
        </AppText>
        <AppText
          accessibilityLiveRegion="polite"
          testID="document-page-position"
          tone="muted"
          variant="meta"
        >
          {t('{i} / {n}쪽', { i: current + 1, n: segments.length })}
        </AppText>
      </View>

      {pageWidth > 0 ? (
        <ScrollView
          contentContainerStyle={styles.track}
          decelerationRate="fast"
          horizontal
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={step}
          testID="document-pages"
        >
          {segments.map((segment) => {
            const page = pageNumberOf(segment.startMs);
            const image = pageImage?.(page);
            return (
              <Pressable
                accessibilityHint={t('이 쪽을 크게 봐요.')}
                accessibilityLabel={t('{n}쪽', { n: page })}
                accessibilityRole="button"
                key={segment.id}
                onPress={() => onOpenPage(page)}
                style={({ pressed }) => [
                  styles.page,
                  image ? styles.pageImageCard : styles.pageTextCard,
                  { width: pageWidth, height: pageHeight },
                  pressed ? styles.pressed : null,
                ]}
              >
                {image ? (
                  <>
                    <Image
                      accessibilityIgnoresInvertColors
                      // The whole page, never cropped: a diagram cut off at
                      // the margin is worse than one shown small.
                      contentFit="contain"
                      contentPosition="top center"
                      source={image}
                      style={styles.pageImage}
                      testID={`document-page-image-${page}`}
                      transition={120}
                    />
                    <View style={[styles.pageBadge, styles.pageBadgeFloating]}>
                      <AppText tone="muted" variant="badge">
                        {t('{n}쪽', { n: page })}
                      </AppText>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.pageBadge}>
                      <AppText tone="muted" variant="badge">
                        {t('{n}쪽', { n: page })}
                      </AppText>
                    </View>
                    <AppText
                      // Whatever does not fit is what the 대본 is for.
                      ellipsizeMode="tail"
                      numberOfLines={lines}
                      style={[
                        styles.pageText,
                        { maxHeight: lines * typography.body.lineHeight },
                      ]}
                      variant="body"
                    >
                      {segment.text}
                    </AppText>
                  </>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  head: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  track: { gap: spacing.md },
  page: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  /** A rendered page carries its own margins; the card must not add more. */
  pageImageCard: { padding: 0 },
  pageTextCard: { gap: spacing.sm, padding: spacing.lg },
  pageImage: { flex: 1, width: '100%' },
  pageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.badge,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  /** Over the image rather than above it, so no page height is given up. */
  pageBadgeFloating: {
    left: spacing.sm,
    position: 'absolute',
    top: spacing.sm,
  },
  pageText: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
});
