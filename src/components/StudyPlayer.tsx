import { useEvent } from 'expo';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  Film,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
} from 'lucide-react-native';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { decorative } from '@/lib/a11y';
import {
  createWebMediaPlaybackUrl,
  isPersistedWebMediaUri,
} from '@/features/files/web-media-store';
import {
  createAuthenticatedWebMediaUrl,
  type RefreshPrivateMediaSource,
} from '@/features/files/web-authenticated-media';
import { formatDuration } from '@/lib/format';
import { colors, palette, radii, sizes, spacing } from '@/theme/tokens';
import type { MaterialKind } from '@/types';

import { AppText } from './ui/AppText';

/** Daglo-style speed steps; `1` is the default and the cycle start. */
const PLAYBACK_RATES = [0.8, 1, 1.25, 1.5, 2] as const;
type PlaybackRate = (typeof PLAYBACK_RATES)[number];
const DEFAULT_RATE: PlaybackRate = 1;

function nextPlaybackRate(current: number): PlaybackRate {
  const index = PLAYBACK_RATES.indexOf(current as PlaybackRate);
  return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length] ?? DEFAULT_RATE;
}

function formatRate(rate: number): string {
  return `${rate}x`;
}
const ACCESSIBLE_SEEK_SECONDS = 15;

export interface StudyPlayerFallbackSource {
  uri: string;
  headers?: Record<string, string>;
  refresh?: RefreshPrivateMediaSource;
}

interface StudyPlayerProps {
  uri: string;
  headers?: Record<string, string>;
  fallbackSource?: StudyPlayerFallbackSource;
  title: string;
  kind: MaterialKind;
  durationMs?: number;
  initialPositionMs?: number;
  onPositionChange?: (positionMs: number) => void;
  onPlaybackError?: (message: string) => void;
  onPlaybackReady?: () => void;
}

interface PlayerChromeProps {
  title: string;
  kind: MaterialKind;
  sourceLabel: string;
  duration: number;
  position: number;
  playing: boolean;
  rate: number;
  media?: ReactNode;
  /** Steps to the next speed (keyboard / assistive cycling). */
  onChangeRate: () => void;
  /** Picks a speed from the inline picker. */
  onSelectRate: (rate: PlaybackRate) => void;
  onSeek: (seconds: number) => void;
  onTogglePlayback: () => void;
}

export function StudyPlayer(props: StudyPlayerProps) {
  return (
    <StudyPlayerState
      key={`${props.uri}|${props.fallbackSource?.uri ?? ''}`}
      {...props}
    />
  );
}

