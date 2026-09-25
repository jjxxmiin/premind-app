import { MonitorPlay } from 'lucide-react-native';
import {
  type CSSProperties,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { youtubeEmbedUrl } from '@/lib/youtube';
import { colors, palette, radii, spacing } from '@/theme/tokens';

import { AppText } from './ui/AppText';
import type { YouTubePlayerHandle, YouTubePlayerProps } from './YouTubePlayer';

export type { YouTubePlayerHandle, YouTubePlayerProps } from './YouTubePlayer';

/** The subset of the YouTube IFrame API the player relies on. */
interface YTPlayerInstance {
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  destroy: () => void;
}

interface YTNamespace {
  Player: new (
    element: HTMLIFrameElement,
    options: { events?: { onReady?: () => void } },
  ) => YTPlayerInstance;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';
const IFRAME_API_TIMEOUT_MS = 8000;
const POLL_INTERVAL_MS = 500;

let iframeApiPromise: Promise<YTNamespace> | null = null;

/**
 * Loads the IFrame API script once per page. Rejects when the script cannot
 * load (an ad blocker, an offline tab), which drops the player back to a
 * plain iframe without playhead sync.
 */
function loadIframeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('no window'));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      fail(new Error('YouTube IFrame API timed out'));
    }, IFRAME_API_TIMEOUT_MS);
    const finish = () => {
      window.clearTimeout(timeout);
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else fail(new Error('YouTube IFrame API unavailable'));
    };
    const fail = (error: Error) => {
      window.clearTimeout(timeout);
      iframeApiPromise = null;
      reject(error);
    };
    window.onYouTubeIframeAPIReady = finish;
    const script = document.createElement('script');
    script.src = IFRAME_API_SRC;
    script.async = true;
    script.onerror = () => fail(new Error('YouTube IFrame API failed to load'));
    document.head.appendChild(script);
  });
  return iframeApiPromise;
}

/**
 * Web variant: a raw `<iframe>` (react-native-web renders real DOM, so the
 * element can sit inside a `View`) driven by the IFrame API for playhead
 * sync. When the API cannot load, the iframe still plays; `seekTo` then
 * reloads it at the requested `start`.
 */
export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(
    { videoId, title, initialPositionMs = 0, onPositionChange },
    ref,
  ) {
    const t = useT();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const playerRef = useRef<YTPlayerInstance | null>(null);
    const lastReportedMs = useRef(-1);
    const positionListener = useRef(onPositionChange);
    const [startSeconds, setStartSeconds] = useState(() =>
      Math.max(0, initialPositionMs / 1000),
    );
    const [syncState, setSyncState] = useState<'loading' | 'synced' | 'plain'>(
      'loading',
    );
    const [frameLoaded, setFrameLoaded] = useState(false);

    useEffect(() => {
      positionListener.current = onPositionChange;
    }, [onPositionChange]);

    useEffect(() => {
      let disposed = false;
      let poll: number | null = null;

      void loadIframeApi()
        .then((YT) => {
          // Read the ref late: a fallback seek may have remounted the iframe
          // while the script was still loading.
          const iframe = iframeRef.current;
          if (disposed || !iframe) return;
          const player = new YT.Player(iframe, {
            events: {
              onReady: () => {
                if (disposed) return;
                playerRef.current = player;
                setSyncState('synced');
                poll = window.setInterval(() => {
                  const seconds = player.getCurrentTime?.();
                  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return;
                  const positionMs = Math.round(seconds * 1000);
                  if (Math.abs(positionMs - lastReportedMs.current) < 50) return;
                  lastReportedMs.current = positionMs;
                  positionListener.current?.(positionMs);
                }, POLL_INTERVAL_MS);
              },
            },
          });
        })
        .catch(() => {
          if (!disposed) setSyncState('plain');
        });

      return () => {
        disposed = true;
        if (poll !== null) window.clearInterval(poll);
        const player = playerRef.current;
        playerRef.current = null;
        try {
          player?.destroy();
        } catch {
          // The iframe is already gone when the screen unmounts.
        }
      };
      // The iframe is created once per video; a new id remounts the screen.
    }, [videoId]);

    useImperativeHandle(
      ref,
      () => ({
        seekTo: (positionMs: number) => {
          const seconds = Math.max(0, positionMs / 1000);
          const player = playerRef.current;
          if (player) {
            player.seekTo(seconds, true);
            player.playVideo();
            lastReportedMs.current = Math.round(seconds * 1000);
            positionListener.current?.(lastReportedMs.current);
            return;
          }
          // No API: reload the embed at the requested start.
          setFrameLoaded(false);
          setStartSeconds(seconds);
          positionListener.current?.(Math.round(seconds * 1000));
        },
      }),
      [],
    );

    const showLoading = !frameLoaded && syncState !== 'plain';

    return (
      <View style={styles.container}>
        <View style={styles.frame}>
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            aria-label={t('{title} 유튜브 영상', { title })}
            key={`start-${startSeconds}`}
            onLoad={() => setFrameLoaded(true)}
            ref={iframeRef}
            src={youtubeEmbedUrl(videoId, startSeconds)}
            style={iframeStyle}
            title={title}
          />
          {showLoading ? (
            <View style={styles.loading}>
              <MonitorPlay
                {...decorative}
                color={colors.stageMuted}
                size={28}
                strokeWidth={1.7}
              />
              <AppText style={styles.stageMuted} variant="meta">
                {t('유튜브 영상을 불러오고 있어요')}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    );
  },
);

const iframeStyle: CSSProperties = {
  backgroundColor: colors.stage,
  border: 0,
  display: 'block',
  height: '100%',
  left: 0,
  position: 'absolute',
  top: 0,
  width: '100%',
};

const styles = StyleSheet.create({
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
  loading: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
    alignItems: 'center',
    backgroundColor: colors.stage,
    gap: spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  stageMuted: { color: colors.stageMuted },
});
