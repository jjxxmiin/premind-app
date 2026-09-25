/**
 * What went wrong when a YouTube embed refuses to play, in words.
 *
 * The player used to say "네트워크를 확인해 주세요" for everything, which is
 * wrong most of the time: the commonest failure by far is a video whose owner
 * disabled embedding, and no amount of checking the network fixes that. The
 * reader needs to know whether to retry, or to watch it on YouTube and come
 * back to the 대본, which is still there either way.
 *
 * Codes are YouTube's own IFrame API error values.
 */

import { tr } from '@/lib/i18n';

export type EmbedFailure =
  /** The IFrame API script never loaded: genuinely a network problem. */
  | 'offline'
  /** 101 / 150: the owner does not allow this video to play inside apps. */
  | 'embed-blocked'
  /** 100: removed, private, or the id is wrong. */
  | 'unavailable'
  /** 2: the id we sent is malformed. Ours to fix, not the reader's. */
  | 'bad-id'
  /** 5: the player itself failed. Retrying sometimes works. */
  | 'player-error'
  /**
   * 152 / 153: YouTube refused to configure the embed for this app. Not the
   * owner blocking it and not a missing video, so the copy must not say either.
   */
  | 'embed-refused'
  /**
   * The embed page loaded but never became a working player: YouTube's own
   * error page is showing inside the WebView, or nothing answered at all. No
   * error code exists for this, so it is detected by a timeout.
   */
  | 'no-player';

export interface EmbedFailureCopy {
  message: string;
  /** Whether opening it on YouTube is the useful next step. */
  offerYouTube: boolean;
  /** Whether trying again could plausibly help. */
  offerRetry: boolean;
}

export function embedFailureOf(code: number | undefined): EmbedFailure {
  switch (code) {
    case 101:
    case 150:
      return 'embed-blocked';
    case 100:
      return 'unavailable';
    case 152:
    case 153:
      return 'embed-refused';
    case 2:
      return 'bad-id';
    case 5:
      return 'player-error';
    case -1:
      return 'offline';
    default:
      return 'player-error';
  }
}

/**
 * The embed can also fail without ever reaching the IFrame API: the WebView
 * gets an HTTP error for the embed page itself. The status is all we know.
 */
export function embedFailureOfStatus(status: number): EmbedFailure {
  if (status === 401 || status === 403) return 'embed-blocked';
  if (status === 404 || status === 410) return 'unavailable';
  return 'no-player';
}

export function embedFailureCopy(failure: EmbedFailure): EmbedFailureCopy {
  switch (failure) {
    case 'embed-blocked':
      return {
        message:
          tr('이 영상은 다른 앱에서 재생할 수 없게 설정돼 있어요. 유튜브에서 보고 돌아오세요. 대본과 요약은 그대로 볼 수 있어요.'),
        offerYouTube: true,
        offerRetry: false,
      };
    case 'unavailable':
      return {
        message:
          tr('영상을 찾을 수 없어요. 삭제됐거나 비공개로 바뀌었을 수 있어요. 대본과 요약은 그대로 볼 수 있어요.'),
        offerYouTube: true,
        offerRetry: false,
      };
    case 'bad-id':
      return {
        message: tr('영상 주소를 읽지 못했어요. 링크를 다시 올려 주세요.'),
        offerYouTube: false,
        offerRetry: false,
      };
    case 'offline':
      return {
        message: tr('영상을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.'),
        offerYouTube: true,
        offerRetry: true,
      };
    case 'player-error':
      return {
        message: tr('재생하다가 멈췄어요. 다시 시도하거나 유튜브에서 보세요.'),
        offerYouTube: true,
        offerRetry: true,
      };
    case 'embed-refused':
      return {
        message:
          tr('이 영상을 앱 안에서 열지 못했어요. 다시 시도하거나 유튜브에서 보세요. 대본과 요약은 그대로 볼 수 있어요.'),
        offerYouTube: true,
        offerRetry: true,
      };
    case 'no-player':
      return {
        message:
          tr('영상이 열리지 않아요. 다시 시도하거나 유튜브에서 보세요. 대본과 요약은 그대로 볼 수 있어요.'),
        offerYouTube: true,
        offerRetry: true,
      };
  }
}