function StudyPlayerState(props: StudyPlayerProps) {
  const [usingFallback, setUsingFallback] = useState(false);
  const [nativeFallbackSource, setNativeFallbackSource] =
    useState<StudyPlayerFallbackSource | null>(null);
  const [nativeRefreshPending, setNativeRefreshPending] = useState(false);
  const [playbackRevision, setPlaybackRevision] = useState(0);
  const [resumePositionMs, setResumePositionMs] = useState(
    props.initialPositionMs ?? 0,
  );
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const lastPositionMs = useRef(props.initialPositionMs ?? 0);
  const nativeRefreshStarted = useRef(false);
  const mounted = useRef(true);
  const externalPositionChange = props.onPositionChange;
  const effectiveFallbackSource = nativeFallbackSource ?? props.fallbackSource;
  const resolved = usePlayableMediaUri(
    props.uri,
    props.headers,
    effectiveFallbackSource,
    usingFallback,
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handlePositionChange = useCallback(
    (positionMs: number) => {
      lastPositionMs.current = positionMs;
      externalPositionChange?.(positionMs);
    },
    [externalPositionChange],
  );

  const handlePlaybackReady = useCallback(() => {
    if (
      Platform.OS !== 'web' &&
      nativeFallbackSource &&
      (usingFallback || resolved.usingFallback)
    ) {
      // The refreshed credential proved it can load media. A later failure is
      // a new playback incident (for example, the next hourly token expiry),
      // so it may make one new refresh attempt without enabling error loops.
      nativeRefreshStarted.current = false;
    }
  }, [nativeFallbackSource, resolved.usingFallback, usingFallback]);

  const handlePlaybackError = useCallback(
    (message: string) => {
      const fallbackIsActive = usingFallback || resolved.usingFallback;
      const positionAtFailure = lastPositionMs.current;

      if (effectiveFallbackSource && !fallbackIsActive) {
        setResumePositionMs(positionAtFailure);
        setUsingFallback(true);
        setPlaybackError(null);
        return;
      }

      if (
        Platform.OS !== 'web' &&
        fallbackIsActive &&
        effectiveFallbackSource?.refresh &&
        !nativeRefreshStarted.current
      ) {
        nativeRefreshStarted.current = true;
        setNativeRefreshPending(true);
        setResumePositionMs(positionAtFailure);

        const rejectedSource = {
          uri: resolved.uri ?? effectiveFallbackSource.uri,
          headers: resolved.headers ?? effectiveFallbackSource.headers ?? {},
        };
        const refresh = effectiveFallbackSource.refresh;
        void refresh(rejectedSource)
          .then((freshSource) => {
            if (!mounted.current) return;
            setNativeFallbackSource({ ...freshSource, refresh });
            setPlaybackRevision((current) => current + 1);
            setPlaybackError(null);
          })
          .catch(() => {
            if (!mounted.current) return;
            setPlaybackError(message);
          })
          .finally(() => {
            if (mounted.current) setNativeRefreshPending(false);
          });
        return;
      }
      setPlaybackError(message);
    },
    [
      effectiveFallbackSource,
      resolved.headers,
      resolved.uri,
      resolved.usingFallback,
      usingFallback,
    ],
  );

  const sourceError = playbackError ?? resolved.error;
  if (nativeRefreshPending || sourceError || !resolved.uri) {
    return (
      <PlayerSourceState
        description={
          nativeRefreshPending
            ? '재생 위치는 그대로 두고 연결을 다시 확인하고 있어요.'
            : sourceError
            ? '원본은 안전하지만 이 기기에서 재생할 수 없어요. 다른 형식으로 다시 올려 주세요.'
            : usingFallback || resolved.usingFallback
              ? '보관된 원본을 불러오고 있어요.'
              : '이 기기에 저장된 원본을 확인하고 있어요.'
        }
        kind={props.kind}
        title={
          nativeRefreshPending
            ? '연결을 다시 확인하고 있어요'
            : sourceError ?? '원본을 불러오고 있어요'
        }
      />
    );
  }

  const playableProps = {
    ...props,
    headers: resolved.headers,
    initialPositionMs: resumePositionMs,
    onPlaybackError: handlePlaybackError,
    onPlaybackReady: handlePlaybackReady,
    onPositionChange: handlePositionChange,
    uri: resolved.uri,
  };
  return props.kind === 'video' ? (
    <VideoStudyPlayer
      key={`${resolved.uri}|${playbackRevision}`}
      {...playableProps}
    />
  ) : (
    <AudioStudyPlayer
      key={`${resolved.uri}|${playbackRevision}`}
      {...playableProps}
    />
  );
}

function PlayerSourceState({
  description,
  kind,
  title,
}: {
  description: string;
  kind: MaterialKind;
  title: string;
}) {
  const SourceIcon = kind === 'video' ? Film : Volume2;
  return (
    <View style={[styles.container, styles.sourceState]}>
      <View style={styles.sourceStateIcon}>
        <SourceIcon
          {...decorative}
          color={colors.stageMuted}
          size={26}
          strokeWidth={1.7}
        />
      </View>
      <AppText align="center" tone="inverse" variant="bodyStrong">
        {title}
      </AppText>
      <AppText align="center" style={styles.stageMuted} variant="meta">
        {description}
      </AppText>
    </View>
  );
}

async function resolveWebPlaybackSource(
  uri: string,
  headersJson: string,
  refreshSource?: RefreshPrivateMediaSource,
): Promise<{ uri: string; release: () => void }> {
  if (isPersistedWebMediaUri(uri)) {
    return createWebMediaPlaybackUrl(uri);
  }
  const headers = JSON.parse(headersJson) as Record<string, string>;
  if (Object.keys(headers).length) {
    return createAuthenticatedWebMediaUrl({ uri, headers }, refreshSource);
  }
  return { uri, release: () => undefined };
}

function usePlayableMediaUri(
  sourceUri: string,
  sourceHeaders?: Record<string, string>,
  fallbackSource?: StudyPlayerFallbackSource,
  useFallback = false,
): {
  uri: string | null;
  headers?: Record<string, string>;
  error: string | null;
  usingFallback: boolean;
} {
  const fallbackUri = fallbackSource?.uri ?? '';
  const fallbackHeadersJson = JSON.stringify(fallbackSource?.headers ?? {});
  const fallbackRefresh = fallbackSource?.refresh;
  const sourceHeadersJson = JSON.stringify(sourceHeaders ?? {});
  const selectedUri = useFallback && fallbackUri ? fallbackUri : sourceUri;
  const selectedHeadersJson =
    useFallback && fallbackUri ? fallbackHeadersJson : sourceHeadersJson;
  const selectedRefresh =
    useFallback && fallbackUri ? fallbackRefresh : undefined;
  const sourceKey = `${selectedUri}|${selectedHeadersJson}|${
    useFallback ? 'fallback' : `auto:${fallbackUri}|${fallbackHeadersJson}`
  }`;
  const needsResolution =
    Platform.OS === 'web' &&
    (isPersistedWebMediaUri(selectedUri) || selectedHeadersJson !== '{}');
  const [resolution, setResolution] = useState<{
    sourceKey: string;
    uri: string | null;
    error: string | null;
    usingFallback: boolean;
  } | null>(null);

  useEffect(() => {
    if (!needsResolution) return;
    let active = true;
    let release: () => void = () => undefined;
    void resolveWebPlaybackSource(
      selectedUri,
      selectedHeadersJson,
      selectedRefresh,
    )
      .catch(async (primaryError: unknown) => {
        if (useFallback || !fallbackUri) throw primaryError;
        const fallback = await resolveWebPlaybackSource(
          fallbackUri,
          fallbackHeadersJson,
          fallbackRefresh,
        );
        return { ...fallback, usingFallback: true };
      })
      .then((result) => {
        if (!active) {
          result.release();
          return;
        }
        release = result.release;
        setResolution({
          sourceKey,
          uri: result.uri,
          error: null,
          usingFallback: 'usingFallback' in result || useFallback,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setResolution({
          sourceKey,
          uri: null,
          usingFallback: useFallback,
          error:
            error instanceof Error
              ? error.message
              : '보관된 원본을 불러오지 못했어요.',
        });
      });
    return () => {
      active = false;
      release();
    };
  }, [
    fallbackHeadersJson,
    fallbackRefresh,
    fallbackUri,
    needsResolution,
    selectedHeadersJson,
    selectedRefresh,
    selectedUri,
    sourceKey,
    useFallback,
  ]);

  if (!needsResolution) {
    return {
      uri: selectedUri,
      headers:
        Platform.OS === 'web'
          ? undefined
          : (JSON.parse(selectedHeadersJson) as Record<string, string>),
      error: null,
      usingFallback: useFallback,
    };
  }
  if (resolution?.sourceKey !== sourceKey) {
    return { uri: null, error: null, usingFallback: useFallback };
  }
  return {
    uri: resolution.uri,
    error: resolution.error,
    usingFallback: resolution.usingFallback,
  };
}

function AudioStudyPlayer({
  headers,
  uri,
  title,
  durationMs = 0,
  initialPositionMs = 0,
  onPlaybackError,
  onPlaybackReady,
  onPositionChange,
}: StudyPlayerProps) {
  const isDemo = uri.startsWith('mock://');
  const source = useMemo(
    () => (isDemo ? null : { uri, headers, name: title }),
    [headers, isDemo, title, uri],
  );
  const player = useAudioPlayer(source, {
    updateInterval: 250,
    downloadFirst: false,
  });
  const status = useAudioPlayerStatus(player);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoPosition, setDemoPosition] = useState(initialPositionMs / 1000);
  const [rate, setRate] = useState<PlaybackRate>(DEFAULT_RATE);
  const initialSeekDone = useRef(false);

  const duration = isDemo
    ? Math.max(durationMs / 1000, 1)
    : Math.max(status.duration || durationMs / 1000, 1);
  const position = isDemo ? demoPosition : status.currentTime;
  const playing = isDemo ? demoPlaying : status.playing;

  useEffect(() => {
    void setAudioModeAsync({
      allowsRecording: false,
      interruptionMode: 'doNotMix',
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  useEffect(() => {
    if (status.error) {
      onPlaybackError?.('이 기기에서 원본 오디오를 재생하지 못했어요.');
    }
  }, [onPlaybackError, status.error]);

  useEffect(() => {
    if (!isDemo && status.isLoaded && !status.error) {
      onPlaybackReady?.();
    }
  }, [isDemo, onPlaybackReady, status.error, status.isLoaded]);

  useEffect(() => {
    if (isDemo || !status.isLoaded) return;
    player.setActiveForLockScreen(true, { title, artist: 'PREMIND' });
    return () => player.clearLockScreenControls();
  }, [isDemo, player, status.isLoaded, title]);

  useEffect(() => {
    initialSeekDone.current = false;
  }, [uri]);

  useEffect(() => {
    if (
      isDemo ||
      !status.isLoaded ||
      initialSeekDone.current ||
      initialPositionMs <= 0
    ) {
      return;
    }
    initialSeekDone.current = true;
    void player.seekTo(initialPositionMs / 1000);
  }, [initialPositionMs, isDemo, player, status.isLoaded]);

  useEffect(() => {
    if (!isDemo || !demoPlaying) return;
    const timer = setInterval(() => {
      setDemoPosition((current) => {
        const next = Math.min(duration, current + 0.25 * rate);
        if (next >= duration) setDemoPlaying(false);
        return next;
      });
    }, 250);
    return () => clearInterval(timer);
  }, [demoPlaying, duration, isDemo, rate]);

  useEffect(() => {
    if (!isDemo && (!status.isLoaded || status.error)) return;
    onPositionChange?.(Math.round(position * 1000));
  }, [isDemo, onPositionChange, position, status.error, status.isLoaded]);

  const seekTo = (seconds: number) => {
    const next = clampPosition(seconds, duration);
    if (isDemo) setDemoPosition(next);
    else void player.seekTo(next);
  };

  const togglePlayback = () => {
    if (isDemo) {
      if (demoPosition >= duration) setDemoPosition(0);
      setDemoPlaying((current) => !current);
      return;
    }
    if (status.playing) player.pause();
    else player.play();
  };

  const selectRate = (nextRate: PlaybackRate) => {
    setRate(nextRate);
    if (!isDemo) player.setPlaybackRate(nextRate, 'medium');
  };

  const changeRate = () => selectRate(nextPlaybackRate(rate));

  return (
    <PlayerChrome
      duration={duration}
      kind="audio"
      onChangeRate={changeRate}
      onSelectRate={selectRate}
      onSeek={seekTo}
      onTogglePlayback={togglePlayback}
      playing={playing}
      position={position}
      rate={rate}
      sourceLabel={
        isDemo
          ? '예시 오디오'
          : status.isBuffering
            ? '오디오 불러오는 중'
            : '원본 오디오'
      }
      title={title}
    />
  );
}

function VideoStudyPlayer({
  headers,
  uri,
  title,
  durationMs = 0,
  initialPositionMs = 0,
  onPlaybackError,
  onPlaybackReady,
  onPositionChange,
}: StudyPlayerProps) {
  const isDemo = uri.startsWith('mock://');
  const source = useMemo(
    () =>
      isDemo
        ? null
        : {
            uri,
            headers,
            metadata: { title, artist: 'PREMIND' },
          },
    [headers, isDemo, title, uri],
  );
  const player = useVideoPlayer(source, (instance) => {
    instance.audioMixingMode = 'doNotMix';
    instance.preservesPitch = true;
    instance.timeUpdateEventInterval = 0.25;
    if (!isDemo) {
      instance.showNowPlayingNotification = true;
      instance.staysActiveInBackground = true;
    }
  });
  const playingEvent = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });
  const statusEvent = useEvent(player, 'statusChange', {
    status: player.status,
  });
  const timeEvent = useEvent(player, 'timeUpdate', {
    bufferedPosition: player.bufferedPosition,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    currentTime: player.currentTime,
  });
  const videoRef = useRef<VideoView>(null);
  const initialSeekDone = useRef(false);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoPosition, setDemoPosition] = useState(initialPositionMs / 1000);
  const [rate, setRate] = useState<PlaybackRate>(DEFAULT_RATE);

  useEffect(() => {
    if (statusEvent.status === 'error') {
      onPlaybackError?.('이 기기에서 원본 영상을 재생하지 못했어요.');
    }
  }, [onPlaybackError, statusEvent.status]);

  useEffect(() => {
    if (!isDemo && statusEvent.status === 'readyToPlay') {
      onPlaybackReady?.();
    }
  }, [isDemo, onPlaybackReady, statusEvent.status]);

  const duration = isDemo
    ? Math.max(durationMs / 1000, 1)
    : Math.max(player.duration || durationMs / 1000, 1);
  const position = isDemo ? demoPosition : timeEvent.currentTime;
  const playing = isDemo ? demoPlaying : playingEvent.isPlaying;

  useEffect(() => {
    initialSeekDone.current = false;
  }, [uri]);

  useEffect(() => {
    if (
      isDemo ||
      statusEvent.status !== 'readyToPlay' ||
      initialSeekDone.current ||
      initialPositionMs <= 0
    ) {
      return;
    }
    initialSeekDone.current = true;
    player.seekBy(initialPositionMs / 1000 - player.currentTime);
  }, [initialPositionMs, isDemo, player, statusEvent.status]);

  useEffect(() => {
    if (!isDemo || !demoPlaying) return;
    const timer = setInterval(() => {
      setDemoPosition((current) => {
        const next = Math.min(duration, current + 0.25 * rate);
        if (next >= duration) setDemoPlaying(false);
        return next;
      });
    }, 250);
    return () => clearInterval(timer);
  }, [demoPlaying, duration, isDemo, rate]);

  useEffect(() => {
    if (!isDemo && statusEvent.status !== 'readyToPlay') return;
    onPositionChange?.(Math.round(position * 1000));
  }, [isDemo, onPositionChange, position, statusEvent.status]);

  const seekTo = (seconds: number) => {
    const next = clampPosition(seconds, duration);
    if (isDemo) setDemoPosition(next);
    else player.seekBy(next - player.currentTime);
  };

  const togglePlayback = () => {
    if (isDemo) {
      if (demoPosition >= duration) setDemoPosition(0);
      setDemoPlaying((current) => !current);
      return;
    }
    if (playingEvent.isPlaying) player.pause();
    else if (player.currentTime >= duration) player.replay();
    else player.play();
  };

  const selectRate = (nextRate: PlaybackRate) => {
    setRate(nextRate);
    // expo-video exposes playback rate as a mutable native player property.
    // eslint-disable-next-line react-hooks/immutability
    if (!isDemo) player.playbackRate = nextRate;
  };

  const changeRate = () => selectRate(nextPlaybackRate(rate));

  const sourceLabel = isDemo
    ? '예시 영상'
    : statusEvent.status === 'loading' || statusEvent.status === 'idle'
      ? '영상 불러오는 중'
      : statusEvent.status === 'error'
        ? '영상을 불러오지 못했어요'
        : '원본 영상';

  return (
    <PlayerChrome
      duration={duration}
      kind="video"
      media={
        <View style={styles.videoFrame}>
          {isDemo ? (
            <View
              accessibilityLabel={`${title} 예시 영상`}
              accessibilityRole="image"
              style={styles.demoVideo}
            >
              <Film
                {...decorative}
                color={colors.stageMuted}
                size={30}
                strokeWidth={1.6}
              />
              <AppText style={styles.stageMuted} variant="meta">
                예시 영상
              </AppText>
            </View>
          ) : (
            <>
              <VideoView
                accessibilityLabel={`${title} 영상`}
                accessibilityRole="image"
                contentFit="contain"
                fullscreenOptions={{ enable: true }}
                nativeControls={false}
                player={player}
                ref={videoRef}
                style={styles.video}
              />
              <Pressable
                accessibilityLabel="전체 화면"
                accessibilityRole="button"
                hitSlop={spacing.sm}
                onPress={() => void videoRef.current?.enterFullscreen()}
                style={({ pressed }) => [
                  styles.fullscreenButton,
                  pressed ? styles.controlPressed : null,
                ]}
              >
                <Maximize2
                  {...decorative}
                  color={colors.stageText}
                  size={18}
                  strokeWidth={2}
                />
              </Pressable>
            </>
          )}
        </View>
      }
      onChangeRate={changeRate}
      onSelectRate={selectRate}
      onSeek={seekTo}
      onTogglePlayback={togglePlayback}
      playing={playing}
      position={position}
      rate={rate}
      sourceLabel={sourceLabel}
      title={title}
    />
  );
}

function PlayerChrome({
  title,
  kind,
  sourceLabel,
  duration,
  position,
  playing,
  rate,
  media,
  onChangeRate,
  onSelectRate,
  onSeek,
  onTogglePlayback,
}: PlayerChromeProps) {
  const [trackWidth, setTrackWidth] = useState(1);
  const [rateMenuOpen, setRateMenuOpen] = useState(false);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safePosition = Number.isFinite(position)
    ? Math.min(safeDuration, Math.max(0, position))
    : 0;
  const progress = safeDuration > 0 ? safePosition / safeDuration : 0;
  const durationRounded = Math.max(1, Math.round(safeDuration));
  const positionRounded = Math.min(
    durationRounded,
    Math.max(0, Math.round(safePosition)),
  );
  const SourceIcon = kind === 'video' ? Film : Volume2;

  const handleTrackPress = (event: GestureResponderEvent) => {
    const nativeEvent = event.nativeEvent as typeof event.nativeEvent & {
      clientX?: number;
      offsetX?: number;
      pageX?: number;
    };
    const target = event.currentTarget as unknown as {
      getBoundingClientRect?: () => { left: number; width: number };
      ownerDocument?: { defaultView?: { scrollX?: number } | null };
    } | null;
    const bounds = target?.getBoundingClientRect?.();
    let measuredWidth = trackWidth;
    let locationX = nativeEvent.locationX;

    if (bounds && Number.isFinite(bounds.width) && bounds.width > 0) {
      measuredWidth = bounds.width;
      if (Number.isFinite(nativeEvent.clientX)) {
        locationX = nativeEvent.clientX! - bounds.left;
      } else if (Number.isFinite(nativeEvent.pageX)) {
        const scrollX = target?.ownerDocument?.defaultView?.scrollX ?? 0;
        locationX = nativeEvent.pageX! - (bounds.left + scrollX);
      }
    }

    if (!Number.isFinite(locationX) && Number.isFinite(nativeEvent.offsetX)) {
      locationX = nativeEvent.offsetX!;
    }

    if (
      !Number.isFinite(locationX) ||
      !Number.isFinite(measuredWidth) ||
      measuredWidth <= 0 ||
      safeDuration <= 0
    ) {
      return;
    }

    onSeek(
      (Math.max(0, Math.min(measuredWidth, locationX)) / measuredWidth) *
        safeDuration,
    );
  };

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') {
      onSeek(position + ACCESSIBLE_SEEK_SECONDS);
    }
    if (event.nativeEvent.actionName === 'decrement') {
      onSeek(position - ACCESSIBLE_SEEK_SECONDS);
    }
  };

  const handleRateAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') onChangeRate();
  };

  const pickRate = (nextRate: PlaybackRate) => {
    onSelectRate(nextRate);
    setRateMenuOpen(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.sourceIcon}>
          <SourceIcon
            {...decorative}
            color={colors.stageText}
            size={16}
            strokeWidth={2}
          />
        </View>
        <View style={styles.titleCopy}>
          {/* The screen's header already carries the title; the card only
              says what is playing. The title stays on the a11y label. */}
          <AppText
            accessibilityLabel={`${title}, ${sourceLabel}`}
            numberOfLines={1}
            style={styles.stageMuted}
            variant="meta"
          >
            {sourceLabel}
          </AppText>
        </View>
      </View>

      {media}

      <Pressable
        aria-valuemax={durationRounded}
        aria-valuemin={0}
        aria-valuenow={positionRounded}
        aria-valuetext={`${formatDuration(safePosition)} / ${formatDuration(safeDuration)}`}
        accessibilityActions={[
          { name: 'decrement', label: '15초 뒤로' },
          { name: 'increment', label: '15초 앞으로' },
        ]}
        accessibilityHint="위아래로 쓸어 15초씩 옮기거나, 원하는 위치를 눌러요."
        accessibilityLabel="재생 위치"
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: 0,
          max: durationRounded,
          now: positionRounded,
          text: `${formatDuration(safePosition)} / ${formatDuration(safeDuration)}`,
        }}
        onAccessibilityAction={handleAccessibilityAction}
        onLayout={(event: LayoutChangeEvent) =>
          setTrackWidth(event.nativeEvent.layout.width)
        }
        onPress={handleTrackPress}
        style={styles.trackTouch}
      >
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
        </View>
      </Pressable>
      <View style={styles.timeRow}>
        <AppText style={styles.stageMuted} tabular variant="meta">
          {formatDuration(safePosition)}
        </AppText>
        <AppText style={styles.stageMuted} tabular variant="meta">
          {formatDuration(safeDuration)}
        </AppText>
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityActions={[{ name: 'increment', label: '다음 재생 속도' }]}
          accessibilityHint="재생 속도 목록을 열어요."
          accessibilityLabel={`재생 속도 ${rate}배`}
          accessibilityRole="button"
          accessibilityState={{ expanded: rateMenuOpen }}
          hitSlop={spacing.sm}
          onAccessibilityAction={handleRateAccessibilityAction}
          onPress={() => setRateMenuOpen((open) => !open)}
          style={({ pressed }) => [
            styles.rateButton,
            rateMenuOpen ? styles.rateButtonOpen : null,
            pressed ? styles.controlPressed : null,
          ]}
        >
          <AppText
            style={rateMenuOpen ? styles.rateLabelOpen : null}
            tabular
            tone="inverse"
            variant="badge"
          >
            {formatRate(rate)}
          </AppText>
        </Pressable>
        <View style={styles.controlCluster}>
          <Pressable
            accessibilityLabel="15초 뒤로"
            accessibilityRole="button"
            onPress={() => onSeek(safePosition - 15)}
            style={({ pressed }) => [
              styles.seekButton,
              pressed ? styles.controlPressed : null,
            ]}
          >
            <RotateCcw
              {...decorative}
              color={colors.stageText}
              size={20}
              strokeWidth={2}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={playing ? '일시정지' : '재생'}
            accessibilityRole="button"
            onPress={onTogglePlayback}
            style={({ pressed }) => [
              styles.playButton,
              pressed ? styles.controlPressed : null,
            ]}
          >
            {playing ? (
              <Pause
                {...decorative}
                color={colors.text}
                fill={colors.text}
                size={22}
              />
            ) : (
              <Play
                {...decorative}
                color={colors.text}
                fill={colors.text}
                size={22}
                style={styles.playGlyph}
              />
            )}
          </Pressable>
          <Pressable
            accessibilityLabel="15초 앞으로"
            accessibilityRole="button"
            onPress={() => onSeek(safePosition + 15)}
            style={({ pressed }) => [
              styles.seekButton,
              pressed ? styles.controlPressed : null,
            ]}
          >
            <RotateCw
              {...decorative}
              color={colors.stageText}
              size={20}
              strokeWidth={2}
            />
          </Pressable>
        </View>
        <View {...decorative} style={styles.rateSpacer} />
      </View>

      {rateMenuOpen ? (
        <View accessibilityLabel="재생 속도 선택" style={styles.rateMenu}>
          {PLAYBACK_RATES.map((option) => {
            const selected = option === rate;
            return (
              <Pressable
                accessibilityLabel={`${option}배속`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option}
                onPress={() => pickRate(option)}
                style={({ pressed }) => [
                  styles.rateOption,
                  selected ? styles.rateOptionSelected : null,
                  pressed ? styles.controlPressed : null,
                ]}
              >
                <AppText
                  style={selected ? styles.rateOptionLabelSelected : styles.stageMuted}
                  tabular
                  variant="label"
                >
                  {formatRate(option)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function clampPosition(seconds: number, duration: number) {
  return Math.min(duration, Math.max(0, seconds));
}

const CONTROL_SIZE = sizes.minimumTouchTarget;
const PLAY_SIZE = 56;
const RATE_WIDTH = 52;
/** The loading / error card keeps the height of an audio player so the page does not jump. */
const SOURCE_STATE_HEIGHT = 200;

/**
 * A flat dark player card. The stage is the one dark surface in the app, so
 * the controls are white on ink rather than accent: playback is not a "live"
 * state, it is the thing the screen is for.
 */
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.stage,
    borderRadius: radii.card,
    gap: spacing.md,
    overflow: 'hidden',
    padding: spacing.gutter,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  sourceIcon: {
    alignItems: 'center',
    backgroundColor: colors.stageRaised,
    borderRadius: radii.full,
    height: sizes.buttonSmall,
    justifyContent: 'center',
    width: sizes.buttonSmall,
  },
  titleCopy: { flex: 1, minWidth: 0 },
  sourceState: {
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: SOURCE_STATE_HEIGHT,
    paddingHorizontal: spacing.gutter,
  },
  sourceStateIcon: {
    alignItems: 'center',
    backgroundColor: colors.stageRaised,
    borderRadius: radii.full,
    height: PLAY_SIZE,
    justifyContent: 'center',
    marginBottom: spacing.xs,
    width: PLAY_SIZE,
  },
  stageMuted: { color: colors.stageMuted },
  videoFrame: {
    aspectRatio: 16 / 9,
    backgroundColor: palette.stage950,
    borderRadius: radii.input,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
  demoVideo: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  fullscreenButton: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    borderRadius: radii.full,
    height: sizes.iconButton,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    width: sizes.iconButton,
  },
  trackTouch: {
    justifyContent: 'center',
    minHeight: sizes.minimumTouchTarget,
  },
  track: {
    backgroundColor: colors.stageBorder,
    borderRadius: radii.full,
    height: 4,
    overflow: 'hidden',
  },
  trackFill: {
    backgroundColor: colors.stageText,
    borderRadius: radii.full,
    height: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.sm,
  },
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlCluster: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.gutter,
  },
  seekButton: {
    alignItems: 'center',
    backgroundColor: colors.stageRaised,
    borderRadius: radii.full,
    height: CONTROL_SIZE,
    justifyContent: 'center',
    width: CONTROL_SIZE,
  },
  playButton: {
    alignItems: 'center',
    backgroundColor: colors.textInverse,
    borderRadius: radii.full,
    height: PLAY_SIZE,
    justifyContent: 'center',
    width: PLAY_SIZE,
  },
  playGlyph: {
    marginLeft: spacing.xxs,
  },
  rateButton: {
    alignItems: 'center',
    borderColor: colors.stageBorder,
    borderRadius: radii.chip,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    minWidth: RATE_WIDTH,
    paddingHorizontal: spacing.md,
  },
  rateButtonOpen: {
    backgroundColor: colors.textInverse,
    borderColor: colors.textInverse,
  },
  rateLabelOpen: { color: colors.text },
  rateSpacer: { width: RATE_WIDTH },
  rateMenu: {
    backgroundColor: colors.stageRaised,
    borderRadius: radii.input,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  rateOption: {
    alignItems: 'center',
    borderRadius: radii.input - spacing.xxs,
    flex: 1,
    justifyContent: 'center',
    minHeight: sizes.buttonSmall,
  },
  rateOptionSelected: {
    backgroundColor: colors.textInverse,
  },
  rateOptionLabelSelected: { color: colors.text },
  controlPressed: { opacity: 0.72 },
});
