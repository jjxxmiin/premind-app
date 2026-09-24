import { MonitorPlay } from 'lucide-react-native';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { decorative } from '@/lib/a11y';
import {
  leavesYouTubeEmbed,
  youtubeEmbedUrl,
  youtubeWatchUrl,
  YOUTUBE_EMBEDDER_ORIGIN,
  YOUTUBE_MESSAGE_ORIGIN,
} from '@/lib/youtube';
import {
  embedFailureCopy,
  embedFailureOf,
  embedFailureOfStatus,
  type EmbedFailure,
} from '@/lib/youtube-embed';
import { colors, palette, radii, spacing } from '@/theme/tokens';

import { AppText } from './ui/AppText';
import { Button } from './ui/Button';

export interface YouTubePlayerProps {
  /** The 11-character video id (`material.source.youtubeId`). */
  videoId: string;
  title: string;
  durationMs?: number;
  initialPositionMs?: number;
  /** Fires about twice a second while the video plays, in milliseconds. */
  onPositionChange?: (positionMs: number) => void;
}

export interface YouTubePlayerHandle {
  /** Jump the embedded video to a position without reloading it. */
  seekTo: (positionMs: number) => void;
}

/** Messages the embed page posts to the app through the injected bridge. */
type PlayerMessage =
  | { type: 'ready' }
  | { type: 'time'; seconds: number }
  | { type: 'error'; code: number }
  /** The page never became a player. `errorPage` is YouTube's own error UI. */
  | { type: 'stalled'; errorPage: boolean };

/**
 * The shapes the two WebView callbacks need. `react-native-webview` keeps
 * `WebViewHttpErrorEvent` and `ShouldStartLoadRequest` out of its public
 * types, and reaching into `lib/` for them breaks on every upgrade.
 */
interface HttpErrorEvent {
  nativeEvent: { statusCode: number; url: string };
}
interface NavigationRequest {
  url: string;
  /** Android only raises this for the main frame; iOS says which it is. */
  isTopFrame?: boolean;
}

/** How long the loaded page waits for a player before it says so. */
const READY_TIMEOUT_MS = 12_000;
/**
 * The app's own backstop, for a page that never runs our script at all. It
 * has to outlast the in-page watchdog plus the page's own load, so it is
 * deliberately slack: the in-page one is what normally reports a failure.
 */
const BRIDGE_TIMEOUT_MS = 25_000;

/**
 * Runs inside the embed page.
 *
 * Two ways to drive the player, because each covers the other's blind spot:
 *
 * - The `#movie_player` element carries the whole player API as plain methods
 *   (`getCurrentTime`, `seekTo`, `playVideo`). The embed is the top-level
 *   document here, so the page is same-origin with itself and they are simply
 *   callable. This is the reliable path and the one the playhead is read from.
 * - The IFrame API's postMessage protocol is what reports *error codes*, which
 *   the element exposes nowhere. The embed posts to `window.parent`, which at
 *   top level is this same window, so the messages come back to us.
 *
 * Injected twice (before content and after load) and idempotent, because
 * Android does not promise the early injection lands before the page's own
 * scripts.
 */
export const BRIDGE_SCRIPT = `(function () {
  if (window.__premindYT) { window.__premindYT.listen(); return true; }

  var alive = false;
  var lastSeconds = -1;

  function post(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  function wake() {
    if (alive) return;
    alive = true;
    post({ type: 'ready' });
  }

  function report(seconds) {
    if (typeof seconds !== 'number' || !isFinite(seconds)) return;
    if (Math.abs(seconds - lastSeconds) < 0.05) return;
    lastSeconds = seconds;
    post({ type: 'time', seconds: seconds });
  }

  function movie() {
    var node = document.getElementById('movie_player');
    return node && typeof node.getCurrentTime === 'function' ? node : null;
  }

  function send(body) {
    try {
      window.postMessage(JSON.stringify(body), '*');
    } catch (error) {
      /* the page is being torn down */
    }
  }

  var api = {
    listen: function () {
      send({ event: 'listening', id: 1, channel: 'widget' });
    },
    call: function (name, args) {
      var node = movie();
      if (node && typeof node[name] === 'function') {
        try {
          node[name].apply(node, args || []);
          return;
        } catch (error) {
          /* fall through to the message protocol */
        }
      }
      send({ event: 'command', func: name, args: args || [], id: 1, channel: 'widget' });
    },
    seek: function (seconds) {
      lastSeconds = -1;
      api.call('seekTo', [seconds, true]);
      api.call('playVideo', []);
    },
  };
  window.__premindYT = api;

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (error) { return; }
    }
    if (!data || typeof data !== 'object' || typeof data.event !== 'string') return;
    // Our own outgoing messages come back round to this listener.
    if (data.event === 'command' || data.event === 'listening') return;
    wake();
    var info = data.info;
    if (data.event === 'onError') {
      post({ type: 'error', code: Number(info && typeof info === 'object' ? info.errorCode : info) });
      return;
    }
    if (info && typeof info === 'object') {
      if (typeof info.errorCode === 'number') post({ type: 'error', code: info.errorCode });
      if (typeof info.currentTime === 'number') report(info.currentTime);
    }
  });

  setInterval(function () {
    var node = movie();
    if (!node) return;
    wake();
    try { report(node.getCurrentTime()); } catch (error) { /* not ready yet */ }
  }, 500);

  api.listen();
  var tries = 0;
  var handshake = setInterval(function () {
    tries += 1;
    if (alive || tries > 40) { clearInterval(handshake); return; }
    api.listen();
  }, 250);

  // Counted from the page being loaded, not from injection: on a slow
  // connection the page itself can take most of this, and a video that is
  // merely slow must not be reported as one that failed.
  function armWatchdog() {
    setTimeout(function () {
      var node = document.querySelector('.ytp-error');
      var showing = !!(node && node.getBoundingClientRect().width > 0);
      if (!showing && alive) return;
      post({ type: 'stalled', errorPage: showing });
    }, ${READY_TIMEOUT_MS});
  }
  if (document.readyState === 'complete') armWatchdog();
  else window.addEventListener('load', armWatchdog);

  return true;
})();
true;`;

