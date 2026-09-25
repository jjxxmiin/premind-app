/**
 * Warning the learner before an upload that will cost them money.
 *
 * There used to be a "Wi-Fi에서만 올리기" switch in MY. A switch is the wrong
 * shape for this: it is set once, in a screen nobody visits, and then either
 * silently blocks an upload the learner wanted or silently allows one they
 * did not. The decision belongs at the moment of the upload, where the
 * learner knows which file it is and how big it is, so the switch is gone and
 * this warning takes its place.
 */

import { formatBytes } from '@/lib/format';
import { tr } from '@/lib/i18n';

/** What the phone is connected through, as far as the warning cares. */
export type ConnectionKind = 'wifi' | 'cellular' | 'unknown' | 'offline';

/** What `NetInfo.fetch()` gives us, narrowed to the parts we read. */
export interface ConnectionState {
  type?: string | null;
  isConnected?: boolean | null;
}

export function connectionKindOf(state: ConnectionState | null | undefined): ConnectionKind {
  if (!state) return 'unknown';
  if (state.isConnected === false || state.type === 'none') return 'offline';
  if (state.type === 'wifi' || state.type === 'ethernet') return 'wifi';
  if (state.type === 'cellular') return 'cellular';
  return 'unknown';
}

export interface MeteredUploadWarning {
  title: string;
  description: string;
}

/**
 * The warning to show, or `null` to upload without asking.
 *
 * Only a cellular connection is charged by the byte, so only cellular asks.
 * Offline says nothing: the original is kept on the phone and the queue
 * resumes on its own, so there is no bill and no decision to make. An unknown
 * connection says nothing either, because a warning that fires on Wi-Fi is a
 * warning people learn to tap through.
 */
export function meteredUploadWarning(
  kind: ConnectionKind,
  sizeBytes?: number,
): MeteredUploadWarning | null {
  if (kind !== 'cellular') return null;
  const size = sizeBytes && sizeBytes > 0 ? formatBytes(sizeBytes) : null;
  return {
    title: tr('Wi-Fi가 아니에요'),
    description: size
      ? tr('지금 올리면 이동통신 데이터로 {size}를 보내요. 요금이 나올 수 있어요.', { size })
      : tr('지금 올리면 이동통신 데이터로 보내요. 요금이 나올 수 있어요.'),
  };
}
