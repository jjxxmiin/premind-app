import {
  clamp,
  formatBytes,
  formatDuration,
  formatMaterialLength,
  formatMediaDuration,
} from './format';

describe('format helpers', () => {
  it('formats short and long durations', () => {
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3661)).toBe('01:01:01');
  });

  it('does not present an unknown media duration as zero', () => {
    expect(formatMediaDuration()).toBe('길이 확인 중');
    expect(formatMediaDuration(65_000)).toBe('01:05');
  });

  it('formats byte units', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(20 * 1024 * 1024)).toBe('20 MB');
  });

  it('clamps progress values', () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(2)).toBe(1);
  });
});

describe('formatMaterialLength', () => {
  it('gives a document its page count, never a duration', () => {
    expect(formatMaterialLength('document', undefined, 6)).toBe('6쪽');
    // A duration on a document is meaningless and must not win.
    expect(formatMaterialLength('document', 300_000, 3)).toBe('3쪽');
  });

  it('never tells a document its length is still being worked out', () => {
    // "길이 확인 중" was a promise that could not resolve: a PDF has no length
    // in time and never will, so the row said the app was still thinking.
    expect(formatMaterialLength('document', undefined, 0)).toBe('문서');
    expect(formatMaterialLength('document', undefined, 0)).not.toContain('확인 중');
  });

  it('still reads a real duration for anything played', () => {
    expect(formatMaterialLength('audio', 65_000)).toBe('01:05');
    expect(formatMaterialLength('video', 3_600_000)).toBe('01:00:00');
  });

  it('keeps saying 확인 중 for a recording whose length is not known yet', () => {
    expect(formatMaterialLength('audio', undefined)).toBe('길이 확인 중');
    expect(formatMaterialLength('video', 0)).toBe('길이 확인 중');
  });
});
