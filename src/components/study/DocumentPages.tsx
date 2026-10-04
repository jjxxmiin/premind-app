import { Image } from 'expo-image';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { memo, useCallback, useRef, useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText, IconButton } from '@/components/ui';
import { pageNumberOf } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { colors, radii, spacing } from '@/theme/tokens';
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
/**
 * The tallest a page card gets. In the wide desktop column 0.78 of the width
 * is a 600pt block of mostly blank page that pushes the tabs below the fold.
 */
const MAX_PAGE_HEIGHT = 460;
/** How much of the neighbouring page peeks in, hinting that it scrolls. */
const PEEK = 32;

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
 *
 * Virtualised (2026-10-04): a 100-page deck mounted all 100 cards — and for a
 * PDF fetched and decoded all 100 images — at once, and swiping stuttered.
 * Only the pages around the one on screen are mounted now, and the cards are
 * memoised so the moving "3 / 100쪽" label never re-renders them.
 */
export function DocumentPages({
  segments,
  pageImage,
  onOpenPage,
}: DocumentPagesProps) {
  const t = useT();
  const [width, setWidth] = useState(0);
  const [current, setCurrent] = useState(0);
  const trackRef = useRef<FlatList<TranscriptSegment>>(null);
  const { isTablet } = useLayout();

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const pageWidth = width > 0 ? width - PEEK : 0;
  const step = pageWidth + spacing.md;
  const pageHeight = Math.min(pageWidth * PAGE_ASPECT, MAX_PAGE_HEIGHT);

  // React skips the render when the page has not changed, so a scroll frame
  // costs one division until the position actually moves (the web build has
  // no momentum-end event to wait for).
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (step <= 0) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / step);
    setCurrent(Math.max(0, Math.min(segments.length - 1, index)));
  };

  const renderPage = useCallback<ListRenderItem<TranscriptSegment>>(
    ({ item }) => (
      <PageCard
        height={pageHeight}
        onOpenPage={onOpenPage}
        pageImage={pageImage}
        segment={item}
        width={pageWidth}
      />
    ),
    [onOpenPage, pageHeight, pageImage, pageWidth],
  );

  /**
   * A mouse has no sideways swipe, so the web build on a tablet-or-wider
   * window gets arrows next to the page count. A phone keeps the swipe alone.
   */
  const showArrows = Platform.OS === 'web' && isTablet && segments.length > 1;
  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(segments.length - 1, index));
    setCurrent(next);
    trackRef.current?.scrollToOffset({ offset: next * step, animated: true });
  };

  if (segments.length === 0) return null;

  return (
    <View onLayout={handleLayout} style={styles.block}>
      <View style={styles.head}>
        <AppText accessibilityRole="header" variant="heading">
          {t('문서 보기')}
        </AppText>
        <View style={styles.headTrailing}>
          <AppText
            accessibilityLiveRegion="polite"
            style={styles.position}
            testID="document-page-position"
            tone="muted"
            variant="meta"
          >
            {t('{i} / {n}쪽', { i: current + 1, n: segments.length })}
          </AppText>
          {showArrows ? (
            <>
              <IconButton
                disabled={current === 0}
                icon={ChevronLeft}
                label={t('이전 쪽')}
                onPress={() => goTo(current - 1)}
                size="small"
                variant="soft"
              />
              <IconButton
                disabled={current >= segments.length - 1}
                icon={ChevronRight}
                label={t('다음 쪽')}
                onPress={() => goTo(current + 1)}
                size="small"
                variant="soft"
              />
            </>
          ) : null}
        </View>
      </View>

      {pageWidth > 0 ? (
        <FlatList
          contentContainerStyle={styles.track}
          data={segments}
          decelerationRate="fast"
          getItemLayout={(_data, index) => ({ index, length: step, offset: step * index })}
          horizontal
          initialNumToRender={2}
          keyExtractor={(segment) => segment.id}
          maxToRenderPerBatch={2}
          onScroll={handleScroll}
          ref={trackRef}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={renderPage}
          scrollEventThrottle={32}
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={step}
          testID="document-pages"
          windowSize={5}
        />
      ) : null}
    </View>
  );
}

/**
 * One page card. Memoised so a change of position (the "3 / 100쪽" label)
 * does not re-render the pages already on screen.
 */
const PageCard = memo(function PageCard({
  segment,
  width,
  height,
  pageImage,
  onOpenPage,
}: {
  segment: TranscriptSegment;
  width: number;
  height: number;
  pageImage?: (page: number) => PageImageSource | undefined;
  onOpenPage: (page: number) => void;
}) {
  const t = useT();
  const page = pageNumberOf(segment.startMs);
  const image = pageImage?.(page);
  return (
    <Pressable
      accessibilityHint={t('이 쪽을 크게 봐요.')}
      accessibilityLabel={t('{n}쪽', { n: page })}
      accessibilityRole="button"
      onPress={() => onOpenPage(page)}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.page,
        image ? styles.pageImageCard : styles.pageTextCard,
        { width, height },
        hovered ? styles.pageHovered : null,
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
          {/* The whole page, scrolled inside the card (2026-10-04): a slide's
              text cut off with "…" read as text the app had lost. */}
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.pageText}
          >
            <AppText variant="body">{segment.text}</AppText>
          </ScrollView>
        </>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headTrailing: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  position: { fontVariant: ['tabular-nums'], marginRight: spacing.xs },
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
  pageHovered: { borderColor: colors.borderStrong },
  pageText: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
});
