import type { StudyMaterial } from '@/types';

import { chatSuggestions, sourceNoun } from './chat-suggestions';

function material(extra: Partial<StudyMaterial> = {}): StudyMaterial {
  return {
    id: 'material-1',
    projectId: 'project-1',
    title: '자료',
    source: {
      uri: 'file:///a.m4a',
      fileName: 'a.m4a',
      mimeType: 'audio/mp4',
      kind: 'audio',
      origin: 'recording',
    },
    status: 'ready',
    progress: 1,
    progressLabel: '',
    syncStatus: 'synced',
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
    transcript: [],
    quiz: [],
    markers: [],
    ...extra,
  } as StudyMaterial;
}

function withConcepts(...terms: string[]): StudyMaterial {
  return material({
    note: {
      summary: '',
      keyPoints: [],
      concepts: terms.map((term, index) => ({
        id: `concept-${index}`,
        term,
        description: '',
        sourceStartMs: index * 1000,
        difficulty: 'basic' as const,
      })),
      estimatedReviewMinutes: 5,
      teacherVerified: false,
      updatedAt: '2026-09-08T00:00:00.000Z',
    },
  });
}

describe('sourceNoun', () => {
  it('calls a PDF a document rather than a lecture', () => {
    expect(
      sourceNoun(
        material({
          source: {
            uri: 'file:///a.pdf',
            fileName: 'a.pdf',
            mimeType: 'application/pdf',
            kind: 'document',
            origin: 'import',
          } as StudyMaterial['source'],
        }),
      ),
    ).toBe('문서');
  });

  it('calls a YouTube link and an uploaded video a video', () => {
    expect(
      sourceNoun(
        material({
          source: {
            uri: 'https://youtu.be/x',
            fileName: 'x',
            mimeType: 'video/youtube',
            kind: 'video',
            origin: 'link',
          } as StudyMaterial['source'],
        }),
      ),
    ).toBe('영상');
  });

  it('calls a recording a lecture', () => {
    expect(sourceNoun(material())).toBe('강의');
  });
});

describe('chatSuggestions', () => {
  it('leads with the whole-material summary while the chat is empty', () => {
    expect(chatSuggestions(material())[0]).toBe('이 강의를 한 문단으로 요약해줘');
  });

  it('names the source correctly, so a PDF is never called a lecture', () => {
    const pdf = material({
      source: {
        uri: 'file:///a.pdf',
        fileName: 'a.pdf',
        mimeType: 'application/pdf',
        kind: 'document',
        origin: 'import',
      } as StudyMaterial['source'],
    });
    for (const suggestion of chatSuggestions(pdf)) {
      expect(suggestion).not.toContain('강의');
    }
  });

  it('attaches the right particle to a concept, batchim or not', () => {
    const suggestions = chatSuggestions(withConcepts('과적합', '회귀'));
    expect(suggestions).toContain('과적합이 뭐야?');
    expect(suggestions).toContain('회귀가 뭐야?');
  });

  it('stops offering the opening summary once the reader has asked something', () => {
    const suggestions = chatSuggestions(material(), ['아무거나 물어봄']);
    expect(suggestions[0]).not.toBe('이 강의를 한 문단으로 요약해줘');
    expect(suggestions).toHaveLength(3);
  });

  it('never repeats a question that has already been asked', () => {
    const asked = ['과적합이 뭐야?'];
    expect(chatSuggestions(withConcepts('과적합', '회귀'), asked)).not.toContain(
      '과적합이 뭐야?',
    );
  });

  it('ignores spacing and case when deciding what was already asked', () => {
    const asked = ['과적합이  뭐야?'];
    expect(chatSuggestions(withConcepts('과적합'), asked)).not.toContain('과적합이 뭐야?');
  });

  it('still has something to offer a material with no concepts at all', () => {
    const suggestions = chatSuggestions(material());
    expect(suggestions.length).toBeGreaterThan(0);
    expect(new Set(suggestions).size).toBe(suggestions.length);
  });

  it('keeps offering questions deep into a conversation', () => {
    const asked = [
      '이 강의를 한 문단으로 요약해줘',
      '과적합이 뭐야?',
      '가장 중요한 내용 세 가지만 알려줘',
    ];
    expect(chatSuggestions(withConcepts('과적합'), asked).length).toBeGreaterThan(0);
  });

  it('shows at most three at a time', () => {
    expect(chatSuggestions(withConcepts('가', '나', '다', '라')).length).toBe(3);
  });
});
