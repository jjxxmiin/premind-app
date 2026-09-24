/**
 * YouTube link helpers shared by the import UI and the player.
 *
 * Mirrors the server's `parse_video_id` (premind-recorder-api,
 * app/recordings/youtube.py) so the app can reject a non-YouTube URL before
 * a round trip, while the server stays the authority.
 */

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

/** The 11-character video id from any common YouTube URL shape, or null. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;

  let candidate: string | null = null;
  if (host.endsWith('youtu.be')) {
    candidate = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else {
    const parts = url.pathname.split('/').filter(Boolean);
    const first = parts[0];
    if (parts.length > 1 && first && ['shorts', 'live', 'embed', 'v'].includes(first)) {
      candidate = parts[1] ?? null;
    } else {
      candidate = url.searchParams.get('v');
    }
  }
  return candidate && ID_PATTERN.test(candidate) ? candidate : null;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * The site the native player claims to be embedded in.
 *
 * The WebView loads the embed page as its top-level document, so there is no
 * embedding page and therefore no `Referer`. YouTube refuses to configure an
 * embed with no embedder at all — it answers error 153, "동영상 플레이어 구성
 * 오류" — so the WebView sends this as the `Referer` of that first request.
 * It has to be the app's own site: it is what a video owner sees if they
 * restrict which domains may embed them.
 */
export const YOUTUBE_EMBEDDER_ORIGIN = 'https://premind.co.kr';

/**
 * The `origin` the embed addresses its IFrame API messages to.
 *
 * The embed posts to `window.parent`. When the embed page *is* the top-level
 * document, `window.parent` is the embed itself, whose origin is youtube.com —
 * so youtube.com is the only target origin whose messages are actually
 * delivered. Naming the app's own origin here silently drops every message.
 */
export const YOUTUBE_MESSAGE_ORIGIN = 'https://www.youtube.com';

export interface YouTubeEmbedOptions {
  /** The embed's `origin` parameter. See `YOUTUBE_MESSAGE_ORIGIN`. */
  origin?: string;
}

/** The embed URL the in-app player loads; `start` is in seconds. */
export function youtubeEmbedUrl(
  videoId: string,
  start = 0,
  options: YouTubeEmbedOptions = {},
): string {
  const params = new URLSearchParams({
    enablejsapi: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    start: String(Math.max(0, Math.floor(start))),
  });
  if (options.origin) params.set('origin', options.origin);
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

const EMBED_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/;

/**
 * Whether a WebView navigation would carry the player off the embed and onto
 * the YouTube site — tapping the watermark or the title does exactly that, and
 * the full site inside a 16:9 box is not a thing anyone wants. Anything that is
 * not YouTube (a consent page, an ad click) is left alone.
 */
export function leavesYouTubeEmbed(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!EMBED_HOSTS.test(parsed.hostname.toLowerCase())) return false;
  return !parsed.pathname.startsWith('/embed/');
}
