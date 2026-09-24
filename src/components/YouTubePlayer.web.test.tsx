/** @jest-environment jsdom */

import { act, createRef, type ReactNode } from 'react';

import { youtubeEmbedUrl } from '@/lib/youtube';

// The React Native preset installs its own URL polyfills; the embed URL
// needs the WHATWG implementation the browser will actually use.
const nodeUrl = jest.requireActual('node:url') as {
  URL: typeof URL;
  URLSearchParams: typeof URLSearchParams;
};
globalThis.URL = nodeUrl.URL;
globalThis.URLSearchParams = nodeUrl.URLSearchParams;

jest.mock('lucide-react-native', () => ({
  MonitorPlay: () => null,
}));
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native-web'),
  TurboModuleRegistry: { get: () => null },
}));

const { YouTubePlayer } = jest.requireActual(
  './YouTubePlayer.web',
) as typeof import('./YouTubePlayer.web');
type YouTubePlayerHandle = import('./YouTubePlayer.web').YouTubePlayerHandle;

const { createRoot } = jest.requireActual('react-dom/client') as {
  createRoot: (container: Element) => TestRoot;
};

interface TestRoot {
  render: (node: ReactNode) => void;
  unmount: () => void;
}

let root: TestRoot | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  document.head.replaceChildren();
});

function renderPlayer(initialPositionMs: number) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const ref = createRef<YouTubePlayerHandle>();
  const onPositionChange = jest.fn();
  act(() => {
    root?.render(
      <YouTubePlayer
        initialPositionMs={initialPositionMs}
        onPositionChange={onPositionChange}
        ref={ref}
        title="딥러닝 기본원리"
        videoId="dQw4w9WgXcQ"
      />,
    );
  });
  const iframe = () => container.querySelector<HTMLIFrameElement>('iframe');
  return { container, iframe, onPositionChange, ref };
}

describe('YouTubePlayer (web)', () => {
  it('embeds the video through youtubeEmbedUrl with the IFrame API enabled', () => {
    const { iframe } = renderPlayer(72_500);
    const element = iframe();
    expect(element).not.toBeNull();
    expect(element?.getAttribute('src')).toBe(youtubeEmbedUrl('dQw4w9WgXcQ', 72.5));
    const url = new URL(element?.getAttribute('src') ?? '');
    expect(url.searchParams.get('enablejsapi')).toBe('1');
    expect(url.searchParams.get('start')).toBe('72');
    expect(element?.getAttribute('title')).toBe('딥러닝 기본원리');
    expect(document.head.querySelector('script[src="https://www.youtube.com/iframe_api"]')).not.toBeNull();
  });

  it('falls back to reloading the embed at the new start when the API is unavailable', () => {
    const { iframe, onPositionChange, ref } = renderPlayer(0);
    expect(new URL(iframe()?.getAttribute('src') ?? '').searchParams.get('start')).toBe('0');

    act(() => ref.current?.seekTo(402_000));

    expect(iframe()?.getAttribute('src')).toBe(youtubeEmbedUrl('dQw4w9WgXcQ', 402));
    expect(onPositionChange).toHaveBeenLastCalledWith(402_000);
  });
});
