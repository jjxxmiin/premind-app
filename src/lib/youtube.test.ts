import {
  leavesYouTubeEmbed,
  parseYouTubeId,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  YOUTUBE_EMBEDDER_ORIGIN,
  YOUTUBE_MESSAGE_ORIGIN,
} from './youtube';

describe('parseYouTubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=kvAa-76IWHc', 'kvAa-76IWHc'],
    ['https://youtube.com/watch?v=kvAa-76IWHc&t=42s', 'kvAa-76IWHc'],
    ['https://m.youtube.com/watch?v=kvAa-76IWHc', 'kvAa-76IWHc'],
    ['https://youtu.be/kvAa-76IWHc', 'kvAa-76IWHc'],
    ['https://youtu.be/kvAa-76IWHc?si=abc', 'kvAa-76IWHc'],
    ['https://www.youtube.com/shorts/kvAa-76IWHc', 'kvAa-76IWHc'],
    ['https://www.youtube.com/live/kvAa-76IWHc', 'kvAa-76IWHc'],
    ['https://www.youtube.com/embed/kvAa-76IWHc', 'kvAa-76IWHc'],
    ['youtube.com/watch?v=kvAa-76IWHc', 'kvAa-76IWHc'],
    ['  https://www.youtube.com/watch?v=kvAa-76IWHc  ', 'kvAa-76IWHc'],
  ])('reads the id from %s', (url, expected) => {
    expect(parseYouTubeId(url)).toBe(expected);
  });

  it.each([
    '',
    'not a url',
    'https://vimeo.com/123456',
    'https://www.youtube.com/',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=toolongtoolongtoolong',
    'https://evil.com/watch?v=kvAa-76IWHc',
    'https://youtube.com.evil.com/watch?v=kvAa-76IWHc',
  ])('rejects %s', (url) => {
    expect(parseYouTubeId(url)).toBeNull();
  });
});

describe('url builders', () => {
  it('produce canonical, thumbnail and embed urls', () => {
    expect(youtubeWatchUrl('kvAa-76IWHc')).toBe(
      'https://www.youtube.com/watch?v=kvAa-76IWHc',
    );
    expect(youtubeThumbnailUrl('kvAa-76IWHc')).toBe(
      'https://i.ytimg.com/vi/kvAa-76IWHc/hqdefault.jpg',
    );
    const embed = new URL(youtubeEmbedUrl('kvAa-76IWHc', 61.9));
    expect(embed.pathname).toBe('/embed/kvAa-76IWHc');
    expect(embed.searchParams.get('enablejsapi')).toBe('1');
    expect(embed.searchParams.get('start')).toBe('61');
  });

  it('never emits a negative start offset', () => {
    expect(new URL(youtubeEmbedUrl('kvAa-76IWHc', -5)).searchParams.get('start')).toBe('0');
  });

  it('omits origin unless one is asked for', () => {
    expect(new URL(youtubeEmbedUrl('kvAa-76IWHc')).searchParams.has('origin')).toBe(false);
    const url = new URL(
      youtubeEmbedUrl('kvAa-76IWHc', 0, { origin: YOUTUBE_MESSAGE_ORIGIN }),
    );
    expect(url.searchParams.get('origin')).toBe('https://www.youtube.com');
  });
});

describe('embed origins', () => {
  it('addresses the player messages to youtube, not to the app', () => {
    // The native player loads the embed as its top-level document, so the
    // embed's `window.parent` is the embed. Only youtube.com is delivered.
    expect(YOUTUBE_MESSAGE_ORIGIN).toBe('https://www.youtube.com');
  });

  it('claims a real site as the embedder, and never youtube itself', () => {
    // No embedder at all is error 153; youtube.com embedding itself is 152.
    expect(YOUTUBE_EMBEDDER_ORIGIN).toMatch(/^https:\/\//);
    expect(YOUTUBE_EMBEDDER_ORIGIN).not.toContain('youtube.com');
  });
});

describe('leavesYouTubeEmbed', () => {
  it.each([
    'https://www.youtube.com/watch?v=kvAa-76IWHc',
    'https://m.youtube.com/watch?v=kvAa-76IWHc',
    'https://www.youtube.com/channel/UC123',
    'https://youtu.be/kvAa-76IWHc',
    'https://www.youtube.com/',
  ])('sends %s out to the browser', (url) => {
    expect(leavesYouTubeEmbed(url)).toBe(true);
  });

  it.each([
    'https://www.youtube.com/embed/kvAa-76IWHc?enablejsapi=1',
    'https://www.youtube-nocookie.com/embed/kvAa-76IWHc',
    // Not YouTube at all: the player is not the place to police it.
    'https://consent.google.com/m',
    'https://accounts.google.com/signin',
    'about:blank',
    'not a url',
  ])('keeps %s inside the player', (url) => {
    expect(leavesYouTubeEmbed(url)).toBe(false);
  });

  it('is not fooled by a lookalike host', () => {
    expect(leavesYouTubeEmbed('https://youtube.com.evil.com/watch?v=x')).toBe(false);
    expect(leavesYouTubeEmbed('https://evil-youtube.com/watch?v=x')).toBe(false);
  });
});
