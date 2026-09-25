import { X } from 'lucide-react-native';
import {
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  KeyboardAvoidingView,
  Modal as NativeModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, radii, shadows, sizes, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  /** Runs after the closing animation has fully removed the modal. */
  onDismiss?: () => void;
  title?: string;
  description?: string;
  footer?: ReactNode;
  dismissOnBackdropPress?: boolean;
  /**
   * Enables scrolling immediately. Even when false, scrolling is unlocked if
   * the body overflows after layout so large text cannot hide content.
   */
  scrollable?: boolean;
  closeLabel?: string;
  maxHeightRatio?: number;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/** A bottom sheet on phones and a centered dialog on tablet-sized screens. */
export function BottomSheetModal({
  visible,
  onClose,
  onDismiss,
  title,
  description,
  footer,
  dismissOnBackdropPress = true,
  scrollable = true,
  closeLabel: closeLabelProp,
  maxHeightRatio = 0.88,
  contentStyle,
  children,
  testID,
}: PropsWithChildren<BottomSheetModalProps>) {
  const t = useT();
  const closeLabel = closeLabelProp ?? t('닫기');
  const sheetRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const isTablet = width >= 600;
  const safeRatio = Math.min(Math.max(maxHeightRatio, 0.4), 0.96);
  const positionerPaddingTop = Math.max(
    insets.top,
    isTablet ? spacing.xxl : spacing.md,
  );
  const positionerPaddingBottom = isTablet
    ? Math.max(insets.bottom, spacing.xxl)
    : 0;
  const positionerPaddingLeft = Math.max(
    insets.left,
    isTablet ? spacing.xxl : 0,
  );
  const positionerPaddingRight = Math.max(
    insets.right,
    isTablet ? spacing.xxl : 0,
  );
  const availableWidth = Math.max(
    0,
    width - positionerPaddingLeft - positionerPaddingRight,
  );
  const availableHeight = Math.max(
    0,
    height - positionerPaddingTop - positionerPaddingBottom,
  );
  const sheetWidth = isTablet ? Math.min(availableWidth, 560) : availableWidth;
  const sheetMaxHeight = Math.min(height * safeRatio, availableHeight);
  // Clearance ABOVE the system bar, not merely equal to it: matching the
  // inset leaves a footer button looking glued to the bottom of the screen.
  const sheetBottomPadding = isTablet
    ? spacing.gutter
    : insets.bottom + spacing.gutter;
  const [bodyViewportHeight, setBodyViewportHeight] = useState(0);
  const [bodyContentHeight, setBodyContentHeight] = useState(0);
  const bodyOverflows = bodyContentHeight > bodyViewportHeight + 1;
  const bodyCanScroll = scrollable || bodyOverflows;

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;

    // React Native Web's Modal owns the outer dialog semantics, Escape handler,
    // focus trap, and caller-focus restoration. Put initial focus on the visual
    // sheet inside that dialog without installing duplicate document handlers.
    const focusTimer = window.setTimeout(() => {
      (sheetRef.current as unknown as HTMLElement | null)?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [visible]);

  const body = (
    <ScrollView
      bounces={bodyCanScroll}
      contentContainerStyle={[styles.body, contentStyle]}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      onContentSizeChange={(_contentWidth, contentHeight) => {
        setBodyContentHeight((current) =>
          Math.abs(current - contentHeight) < 1 ? current : contentHeight,
        );
      }}
      onLayout={({ nativeEvent }) => {
        const viewportHeight = nativeEvent.layout.height;
        setBodyViewportHeight((current) =>
          Math.abs(current - viewportHeight) < 1 ? current : viewportHeight,
        );
      }}
      scrollEnabled={bodyCanScroll}
      showsVerticalScrollIndicator={bodyCanScroll}
      style={styles.bodyScroller}
    >
      {children}
    </ScrollView>
  );

  return (
    <NativeModal
      accessibilityLabel={Platform.OS === 'web' ? title ?? t('대화상자') : undefined}
      animationType="fade"
      onDismiss={onDismiss}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          {...decorative}
          onPress={dismissOnBackdropPress ? onClose : undefined}
          style={styles.backdrop}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'web' ? undefined : 'padding'}
          style={[
            styles.positioner,
            isTablet ? styles.tabletPositioner : styles.phonePositioner,
            {
              paddingBottom: positionerPaddingBottom,
              paddingLeft: positionerPaddingLeft,
              paddingRight: positionerPaddingRight,
              paddingTop: positionerPaddingTop,
            },
          ]}
        >
          <View
            accessibilityLabel={title ?? t('대화상자')}
            accessibilityViewIsModal
            ref={sheetRef}
            role={Platform.OS === 'web' ? undefined : 'dialog'}
            style={[
              styles.sheet,
              isTablet ? styles.tabletSheet : styles.phoneSheet,
              {
                maxHeight: sheetMaxHeight,
                paddingBottom: sheetBottomPadding,
                width: sheetWidth,
              },
            ]}
            tabIndex={Platform.OS === 'web' ? -1 : undefined}
            testID={testID}
          >
            {!isTablet ? <View {...decorative} style={styles.handle} /> : null}
            {title || description ? (
              <View style={styles.header}>
                <View style={styles.headerCopy}>
                  {title ? (
                    <AppText accessibilityRole="header" variant="heading">
                      {title}
                    </AppText>
                  ) : null}
                  {description ? (
                    <AppText tone="muted" variant="meta">
                      {description}
                    </AppText>
                  ) : null}
                </View>
                <IconButton icon={X} label={closeLabel} onPress={onClose} />
              </View>
            ) : (
              <View style={styles.closeOnly}>
                <IconButton icon={X} label={closeLabel} onPress={onClose} />
              </View>
            )}
            {body}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </NativeModal>
  );
}

export const AppModal = BottomSheetModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: colors.overlay,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  positioner: {
    flex: 1,
    pointerEvents: 'box-none',
  },
  phonePositioner: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tabletPositioner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.floating,
  },
  phoneSheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
  },
  tabletSheet: {
    borderRadius: radii.modal,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.borderStrong,
    borderRadius: radii.full,
    height: 4,
    marginTop: spacing.md,
    width: 40,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: sizes.mobileHeader,
    paddingHorizontal: spacing.gutter,
    flexShrink: 0,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
    paddingVertical: spacing.md,
  },
  closeOnly: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minHeight: sizes.mobileHeader,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  body: {
    flexGrow: 1,
    padding: spacing.gutter,
  },
  bodyScroller: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
  },
  footer: {
    flexShrink: 0,
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
  },
});
