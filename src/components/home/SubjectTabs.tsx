import { Plus } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { AppText } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, motion, sizes, spacing } from '@/theme/tokens';

/**
 * The OS reduce-motion preference, read once and followed while mounted.
 * Unknown counts as reduced so the underline never animates before the
 * preference has been read. Local to this file because React Native Web
 * returns no subscription where `matchMedia` is missing (jsdom), and the
 * shared hook does not guard for that.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let mounted = true;
    const update = (value: boolean) => {
      if (mounted) setReduced(value);
    };
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(update)
      .catch(() => update(true));
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      update,
    ) as { remove?: () => void } | undefined;
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}

export interface SubjectTab {
  key: string;
  label: string;
  /**
   * How many 자료 the page holds. Omitted when the number is not known yet;
   * a folder with nothing in it shows a 0 rather than hiding, because "this
   * folder is empty" is the thing worth seeing before opening it.
   */
  count?: number;
}

export interface SubjectTabsProps {
  tabs: readonly SubjectTab[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /** The pinned "+" ghost button. Opens the new-subject sheet. */
  onAddPress: (event: GestureResponderEvent) => void;
  gutter?: number;
}

interface TabLayout {
  x: number;
  width: number;
}

const UNDERLINE_HEIGHT = 2;

/**
 * The subject strip: "전체", one tab per project, and "+". Ink text with a
 * 2pt underline that slides between tabs; the strip scrolls so the active
 * tab is always in view. Tapping a tab pages the list below it.
 */
export function SubjectTabs({
  tabs,
  activeIndex,
  onSelect,
  onAddPress,
  gutter = spacing.gutter,
}: SubjectTabsProps) {
  const t = useT();
  const reduced = usePrefersReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const layoutsRef = useRef<Map<string, TabLayout>>(new Map());
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [stripWidth, setStripWidth] = useState(0);
  const [underline] = useState(() => ({
    x: new Animated.Value(0),
    width: new Animated.Value(0),
    opacity: new Animated.Value(0),
  }));
  const settledRef = useRef(false);

  const activeKey = tabs[activeIndex]?.key;

  const recordLayout = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      const previous = layoutsRef.current.get(key);
      if (previous && Math.abs(previous.x - x) < 0.5 && Math.abs(previous.width - width) < 0.5) {
        return;
      }
      layoutsRef.current.set(key, { x, width });
      setLayoutVersion((version) => version + 1);
    },
    [],
  );

  // Move the underline and keep the active tab in view whenever the active
  // tab or any tab's measurement changes.
  useEffect(() => {
    if (!activeKey) return;
    const layout = layoutsRef.current.get(activeKey);
    if (!layout) return;

    const targetX = layout.x + spacing.md;
    const targetWidth = Math.max(layout.width - spacing.md * 2, 0);
    if (reduced || !settledRef.current) {
      underline.x.setValue(targetX);
      underline.width.setValue(targetWidth);
      underline.opacity.setValue(1);
      settledRef.current = true;
    } else {
      Animated.parallel([
        Animated.timing(underline.x, {
          duration: motion.duration.standard,
          easing: motion.easing.standard,
          toValue: targetX,
          useNativeDriver: false,
        }),
        Animated.timing(underline.width, {
          duration: motion.duration.standard,
          easing: motion.easing.standard,
          toValue: targetWidth,
          useNativeDriver: false,
        }),
      ]).start();
    }

    if (stripWidth > 0) {
      const centred = layout.x + layout.width / 2 - stripWidth / 2;
      scrollRef.current?.scrollTo({
        animated: !reduced,
        x: Math.max(0, centred),
      });
    }
  }, [activeKey, layoutVersion, reduced, stripWidth, underline]);

  return (
    <View
      onLayout={(event) => setStripWidth(event.nativeEvent.layout.width)}
      style={styles.strip}
    >
      <ScrollView
        accessibilityRole="tablist"
        contentContainerStyle={styles.content}
        horizontal
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
      >
        <View {...decorative} style={{ width: Math.max(gutter - spacing.md, 0) }} />
        {tabs.map((tab, index) => {
          const selected = index === activeIndex;
          return (
            <Pressable
              accessibilityLabel={
                tab.count === undefined
                  ? t('{folder} 자료', { folder: tab.label })
                  : t('{folder} 자료 {n}개', { folder: tab.label, n: tab.count })
              }
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              aria-selected={selected}
              key={tab.key}
              onLayout={recordLayout(tab.key)}
              onPress={() => onSelect(index)}
              style={({ pressed }) => [styles.tab, pressed ? styles.pressed : null]}
            >
              <AppText
                numberOfLines={1}
                style={styles.tabLabel}
                tone={selected ? 'default' : 'muted'}
                variant="bodyStrong"
              >
                {tab.label}
              </AppText>
              {tab.count === undefined ? null : (
                <AppText
                  {...decorative}
                  style={styles.tabCount}
                  tabular
                  tone={selected ? 'muted' : 'faint'}
                  variant="badge"
                >
                  {tab.count}
                </AppText>
              )}
            </Pressable>
          );
        })}
        <View {...decorative} style={{ width: spacing.sm }} />
        <Animated.View
          {...decorative}
          style={[
            styles.underline,
            {
              opacity: underline.opacity,
              transform: [{ translateX: underline.x }],
              width: underline.width,
            },
          ]}
        />
      </ScrollView>
      <View
        style={[
          styles.addColumn,
          // The icon is centred in its 44pt column; pulling the column in by
          // the difference puts the icon's right edge on the gutter line.
          { marginRight: Math.max(gutter - (sizes.minimumTouchTarget - iconSizes.section) / 2, 0) },
        ]}
      >
        <View {...decorative} style={styles.fade}>
          {FADE_STEPS.map((opacity) => (
            <View key={opacity} style={[styles.fadeStep, { opacity }]} />
          ))}
        </View>
        <Pressable
          accessibilityHint={t('새 폴더를 만들어요')}
          accessibilityLabel={t('새 폴더')}
          accessibilityRole="button"
          onPress={onAddPress}
          style={({ pressed }) => [styles.addButton, pressed ? styles.pressed : null]}
        >
          <Plus
            {...decorative}
            color={colors.text}
            size={iconSizes.section}
            strokeWidth={2.2}
          />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The soft white fade the tabs disappear into before the "+". Four 4pt
 * slices of rising opacity stand in for a gradient (no gradient package).
 */
const FADE_STEPS = [0.2, 0.45, 0.7, 0.9] as const;
const FADE_STEP_WIDTH = 4;

const styles = StyleSheet.create({
  strip: {
    alignItems: 'stretch',
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  scroller: {
    flex: 1,
    minWidth: 0,
  },
  // Pinned at the right edge so "add a subject" is always one tap away,
  // however many subjects have scrolled past. A plain ghost icon: no pill,
  // no border, no fill; the fade on its left is the only separator.
  addColumn: {
    backgroundColor: colors.background,
    flexShrink: 0,
    justifyContent: 'center',
  },
  addButton: {
    alignItems: 'center',
    height: sizes.minimumTouchTarget,
    justifyContent: 'center',
    width: sizes.minimumTouchTarget,
  },
  fade: {
    bottom: 0,
    flexDirection: 'row',
    left: -FADE_STEPS.length * FADE_STEP_WIDTH,
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    width: FADE_STEPS.length * FADE_STEP_WIDTH,
  },
  fadeStep: {
    backgroundColor: colors.background,
    width: FADE_STEP_WIDTH,
  },
  content: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  tab: {
    alignItems: 'center',
    flexDirection: 'row',
    // 8 is for an icon next to its label; a count is the label's own tail.
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: sizes.minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tabLabel: {
    flexShrink: 1,
    maxWidth: 200,
  },
  tabCount: {
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.6,
  },
  underline: {
    backgroundColor: colors.text,
    borderRadius: UNDERLINE_HEIGHT,
    bottom: 0,
    height: UNDERLINE_HEIGHT,
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
  },
});
