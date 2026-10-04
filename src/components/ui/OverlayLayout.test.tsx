import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { BottomAction } from '@/components/app/BottomAction';

import { AppText } from './AppText';
import { Dialog } from './Dialog';
import { BottomSheetModal } from './Modal';
import { Screen } from './Screen';
import { Toast } from './Toast';

jest.mock('lucide-react-native', () => ({ X: () => null }));
jest.mock('./Motion', () => ({ useReducedMotion: () => true }));
jest.mock('@/lib/layout', () => ({
  useLayout: () => ({
    breakpoint: 'compact',
    contentMaxWidth: 760,
    gutter: 20,
    isTablet: false,
    wideMaxWidth: 1200,
  }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View: MockView } = jest.requireActual('react-native');
  return {
    SafeAreaView: MockView,
    useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 24 }),
  };
});

describe('viewport overlays', () => {
  it('keeps feedback outside scrolling screen content', async () => {
    await render(
      <Screen overlay={<Toast message="저장했어요" />} scroll scrollViewProps={{ testID: 'body-scroll' }}>
        <AppText>스크롤 본문</AppText>
      </Screen>,
    );

    expect(within(screen.getByTestId('body-scroll')).queryByText('저장했어요')).toBeNull();
    expect(screen.getByText('저장했어요')).toBeOnTheScreen();
  });

  it('clears the measured bottom action without applying the safe area twice', async () => {
    await render(
      <Screen>
        <BottomAction><AppText>다시 연습</AppText></BottomAction>
        <Toast message="저장했어요" />
      </Screen>,
    );
    const dock = screen.container.queryAll(
      (node) => node.props.pointerEvents === 'box-none',
    )[0];
    expect(dock).toBeDefined();
    if (!dock) throw new Error('Bottom action did not render');
    expect(dock.props.edges).toEqual([]);
    await fireEvent(dock, 'layout', { nativeEvent: { layout: { height: 110, width: 375, x: 0, y: 600 } } });

    const toast = screen.container.queryAll(
      (node) => node.props.accessibilityLiveRegion === 'polite',
    )[0];
    expect(StyleSheet.flatten(toast?.props.style)?.bottom).toBe(122);
  });

  it('shrinks a sheet when its keyboard-safe positioning region shrinks', async () => {
    await render(
      <BottomSheetModal onClose={() => undefined} testID="sheet" title="폴더 만들기" visible>
        <AppText>내용</AppText>
      </BottomSheetModal>,
    );
    const sheet = screen.getByTestId('sheet');
    const positioner = sheet.parent;
    if (!positioner) throw new Error('Sheet positioner did not render');
    await fireEvent(positioner, 'layout', { nativeEvent: { layout: { height: 240, width: 375, x: 0, y: 0 } } });
    expect(StyleSheet.flatten(sheet.props.style).maxHeight).toBeLessThanOrEqual(216);
    expect(screen.container.queryAll((node) => node.props.animationType === 'none')).toHaveLength(1);
  });

  it('keeps long dialog content and confirmation in a bounded scroll region', async () => {
    await render(
      <Dialog confirm={{ label: '확인', onPress: () => undefined }} testID="dialog" title="알림" visible>
        <AppText>{'긴 알림 내용 '.repeat(40)}</AppText>
      </Dialog>,
    );
    const dialog = screen.getByTestId('dialog');
    expect(StyleSheet.flatten(dialog.props.style).maxHeight).toBe('100%');
    const scroller = screen.container.queryAll((node) => node.type.includes('ScrollView'))[0];
    if (!scroller) throw new Error('Dialog scroll region did not render');
    expect(within(scroller).getByRole('button', { name: '확인' })).toBeOnTheScreen();
    expect(screen.container.queryAll((node) => node.props.animationType === 'none')).toHaveLength(1);
  });
});
