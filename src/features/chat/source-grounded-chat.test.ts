import type { StudyMaterial } from '../../types';
import {
  LocalSourceGroundedChatService,
  NO_GROUNDED_ANSWER_MESSAGE,
} from './source-grounded-chat';

function material(overrides: Partial<StudyMaterial> = {}): StudyMaterial {
  return {
    id: 'material-1',
    projectId: 'project-1',
    title: '운영체제 중간고사 일정',
    source: {
      uri: 'file:///lecture.m4a',
      fileName: 'lecture.m4a',
      mimeType: 'audio/mp4',
      kind: 'audio',
      origin: 'import',
      durationMs: 180_000,
    },
    status: 'ready',
    progress: 1,
    progressLabel: '마인드팩 준비 완료',
    syncStatus: 'local-only',
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    transcript: [
      {
        id: 'segment-definition',
        startMs: 12_000,
        endMs: 27_000,
        speaker: '교수자',
        text: '프로세스는 실행 중인 프로그램이며 독립된 주소 공간을 가집니다.',
      },
      {
        id: 'segment-important',
        startMs: 64_000,
        endMs: 81_000,
        speaker: '교수자',
        text: '여기가 가장 중요한 부분입니다. 교착 상태의 네 가지 조건을 함께 기억하세요.',
        isImportant: true,
      },
      {
        id: 'segment-comparison',
        startMs: 112_000,
        endMs: 129_000,
        speaker: '교수자',
        text: '스레드는 프로세스 안에서 주소 공간을 공유하므로 문맥 교환 비용이 더 작습니다.',
      },
    ],
    note: {
      summary:
        '프로세스와 스레드의 차이를 주소 공간과 문맥 교환 비용을 중심으로 정리합니다.',
      keyPoints: ['시험은 다음 주 금요일입니다.'],
      concepts: [
        {
          id: 'concept-deadlock',
          term: '교착 상태',
          description:
            '둘 이상의 작업이 서로의 자원을 기다리며 진행하지 못하는 상태',
          sourceStartMs: 64_000,
          difficulty: 'intermediate',
        },
      ],
      estimatedReviewMinutes: 4,
      teacherVerified: false,
      updatedAt: '2026-09-02T00:00:00.000Z',
    },
    quiz: [
      {
        id: 'quiz-secret',
        type: 'multiple-choice',
        concept: '시험 일정',
        prompt: '시험은 언제인가요?',
        choices: ['다음 주 금요일', '이번 주 월요일'],
        correctChoiceIndex: 0,
        explanation: '시험은 다음 주 금요일입니다.',
        sourceStartMs: 170_000,
      },
    ],
    markers: [
      {
        id: 'marker-1',
        timestampMs: 64_000,
        label: 'AI가 찾은 핵심 설명',
        source: 'ai',
      },
    ],
    ...overrides,
  };
}

describe('LocalSourceGroundedChatService', () => {
  const service = new LocalSourceGroundedChatService();

  it('answers from transcript text and returns a playable timestamp citation', () => {
    const result = service.answer(material(), '강사가 중요한 부분으로 말한 내용은?');

    expect(result.status).toBe('answered');
    expect(result.mode).toBe('local-extractive');
    expect(result.answer).toContain('교착 상태의 네 가지 조건');
    expect(result.citations[0]).toMatchObject({
      sourceKind: 'transcript',
      timestampMs: 64_000,
      transcriptSegmentId: 'segment-important',
      speaker: '교수자',
    });
  });

  it('answers a concept question only with the stored concept description', () => {
    const result = service.answer(material(), '교착 상태가 뭐야?', {
      maxCitations: 1,
    });

    expect(result).toMatchObject({
      status: 'answered',
      citations: [
        {
          sourceKind: 'concept',
          timestampMs: 64_000,
          conceptId: 'concept-deadlock',
        },
      ],
    });
    expect(result.answer).toContain(
      '둘 이상의 작업이 서로의 자원을 기다리며 진행하지 못하는 상태',
    );
  });

  it('uses the stored summary for a summary request and links it to source time', () => {
    const result = service.answer(material(), '이 자료를 요약해줘', {
      maxCitations: 1,
    });

    expect(result.status).toBe('answered');
    expect(result.answer).toContain(
      '프로세스와 스레드의 차이를 주소 공간과 문맥 교환 비용을 중심으로 정리합니다.',
    );
    expect(result.citations[0]).toMatchObject({
      sourceKind: 'summary',
      timestampMs: 112_000,
    });
  });

  it('refuses an unsupported question instead of using title, key points, quiz, or markers', () => {
    const result = service.answer(material(), '중간고사 시험 일정은 언제야?');

    expect(result).toEqual({
      status: 'insufficient-evidence',
      answer: NO_GROUNDED_ANSWER_MESSAGE,
      citations: [],
      confidence: 0,
      mode: 'local-extractive',
      refusalReason: 'no-supported-source',
    });
  });

  it('refuses when no timestamp-verifiable source exists', () => {
    const result = service.answer(
      material({
        transcript: [],
        note: {
          summary: '이 문장만으로는 원본 구간을 확인할 수 없습니다.',
          keyPoints: [],
          concepts: [],
          estimatedReviewMinutes: 1,
          teacherVerified: false,
          updatedAt: '2026-09-02T00:00:00.000Z',
        },
      }),
      '원본 구간은 어디야?',
    );

    expect(result.status).toBe('insufficient-evidence');
    expect(result.citations).toEqual([]);
  });

  it('handles an empty question without searching the material', () => {
    const result = service.answer(material(), '   ');

    expect(result).toMatchObject({
      status: 'insufficient-evidence',
      citations: [],
      confidence: 0,
      refusalReason: 'empty-question',
    });
  });
});