function parseMessage(raw: string): PlayerMessage | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PlayerMessage> | null;
    if (!parsed || typeof parsed.type !== 'string') return null;
    return parsed as PlayerMessage;
  } catch {
    return null;
  }
}

/**
 * The player for link-imported materials. The dark 16:9 stage matches
 * `StudyPlayer`; the video itself is YouTube's own embed page, loaded as the
 * WebView's document rather than injected as HTML, so the transcript and notes
 * follow the same `onPositionChange` / `seekTo` contract the audio and video
 * players use.
 *
 * Loading the page instead of injecting it is the whole point: an injected
 * page arrives through `loadDataWithBaseURL` on Android, which leaves the
 * document without a real origin, and the embed inside it is then an embed of
 * youtube.com by youtube.com — a configuration YouTube answers with an error
 * instead of a video. Loading `/embed/<id>` puts the player on its own origin,
 * and a `Referer` naming the app's site gives YouTube the embedder it insists
 * on.
 */
export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(
    { videoId, title, initialPositionMs = 0, onPositionChange },
    ref,
  ) {
    const webViewRef = useRef<WebView>(null);
    const [ready, setReady] = useState(false);
    const [failure, setFailure] = useState<EmbedFailure | null>(null);
    /** Bumped to reload the page, which is the only way to retry an embed. */
    const [attempt, setAttempt] = useState(0);
    /** Where a reload resumes; only ever changed by a retry. */
    const [startSeconds, setStartSeconds] = useState(() =>
      Math.max(0, initialPositionMs / 1000),
    );
    /** The playhead, so a retry comes back where the reader left off. */
    const positionRef = useRef(Math.max(0, initialPositionMs / 1000));
    /** A seek asked for before the page could take it. */
    const pendingSeekRef = useRef<number | null>(null);
    const readyRef = useRef(false);

    const embedUrl = useMemo(
      () => youtubeEmbedUrl(videoId, startSeconds, { origin: YOUTUBE_MESSAGE_ORIGIN }),
      [videoId, startSeconds],
    );
    const source = useMemo(
      () => ({ uri: embedUrl, headers: { Referer: `${YOUTUBE_EMBEDDER_ORIGIN}/` } }),
      [embedUrl],
    );

    const seekInPage = useCallback((seconds: number) => {
      webViewRef.current?.injectJavaScript(
        `window.__premindYT && window.__premindYT.seek(${seconds}); true;`,
      );
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        seekTo: (positionMs: number) => {
          const seconds = Math.max(0, positionMs / 1000);
          positionRef.current = seconds;
          if (readyRef.current) seekInPage(seconds);
          else pendingSeekRef.current = seconds;
        },
      }),
      [seekInPage],
    );

    // A page that loads but never becomes a player leaves a black stage and no
    // `onError`, so time it out and say so.
    useEffect(() => {
      if (ready || failure) return undefined;
      const timer = setTimeout(() => setFailure('no-player'), BRIDGE_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }, [attempt, failure, ready]);

    const copy = embedFailureCopy(failure ?? 'player-error');

    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        const message = parseMessage(event.nativeEvent.data);
        if (!message) return;
        if (message.type === 'ready') {
          readyRef.current = true;
          setReady(true);
          const pending = pendingSeekRef.current;
          if (pending !== null) {
            pendingSeekRef.current = null;
            seekInPage(pending);
          }
        } else if (message.type === 'error') {
          setFailure(embedFailureOf(message.code));
        } else if (message.type === 'stalled') {
          setFailure(message.errorPage ? 'embed-refused' : 'no-player');
        } else if (message.type === 'time' && Number.isFinite(message.seconds)) {
          positionRef.current = message.seconds;
          onPositionChange?.(Math.round(message.seconds * 1000));
        }
      },
      [onPositionChange, seekInPage],
    );

    const handleHttpError = useCallback((event: HttpErrorEvent) => {
      const { statusCode, url } = event.nativeEvent;
      // Only the embed document matters; a failed thumbnail is not a failure.
      if (!url || !url.includes('/embed/')) return;
      setFailure(embedFailureOfStatus(statusCode));
    }, []);

    // Tapping the watermark navigates the whole 16:9 box to the YouTube site.
    // Send that to the browser and keep the player on the embed.
    const handleNavigation = useCallback((request: NavigationRequest) => {
      if (request.isTopFrame === false) return true;
      if (!leavesYouTubeEmbed(request.url)) return true;
      void Linking.openURL(request.url).catch(() => undefined);
      return false;
    }, []);

    const retry = useCallback(() => {
      readyRef.current = false;
      setFailure(null);
      setReady(false);
      setStartSeconds(positionRef.current);
      setAttempt((value) => value + 1);
    }, []);

    return (
      <View style={styles.container}>
        <View
          accessibilityLabel={`${title} 유튜브 영상`}
          accessibilityRole="image"
          style={styles.frame}
        >
          <WebView
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            // The HTML5 player asks for the EME permission even on a clear
            // stream; denying it is reported back as error 5.
            allowsProtectedMedia
            contentMode="mobile"
            domStorageEnabled
            injectedJavaScript={BRIDGE_SCRIPT}
            injectedJavaScriptBeforeContentLoaded={BRIDGE_SCRIPT}
            javaScriptEnabled
            key={attempt}
            mediaPlaybackRequiresUserAction={false}
            onError={() => setFailure('offline')}
            onHttpError={handleHttpError}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleNavigation}
            originWhitelist={['*']}
            overScrollMode="never"
            ref={webViewRef}
            // Android otherwise lays the page out at a wide viewport and scales
            // it, and leaves pinch zoom on — both of which crop the video
            // inside a box this small. The embed is already responsive.
            scalesPageToFit={false}
            scrollEnabled={false}
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
            setSupportMultipleWindows={false}
            source={source}
            style={styles.webView}
            thirdPartyCookiesEnabled
          />
          {!ready && !failure ? (
            <View style={styles.loading}>
              <MonitorPlay
                {...decorative}
                color={colors.stageMuted}
                size={28}
                strokeWidth={1.7}
              />
              <AppText style={styles.stageMuted} variant="meta">
                유튜브 영상을 불러오고 있어요
              </AppText>
            </View>
          ) : null}
          {failure ? (
            <View style={[styles.loading, styles.failure]}>
              <MonitorPlay
                {...decorative}
                color={colors.stageMuted}
                size={28}
                strokeWidth={1.7}
              />
              <AppText align="center" style={styles.stageMuted} variant="meta">
                {copy.message}
              </AppText>
              <View style={styles.failureActions}>
                {copy.offerRetry ? (
                  <Button onPress={retry} size="small" variant="secondary">
                    다시 시도
                  </Button>
                ) : null}
                {copy.offerYouTube ? (
                  <Button
                    onPress={() => {
                      void Linking.openURL(youtubeWatchUrl(videoId)).catch(
                        () => undefined,
                      );
                    }}
                    size="small"
                    variant="secondary"
                  >
                    유튜브에서 보기
                  </Button>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  failureActions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  container: {
    backgroundColor: colors.stage,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  frame: {
    aspectRatio: 16 / 9,
    backgroundColor: palette.stage950,
    position: 'relative',
    width: '100%',
  },
  // The WebView is the frame's only laid-out child, so it takes the whole
  // 16:9 box; the overlays sit on top of it. Absolute positioning here fought
  // the library's own `flex: 1` and left the page measuring the wrong height.
  webView: {
    backgroundColor: colors.stage,
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
    alignItems: 'center',
    backgroundColor: colors.stage,
    gap: spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  // The failure overlay carries 다시 시도 and 유튜브에서 보기, so unlike the
  // loading overlay it has to take taps.
  failure: { pointerEvents: 'auto' },
  stageMuted: { color: colors.stageMuted },
});
