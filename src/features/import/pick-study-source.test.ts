import {
  assertStudySourceSize,
  MAX_DOCUMENT_SOURCE_BYTES,
  MAX_MEDIA_SOURCE_BYTES,
  StudySourcePickerError,
  studySourceKindOf,
} from './pick-study-source';

describe('study source validation', () => {
  it('classifies supported MIME types and provider extension fallbacks', () => {
    expect(studySourceKindOf('lecture.bin', 'audio/mpeg')).toBe('audio');
    expect(studySourceKindOf('lecture.bin', 'video/mp4')).toBe('video');
    expect(studySourceKindOf('handout.PDF', 'application/octet-stream')).toBe(
      'pdf',
    );
    expect(studySourceKindOf('week-3.PPTX')).toBe('pptx');
    expect(studySourceKindOf('notes.docx')).toBeNull();
  });

  it('accepts exact limits and rejects the first byte over each limit', () => {
    expect(() => assertStudySourceSize('audio', MAX_MEDIA_SOURCE_BYTES)).not.toThrow();
    expect(() => assertStudySourceSize('pdf', MAX_DOCUMENT_SOURCE_BYTES)).not.toThrow();

    for (const [kind, size] of [
      ['video', MAX_MEDIA_SOURCE_BYTES + 1],
      ['pptx', MAX_DOCUMENT_SOURCE_BYTES + 1],
    ] as const) {
      try {
        assertStudySourceSize(kind, size);
        throw new Error('Expected file-too-large validation error.');
      } catch (error) {
        expect(error).toBeInstanceOf(StudySourcePickerError);
        expect((error as StudySourcePickerError).code).toBe('file-too-large');
      }
    }
  });
});
