import { Image } from 'expo-image';
import { FileText, ListTree, X } from 'lucide-react-native';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  type ListRenderItem,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Chip } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { pageNumberOf } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, radii, sizes, spacing } from '@/theme/tokens';
import type { TranscriptSegment } from '@/types';

import type { PageImageSource } from './DocumentPages';

export interface DocumentPageViewerProps {
  /**
   * The page to open on, counting from 1. The parent mounts this component
   * only while the viewer is open, so opening a different page mounts a fresh
   * one: that makes this the initial state rather than something an effect has
   * to keep in sync.
   */
  page: number;
  /** One entry per page, in order. */
  segments: readonly TranscriptSegment[];
  /** The rendered image for a page, or `undefined` for a text-only deck. */
  pageImage?: (page: number) => PageImageSource | undefined;
  onClose: () => void;
  /** Opens this page in the 대본, where it can be searched and highlighted. */
  onOpenInTranscript: (page: number) => void;
}

/**
 * One page of a document, as large as the screen allows.
 *
 * The strip on the material screen is for finding the page; this is for
 * reading it. Swiping moves between pages, so a reader who opened page 3 to
 * check a diagram can keep going without closing and reopening.
 *
 * A page with no rendered image — a slide deck — shows its text here instead,
 * scrollable in full rather than clipped as the strip has to clip it.
 *
 * Virtualised like the strip (2026-10-04): only the page on screen and its
 * neighbours are mounted, and the list opens directly on the tapped page.
 */
export function DocumentPageViewer({
  page,
  segments,
  pageImage,
  onClose,
  onOpenInTranscript,
}: DocumentPageViewerProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  /**
   * The page number of each slide, in order.
   *
   * A page number is NOT a position in this list. The server drops pages with
   * almost no text — a cover, a 목차, a divider — so a six-page PDF can arrive
   * as pages [2, 3, 5, 6]. Treating the number as an index opened the wrong
   * slide and sent 대본에서 보기 to a position no segment has. Everything below
   * converts between the two explicitly.
   */
  const pageNumbers = useMemo(
    () => segments.map((segment) => pageNumberOf(segment.startMs)),
    [segments],
  );
  const indexOfPage = (value: number) => {
    const found = pageNumbers.indexOf(value);
    return found >= 0 ? found : 0;
  };

  const [current, setCurrent] = useState(page);
  const initialIndex = indexOfPage(page);

  const renderSlide = useCallback<ListRenderItem<TranscriptSegment>>(
    ({ item }) => <Slide pageImage={pageImage} segment={item} width={width} />,
    [pageImage, width],
  );

  // Only re-renders when the page changes; the slides are memoised.
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    const clamped = Math.max(0, Math.min(pageNumbers.length - 1, index));
    setCurrent(pageNumbers[clamped] ?? page);
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent={false}
      visible
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <Pressable
            accessibilityLabel={t('닫기')}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
          >
            <X color={colors.text} size={iconSizes.section} strokeWidth={2} />
          </Pressable>
          <AppText
            accessibilityLiveRegion="polite"
            testID="page-viewer-position"
            variant="label"
          >
            {t('{page}쪽 ({i} / {n})', { page: current, i: indexOfPage(current) + 1, n: segments.length })}
          </AppText>
          <View style={styles.iconButton} />
        </View>

        <FlatList
          data={segments}
          getItemLayout={(_data, index) => ({ index, length: width, offset: width * index })}
          horizontal
          initialNumToRender={1}
          initialScrollIndex={initialIndex}
          keyExtractor={(segment) => segment.id}
          maxToRenderPerBatch={2}
          onScroll={handleScroll}
          pagingEnabled
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={renderSlide}
          scrollEventThrottle={32}
          showsHorizontalScrollIndicator={false}
          testID="page-viewer-pages"
          windowSize={3}
        />

        <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
          <Chip
            accessibilityHint={t('이 쪽을 대본에서 열어요.')}
            icon={ListTree}
            label={t('대본에서 보기')}
            onPress={() => onOpenInTranscript(current)}
          />
        </View>
      </View>
    </Modal>
  );
}

/** One page, full width: the rendered image, or the page text scrollable in full. */
const Slide = memo(function Slide({
  segment,
  width,
  pageImage,
}: {
  segment: TranscriptSegment;
  width: number;
  pageImage?: (page: number) => PageImageSource | undefined;
}) {
  const t = useT();
  const number = pageNumberOf(segment.startMs);
  const image = pageImage?.(number);
  return (
    <View style={[styles.slide, { width }]}>
      {image ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={t('{n}쪽', { n: number })}
          contentFit="contain"
          source={image}
          style={styles.image}
          transition={120}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.textPage}
          showsVerticalScrollIndicator={false}
          style={styles.textScroll}
        >
          <View style={styles.textBadge}>
            <FileText
              {...decorative}
              color={colors.textMuted}
              size={iconSizes.inline}
              strokeWidth={2}
            />
            <AppText tone="muted" variant="badge">
              {t('{n}쪽', { n: number })}
            </AppText>
          </View>
          {segment.summary ? (
            <AppText tone="muted" variant="meta">
              {segment.summary}
            </AppText>
          ) : null}
          <AppText variant="body">{segment.text}</AppText>
        </ScrollView>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: sizes.mobileHeader,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  iconButton: {
    alignItems: 'center',
    height: sizes.minimumTouchTarget,
    justifyContent: 'center',
    width: sizes.minimumTouchTarget,
  },
  slide: { flex: 1, justifyContent: 'center', padding: spacing.md },
  image: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    flex: 1,
    width: '100%',
  },
  textScroll: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
  },
  textPage: { gap: spacing.md, padding: spacing.lg },
  textBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.badge,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
  },
  pressed: { opacity: 0.6 },
});
