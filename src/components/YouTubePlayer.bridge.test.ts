/** @jest-environment jsdom */

/**
 * The bridge is a string of JavaScript that runs inside YouTube's own embed
 * page, where nothing else in this repo can reach it. It is the piece two
 * previous attempts got wrong, so it is exercised here against a stand-in for
 * the embed: a `#movie_player` element with the player's methods, and the
 * message protocol the embed speaks.
 */

jest.mock('lucide-react-native', () => ({ MonitorPlay: () => null }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native-web'),
  TurboModuleRegistry: { get: () => null },
}));

const { BRIDGE_SCRIPT } = jest.requireActual(
  './YouTubePlayer',
) as typeof import('./YouTubePlayer');

interface Posted {
  type: string;
  seconds?: number;
  code?: number;
  errorPage?: boolean;
}

interface FakePlayer extends HTMLElement {
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
}

let posted: Posted[] = [];
/** What the bridge posted into the page, for the embed's own listener. */
let outgoing: { event?: string; func?: string; args?: unknown[] }[] = [];
let seeks: number[] = [];
let plays = 0;

/** Everything the page sent to the app. */
const messages = () => posted.map((message) => message.type);

function installReactNativeWebView() {
  (window as unknown as { ReactNativeWebView: { postMessage: (raw: string) => void } })
    .ReactNativeWebView = {
    postMessage: (raw: string) => {
      posted.push(JSON.parse(raw) as Posted);
    },
  };
}

/** A stand-in for the embed's own player element. */
function installMoviePlayer(startAt = 0): FakePlayer {
  const node = document.createElement('div') as unknown as FakePlayer;
  node.id = 'movie_player';
  let seconds = startAt;
  node.getCurrentTime = () => seconds;
  node.seekTo = (to: number) => {
    seeks.push(to);
    seconds = to;
  };
  node.playVideo = () => {
    plays += 1;
  };
  document.body.appendChild(node);
  return node;
}

/** What the embed itself posts once it is listening. */
function embedSays(body: Record<string, unknown>) {
  window.dispatchEvent(
    new MessageEvent('message', { data: JSON.stringify(body), source: window }),
  );
}

function runBridge() {
  (0, eval)(BRIDGE_SCRIPT);
}

beforeEach(() => {
  jest.useFakeTimers();
  posted = [];
  outgoing = [];
  seeks = [];
  plays = 0;
  document.body.replaceChildren();
  delete (window as unknown as Record<string, unknown>).__premindYT;
  installReactNativeWebView();
  // jsdom delivers `postMessage` on a later task, which fake timers never
  // reach; the bridge's outgoing traffic is read straight off the call.
  jest.spyOn(window, 'postMessage').mockImplementation((data: unknown) => {
    outgoing.push(JSON.parse(String(data)) as { event?: string });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const seek = (seconds: number) =>
  (window as unknown as { __premindYT: { seek: (s: number) => void } }).__premindYT.seek(
    seconds,
  );

describe('the embed bridge', () => {
  it('reports the playhead in seconds, from the embed’s own infoDelivery', () => {
    runBridge();
    embedSays({ event: 'infoDelivery', info: { currentTime: 12.5, playerState: 1 } });

    expect(posted).toContainEqual({ type: 'ready' });
    expect(posted).toContainEqual({ type: 'time', seconds: 12.5 });
  });

  it('reads the playhead off the player element when no message ever arrives', () => {
    const node = installMoviePlayer(4);
    runBridge();
    jest.advanceTimersByTime(500);
    expect(posted).toContainEqual({ type: 'time', seconds: 4 });

    node.seekTo(9, true);
    seeks = [];
    jest.advanceTimersByTime(500);
    expect(posted).toContainEqual({ type: 'time', seconds: 9 });
  });

  it('does not repeat a playhead that has not moved', () => {
    installMoviePlayer(4);
    runBridge();
    jest.advanceTimersByTime(2500);
    expect(posted.filter((message) => message.type === 'time')).toHaveLength(1);
  });

  it('seeks through the player element and resumes playback', () => {
    installMoviePlayer(0);
    runBridge();

    seek(402);

    expect(seeks).toEqual([402]);
    expect(plays).toBe(1);
    // Nothing had to go through the message protocol.
    expect(outgoing.filter((message) => message.event === 'command')).toHaveLength(0);
  });

  it('falls back to the message protocol when there is no player element', () => {
    runBridge();

    seek(30);

    expect(outgoing.filter((message) => message.event === 'command')).toEqual([
      { event: 'command', func: 'seekTo', args: [30, true], id: 1, channel: 'widget' },
      { event: 'command', func: 'playVideo', args: [], id: 1, channel: 'widget' },
    ]);
  });

  it('asks to be subscribed until the embed answers, then stops', () => {
    const listens = () => outgoing.filter((message) => message.event === 'listening');
    runBridge();
    expect(listens()).toHaveLength(1);

    jest.advanceTimersByTime(750);
    expect(listens().length).toBeGreaterThan(1);

    const before = listens().length;
    embedSays({ event: 'onReady' });
    jest.advanceTimersByTime(2000);
    expect(listens()).toHaveLength(before);
  });

  it('never mistakes its own outgoing messages for the player answering', () => {
    runBridge();
    // At the top level the bridge's own `listening` and `command` messages come
    // back round to its own listener. They must not read as a live player.
    embedSays({ event: 'listening', id: 1, channel: 'widget' });
    embedSays({ event: 'command', func: 'playVideo', args: [], id: 1, channel: 'widget' });

    expect(messages()).not.toContain('ready');
  });

  it('passes the error code through, from either message shape', () => {
    runBridge();
    embedSays({ event: 'onError', info: 150 });
    expect(posted).toContainEqual({ type: 'error', code: 150 });

    posted = [];
    embedSays({ event: 'infoDelivery', info: { errorCode: 153 } });
    expect(posted).toContainEqual({ type: 'error', code: 153 });
  });

  it('reports a page that never became a player', () => {
    runBridge();
    jest.advanceTimersByTime(12_000);
    expect(posted).toContainEqual({ type: 'stalled', errorPage: false });
  });

  it('starts that clock when the page has loaded, not when it was injected', () => {
    // A slow connection can spend most of the timeout on the page itself, and
    // a video that is merely slow must not be called one that failed.
    jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    runBridge();

    jest.advanceTimersByTime(60_000);
    expect(messages()).not.toContain('stalled');

    window.dispatchEvent(new Event('load'));
    jest.advanceTimersByTime(12_000);
    expect(posted).toContainEqual({ type: 'stalled', errorPage: false });
  });

  it('reports YouTube’s own error page even once the player is answering', () => {
    const error = document.createElement('div');
    error.className = 'ytp-error';
    error.getBoundingClientRect = () => ({ width: 320, height: 180 }) as DOMRect;
    document.body.appendChild(error);
    runBridge();
    embedSays({ event: 'onReady' });

    jest.advanceTimersByTime(12_000);
    expect(posted).toContainEqual({ type: 'stalled', errorPage: true });
  });

  it('stays quiet when the player is alive and no error page is showing', () => {
    installMoviePlayer(0);
    runBridge();
    embedSays({ event: 'onReady' });
    jest.advanceTimersByTime(12_000);
    expect(messages()).not.toContain('stalled');
  });

  it('installs once, however many times it is injected', () => {
    installMoviePlayer(3);
    runBridge();
    runBridge();
    runBridge();
    jest.advanceTimersByTime(500);
    expect(posted.filter((message) => message.type === 'time')).toHaveLength(1);
  });
});
