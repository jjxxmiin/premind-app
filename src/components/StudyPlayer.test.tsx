import { render, waitFor } from '@testing-library/react-native';

import { StudyPlayer } from './StudyPlayer';

const mockSeekTo = jest.fn(async () => undefined);
const mockRejectedAuthorizations = new Set(['Bearer expired']);
const mockPlayers = new Map<
  string,
  {
    clearLockScreenControls: jest.Mock;
    pause: jest.Mock;
    play: jest.Mock;
    seekTo: typeof mockSeekTo;
    setActiveForLockScreen: jest.Mock;
    setPlaybackRate: jest.Mock;
    source: { uri: string; headers?: Record<string, string> } | null;
  }
>();

jest.mock('expo', () => ({
  useEvent: jest.fn((_target, _event, initial) => initial),
}));

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioPlayer: jest.fn(
    (source: { uri: string; headers?: Record<string, string> } | null) => {
      const key = `${source?.uri ?? 'demo'}|${source?.headers?.Authorization ?? ''}`;
      let player = mockPlayers.get(key);
      if (!player) {
        player = {
          clearLockScreenControls: jest.fn(),
          pause: jest.fn(),
          play: jest.fn(),
          seekTo: mockSeekTo,
          setActiveForLockScreen: jest.fn(),
          setPlaybackRate: jest.fn(),
          source,
        };
        mockPlayers.set(key, player);
      }
      return player;
    },
  ),
  useAudioPlayerStatus: jest.fn(
    (player: { source: { uri: string; headers?: Record<string, string> } }) => {
      const authorization = player.source?.headers?.Authorization;
      const rejected =
        player.source?.uri === 'file:///recording.m4a' ||
        mockRejectedAuthorizations.has(authorization ?? '');
      return {
        // Keep the mock clock at the lecture's active position. Real players
        // report the seeked position after a refreshed source becomes ready.
        currentTime: 37,
        duration: 120,
        error: rejected ? '401' : null,
        isBuffering: false,
        isLoaded: !rejected,
        playing: false,
      };
    },
  ),
}));

jest.mock('expo-video', () => ({
  VideoView: 'VideoView',
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
  Film: 'FilmIcon',
  Maximize2: 'MaximizeIcon',
  Pause: 'PauseIcon',
  Play: 'PlayIcon',
  RotateCcw: 'RotateCcwIcon',
  RotateCw: 'RotateCwIcon',
  Volume2: 'VolumeIcon',
}));

describe('StudyPlayer native authenticated fallback', () => {
  beforeEach(() => {
    mockPlayers.clear();
    mockSeekTo.mockClear();
    mockRejectedAuthorizations.clear();
    mockRejectedAuthorizations.add('Bearer expired');
  });

  it('refreshes each expired bearer token once and resumes at the prior position', async () => {
    const refresh = jest
      .fn()
      .mockResolvedValueOnce({
        uri: 'https://api.premind.test/recordings/recording-1/media',
        headers: { Authorization: 'Bearer fresh' },
      })
      .mockResolvedValueOnce({
        uri: 'https://api.premind.test/recordings/recording-1/media',
        headers: { Authorization: 'Bearer fresher' },
      });

    const player = await render(
      <StudyPlayer
        durationMs={120_000}
        fallbackSource={{
          uri: 'https://api.premind.test/recordings/recording-1/media',
          headers: { Authorization: 'Bearer expired' },
          refresh,
        }}
        initialPositionMs={37_000}
        kind="audio"
        title="인증 갱신 강의"
        uri="file:///recording.m4a"
      />,
    );

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(refresh).toHaveBeenCalledWith({
      uri: 'https://api.premind.test/recordings/recording-1/media',
      headers: { Authorization: 'Bearer expired' },
    });
    await waitFor(() => expect(mockSeekTo).toHaveBeenCalledWith(37));
    expect(refresh).toHaveBeenCalledTimes(1);

    // The refreshed source loaded successfully, then its distinct token later
    // expired during the same long lecture. It gets one new bounded retry.
    mockRejectedAuthorizations.add('Bearer fresh');
    await player.rerender(
      <StudyPlayer
        durationMs={120_000}
        fallbackSource={{
          uri: 'https://api.premind.test/recordings/recording-1/media',
          headers: { Authorization: 'Bearer expired' },
          refresh,
        }}
        initialPositionMs={37_000}
        kind="audio"
        title="인증 갱신 강의"
        uri="file:///recording.m4a"
      />,
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    expect(refresh).toHaveBeenLastCalledWith({
      uri: 'https://api.premind.test/recordings/recording-1/media',
      headers: { Authorization: 'Bearer fresh' },
    });
    await waitFor(() => expect(mockSeekTo).toHaveBeenCalledTimes(2));
  });
});
