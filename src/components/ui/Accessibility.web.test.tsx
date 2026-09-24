/** @jest-environment jsdom */

import { act, useState, type ReactNode } from 'react';

import { AppText } from './AppText';
import { Chip } from './Chip';
import { BottomSheetModal } from './Modal';
import { ProgressBar } from './ProgressBar';
import { SegmentedControl } from './SegmentedControl';

jest.mock('lucide-react-native', () => ({ X: () => null }));
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native-web'),
  // expo-modules-core can be loaded while React DOM snapshots globals. A web
  // runtime intentionally has no native TurboModule registry.
  TurboModuleRegistry: { get: () => null },
  useWindowDimensions: () => ({ fontScale: 1, height: 800, scale: 1, width: 1024 }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

const { Card } = (() => {
  const originalWarn = console.warn;
  const warningSpy = jest.spyOn(console, 'warn').mockImplementation((message, ...rest) => {
    // The existing native shadow token emits an RNW deprecation during module
    // initialization; it is unrelated to the accessibility contract under test.
    if (String(message).includes('"shadow*" style props are deprecated')) return;
    originalWarn(message, ...rest);
  });
  try {
    return jest.requireActual('./Card') as typeof import('./Card');
  } finally {
    warningSpy.mockRestore();
  }
})();

// React DOM is an Expo runtime dependency. Its type package is intentionally
// absent because production code does not import React DOM directly.
const { createRoot } = jest.requireActual('react-dom/client') as {
  createRoot: (container: Element) => TestRoot;
};

interface TestRoot {
  render: (node: ReactNode) => void;
  unmount: () => void;
}

const mountedRoots: TestRoot[] = [];

function renderIntoDocument(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);
  act(() => root.render(node));
  return container;
}

function dispatchAnimationEnd(element: Element) {
  act(() => {
    element.dispatchEvent(new Event('animationend', { bubbles: true }));
  });
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop();
    if (root) act(() => root.unmount());
  }
  document.body.replaceChildren();
  jest.clearAllMocks();
});

describe('web accessibility state attributes', () => {
  it('exposes selected state on every segmented-control tab', () => {
    const onChange = jest.fn();
    const container = renderIntoDocument(
      <SegmentedControl
        onChange={onChange}
        options={[
          { label: '강의자', value: 'teacher' },
          { label: '학습자', value: 'student' },
        ]}
        value="teacher"
      />,
    );

    const tablist = container.querySelector('[role="tablist"]');
    const tabs = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));

    expect(tablist).not.toBeNull();
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('false');

    act(() => tabs[1]?.click());
    expect(onChange).toHaveBeenCalledWith('student');
  });

  it('only exposes aria-pressed for selectable interactive chips and cards', () => {
    const container = renderIntoDocument(
      <>
        <Chip label="선택됨" onPress={() => undefined} selected />
        <Chip label="선택 안 됨" onPress={() => undefined} selected={false} />
        <Chip label="일반 동작" onPress={() => undefined} />
        <Chip label="정적 칩" selected />
        <Card accessibilityLabel="선택 카드" onPress={() => undefined} selected />
        <Card
          accessibilityLabel="선택 안 된 카드"
          onPress={() => undefined}
          selected={false}
        />
        <Card accessibilityLabel="일반 카드" onPress={() => undefined} />
      </>,
    );

    const byLabel = (label: string) =>
      container.querySelector<HTMLElement>(`[aria-label="${label}"]`);

    expect(byLabel('선택됨')?.getAttribute('aria-pressed')).toBe('true');
    expect(byLabel('선택 안 됨')?.getAttribute('aria-pressed')).toBe('false');
    expect(byLabel('일반 동작')?.hasAttribute('aria-pressed')).toBe(false);
    expect(byLabel('정적 칩')?.hasAttribute('aria-pressed')).toBe(false);
    expect(byLabel('선택 카드')?.getAttribute('aria-pressed')).toBe('true');
    expect(byLabel('선택 안 된 카드')?.getAttribute('aria-pressed')).toBe('false');
    expect(byLabel('일반 카드')?.hasAttribute('aria-pressed')).toBe(false);
  });

  it('exposes clamped progress values and readable percentage text', () => {
    const container = renderIntoDocument(
      <ProgressBar label="업로드" max={80} showValue value={120} />,
    );
    const progressbar = container.querySelector('[role="progressbar"]');

    expect(progressbar?.getAttribute('aria-label')).toBe('업로드');
    expect(progressbar?.getAttribute('aria-valuemin')).toBe('0');
    expect(progressbar?.getAttribute('aria-valuemax')).toBe('80');
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('80');
    expect(progressbar?.getAttribute('aria-valuetext')).toBe('100%');
  });
});

describe('BottomSheetModal web focus behavior', () => {
  it('focuses the dialog, closes once on Escape, and returns focus to its caller', async () => {
    const onClose = jest.fn();

    function Harness() {
      const [visible, setVisible] = useState(false);
      return (
        <>
          <button onClick={() => setVisible(true)} type="button">
            모달 열기
          </button>
          <BottomSheetModal
            onClose={() => {
              onClose();
              setVisible(false);
            }}
            testID="test-dialog"
            title="테스트 모달"
            visible={visible}
          >
            <AppText>본문</AppText>
          </BottomSheetModal>
        </>
      );
    }

    const container = renderIntoDocument(<Harness />);
    const trigger = container.querySelector('button');
    expect(trigger).not.toBeNull();
    trigger?.focus();
    expect(document.activeElement).toBe(trigger);

    act(() => trigger?.click());
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    const sheet = document.querySelector<HTMLElement>('[data-testid="test-dialog"]');
    expect(sheet).not.toBeNull();
    expect(document.activeElement).toBe(sheet);

    const portalHost = Array.from(document.body.children).find(
      (element) => element !== container,
    );
    const openingAnimation = portalHost?.firstElementChild ?? null;
    expect(openingAnimation).not.toBeNull();
    if (openingAnimation) dispatchAnimationEnd(openingAnimation);
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]?.getAttribute('aria-label')).toBe('테스트 모달');
    expect(dialogs[0]?.contains(document.activeElement)).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const closingAnimation = portalHost?.firstElementChild ?? null;
    expect(closingAnimation).not.toBeNull();
    if (closingAnimation) dispatchAnimationEnd(closingAnimation);
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(document.activeElement).toBe(trigger);
  });
});
