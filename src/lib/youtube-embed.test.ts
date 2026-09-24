import {
  embedFailureCopy,
  embedFailureOf,
  embedFailureOfStatus,
} from './youtube-embed';

describe('embedFailureOf', () => {
  it('reads the owner blocking embedding, the commonest failure', () => {
    expect(embedFailureOf(101)).toBe('embed-blocked');
    expect(embedFailureOf(150)).toBe('embed-blocked');
  });

  it('tells a missing video from a blocked one', () => {
    expect(embedFailureOf(100)).toBe('unavailable');
  });

  it('reads our own bad id as ours', () => {
    expect(embedFailureOf(2)).toBe('bad-id');
  });

  it('treats a script that never loaded as offline', () => {
    expect(embedFailureOf(-1)).toBe('offline');
  });

  it('tells a refused embed configuration from an owner who blocked it', () => {
    // 153 is the embed loaded with no embedder; 152 is youtube embedding
    // itself. Neither is the owner's doing, so neither may say it is.
    expect(embedFailureOf(152)).toBe('embed-refused');
    expect(embedFailureOf(153)).toBe('embed-refused');
  });

  it('falls back to a player error for anything unrecognised', () => {
    expect(embedFailureOf(5)).toBe('player-error');
    expect(embedFailureOf(999)).toBe('player-error');
    expect(embedFailureOf(undefined)).toBe('player-error');
  });
});

describe('embedFailureOfStatus', () => {
  it('reads a refused or missing embed page from its status', () => {
    expect(embedFailureOfStatus(403)).toBe('embed-blocked');
    expect(embedFailureOfStatus(401)).toBe('embed-blocked');
    expect(embedFailureOfStatus(404)).toBe('unavailable');
    expect(embedFailureOfStatus(410)).toBe('unavailable');
  });

  it('does not guess at anything else', () => {
    expect(embedFailureOfStatus(500)).toBe('no-player');
    expect(embedFailureOfStatus(429)).toBe('no-player');
  });
});

describe('embedFailureCopy', () => {
  it('never blames the network for a blocked embed', () => {
    const copy = embedFailureCopy('embed-blocked');
    expect(copy.message).not.toContain('네트워크');
    expect(copy.message).not.toContain('연결');
    expect(copy.offerRetry).toBe(false);
    expect(copy.offerYouTube).toBe(true);
  });

  it('says the transcript still works when the video does not', () => {
    expect(embedFailureCopy('embed-blocked').message).toContain('대본');
    expect(embedFailureCopy('unavailable').message).toContain('대본');
    expect(embedFailureCopy('embed-refused').message).toContain('대본');
    expect(embedFailureCopy('no-player').message).toContain('대본');
  });

  it('offers a retry only where retrying could help', () => {
    expect(embedFailureCopy('offline').offerRetry).toBe(true);
    expect(embedFailureCopy('player-error').offerRetry).toBe(true);
    expect(embedFailureCopy('embed-refused').offerRetry).toBe(true);
    expect(embedFailureCopy('no-player').offerRetry).toBe(true);
    expect(embedFailureCopy('unavailable').offerRetry).toBe(false);
    expect(embedFailureCopy('bad-id').offerRetry).toBe(false);
  });

  it('never blames the owner when the app is what could not open it', () => {
    for (const failure of ['embed-refused', 'no-player'] as const) {
      const { message } = embedFailureCopy(failure);
      expect(message).not.toContain('설정');
      expect(message).not.toContain('삭제');
      expect(message).not.toContain('비공개');
    }
  });

  it('does not send the reader to YouTube for an id we mangled', () => {
    expect(embedFailureCopy('bad-id').offerYouTube).toBe(false);
  });

  it('writes every message in 해요체 without a middot', () => {
    for (const failure of [
      'offline',
      'embed-blocked',
      'unavailable',
      'bad-id',
      'player-error',
      'embed-refused',
      'no-player',
    ] as const) {
      const { message } = embedFailureCopy(failure);
      expect(message).not.toContain('·');
      expect(message).toMatch(/(요|어요)\.$/);
    }
  });
});
