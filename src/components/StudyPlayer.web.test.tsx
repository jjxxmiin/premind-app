/** @jest-environment jsdom */

import { act, type ReactNode } from 'react';

jest.mock('expo', () => ({
  useEvent: jest.fn((_target, _event, initial) => initial),
}));
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioPlayer: jest.fn(() => ({
    clearLockScreenControls: jest.fn(),
    pause: jest.fn(),
    play: jest.fn(),
    seekTo: jest.fn(async () => undefined),
    setActiveForLockScreen: jest.fn(),
    setPlaybackRate: jest.fn(),
  })),
  useAudioPlayerStatus: jest.fn(() => ({
    currentTime: 0,
    duration: 0,
    error: null,
    isBuffering: false,
    isLoaded: false,
    playing: false,
  })),
}));
jest.mock('expo-video', () => ({
  VideoView: () => null,
  useVideoPlayer: jest.fn(() => ({
    bufferedPosition: 0,
    currentTime: 0,
    duration: 0,
    pause: jest.fn(),
    play: jest.fn(),
    playing: false,
    replay: jest.fn(),
    seekBy: jest.fn(),
    status: 'idle',
  })),
}));
jest.mock('lucide-react-native', () => ({
  Film: () => null,
  Maximize2: () => null,
  Pause: () => null,
  Play: () => null,
  RotateCcw: () => null,
  RotateCw: () => null,
  Volume2: () => null,
}));
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native-web'),
  TurboModuleRegistry: { get: () => null },
}));

// jsdom reports navigator.language 'en-US', and on the web build the app follows the
// browser language, so without this the player would render its English copy here.
// The assertions below read the Korean screen, which is the product default.
Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'ko-KR' });

const { StudyPlayer } = (() => {
  const originalWarn = console.warn;
  const warningSpy = jest.spyOn(console, 'warn').mockImplementation((message, ...rest) => {
    // IconButton still uses the shared native shadow token, which RNW warns
    // about during module initialization and is unrelated to pointer mapping.
    if (String(message).includes('"shadow*" style props are deprecated')) return;
    originalWarn(message, ...rest);
  });
  try {
    return jest.requireActual('./StudyPlayer') as typeof import('./StudyPlayer');
  } finally {
    warningSpy.mockRestore();
  }
})();

const { createRoot } = jest.requireActual('react-dom/client') as {
  createRoot: (container: Element) => TestRoot;
};

interface TestRoot {
  render: (node: ReactNode) => void;
  unmount: () => void;
}

let root: TestRoot | null = null;

function renderDemoPlayer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <StudyPlayer
        durationMs={120_000}
        kind="audio"
        title="좌표 테스트 강의"
        uri="mock://coordinate-test"
      />,
    );
  });
  const track = container.querySelector<HTMLElement>('[aria-label="재생 위치"]');
  expect(track).not.toBeNull();
  return track as HTMLElement;
}

function setTrackBounds(track: HTMLElement) {
  track.getBoundingClientRect = () => ({
    bottom: 44,
    height: 44,
    left: 100,
    right: 300,
    top: 0,
    width: 200,
    x: 100,
    y: 0,
    toJSON: () => ({}),
  });
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe('StudyPlayer web track coordinates', () => {
  it('seeks from clientX and current-target bounds when locationX is absent', () => {
    const track = renderDemoPlayer();
    setTrackBounds(track);
    const click = new MouseEvent('click', { bubbles: true, clientX: 150 });
    expect('locationX' in click).toBe(false);

    act(() => track.dispatchEvent(click));

    expect(track.getAttribute('aria-valuenow')).toBe('30');
    expect(track.getAttribute('aria-valuetext')).toBe('00:30 / 02:00');
  });

  it('falls back to offsetX when browser viewport coordinates are unavailable', () => {
    const track = renderDemoPlayer();
    setTrackBounds(track);
    const click = new MouseEvent('click', { bubbles: true });
    Object.defineProperties(click, {
      clientX: { value: undefined },
      offsetX: { value: 150 },
      pageX: { value: undefined },
    });

    act(() => track.dispatchEvent(click));

    expect(track.getAttribute('aria-valuenow')).toBe('90');
    expect(track.getAttribute('aria-valuetext')).toBe('01:30 / 02:00');
  });
});
