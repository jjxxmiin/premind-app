import type { RecordingDetail, StudyMaterial } from '../types';
import type { PremindApiClient } from './api/client';
import type { ResumableUploader } from './api/resumable-upload';
import type { SessionManager } from './api/session-manager';
import {
  StudyMaterialService,
  UnsupportedMaterialError,
  type MaterialProcessingProgress,
} from './study-material-service';

function createService(): StudyMaterialService {
  return new StudyMaterialService(
    {} as PremindApiClient,
    {} as SessionManager,
    {} as ResumableUploader,
  );
}

describe('StudyMaterialService', () => {
  describe('createLocalMaterial', () => {
    it.each([
      {
        fileName: '운영체제_3주차-final.m4a',
        mimeType: 'audio/mp4',
        expectedKind: 'audio',
        expectedMimeType: 'audio/mp4',
        expectedTitle: '운영체제 3주차 final',
      },
      {
        fileName: '데이터시각화_실습.MOV',
        mimeType: undefined,
        expectedKind: 'video',
        expectedMimeType: 'video/mp4',
        expectedTitle: '데이터시각화 실습',
      },
    ] as const)(
      'infers $expectedKind and derives a readable title from $fileName',
      ({
        expectedKind,
        expectedMimeType,
        expectedTitle,
        fileName,
        mimeType,
      }) => {
        const material = createService().createLocalMaterial({
          projectId: 'project-1',
          uri: `file:///documents/${fileName}`,
          fileName,
          mimeType,
        });

        expect(material).toMatchObject({
          projectId: 'project-1',
          title: expectedTitle,
          status: 'imported',
          progress: 0,
          syncStatus: 'local-only',
          source: {
            fileName,
            kind: expectedKind,
            mimeType: expectedMimeType,
            origin: 'import',
          },
        });
        expect(material.transcript).toEqual([]);
        expect(material.quiz).toEqual([]);
      },
    );

    it('respects an explicit title and reads a PDF as a document', () => {
      const service = createService();
      const material = service.createLocalMaterial({
        projectId: 'project-1',
        uri: 'file:///documents/lecture.mp3',
        fileName: 'lecture.mp3',
        title: '  사용자 지정 제목  ',
      });

      expect(material.title).toBe('사용자 지정 제목');
      // The server reads a PDF page by page rather than transcribing it, so
      // it is a material like any other, just without anything to play.
      const document = service.createLocalMaterial({
        projectId: 'project-1',
        uri: 'file:///documents/lecture.pdf',
        fileName: 'lecture.pdf',
      });
      expect(document.source.kind).toBe('document');
      expect(document.source.mimeType).toBe('application/pdf');
      expect(() =>
        service.createLocalMaterial({
          projectId: 'project-1',
          uri: 'file:///documents/notes.txt',
          fileName: 'notes.txt',
        }),
      ).toThrow(UnsupportedMaterialError);
    });
  });

  it('generates a linked transcript, note, five quizzes, and automatic evidence markers', async () => {
    const service = createService();
    const source = service.createLocalMaterial({
      projectId: 'project-ai',
      uri: 'file:///documents/지도학습.m4a',
      fileName: '지도학습.m4a',
      durationMs: 120_000,
    });
    const progress: MaterialProcessingProgress[] = [];

    const result = await service.processLocalMaterial(source, {
      stepDelayMs: 0,
      onProgress: (update) => progress.push(update),
    });

    expect(progress.map((update) => update.status)).toEqual([
      'queued',
      'transcribing',
      'generating',
      'generating',
      'ready',
    ]);
    expect(result).toMatchObject({
      status: 'ready',
      progress: 1,
      progressLabel: '마인드팩 준비 완료',
      source: source.source,
    });
    expect(result.transcript).toHaveLength(5);
    expect(result.transcript.every((segment) => segment.endMs > segment.startMs)).toBe(
      true,
    );
    expect(result.note).toMatchObject({
      estimatedReviewMinutes: 5,
      teacherVerified: false,
    });
    expect(result.note?.summary).toContain(source.title);
    expect(result.note?.keyPoints).toHaveLength(4);
    expect(result.note?.concepts).toHaveLength(3);
    expect(result.quiz).toHaveLength(5);
    expect(
      result.quiz.every(
        (question) =>
          question.choices.length >= 2 &&
          question.explanation.length > 0 &&
          question.sourceStartMs >= 0,
      ),
    ).toBe(true);

    const importantSegment = result.transcript.find(
      (segment) => segment.isImportant,
    );
    const evidenceMarker = result.markers.find(
      (marker) =>
        marker.source === 'ai' && marker.timestampMs === importantSegment?.startMs,
    );
    expect(importantSegment).toBeDefined();
    expect(evidenceMarker).toMatchObject({
      timestampMs: importantSegment?.startMs,
      source: 'ai',
    });
    expect(evidenceMarker?.confidence).toBeGreaterThanOrEqual(0.5);
    expect(evidenceMarker?.reason).toBeTruthy();
    expect(evidenceMarker?.evidenceText).toBeTruthy();
  });

  it('stops deterministically when processing is aborted', async () => {
    const service = createService();
    const material = service.createLocalMaterial({
      projectId: 'project-1',
      uri: 'file:///documents/중단테스트.mp3',
      fileName: '중단테스트.mp3',
    });
    const controller = new AbortController();
    const onProgress = jest.fn(() => controller.abort());

    await expect(
      service.processLocalMaterial(material, {
        signal: controller.signal,
        stepDelayMs: 10_000,
        onProgress,
      }),
    ).rejects.toMatchObject({
      name: 'AbortError',
      message: '마인드팩 만들기를 중단했어요.',
    });
    expect(onProgress).toHaveBeenCalledTimes(1);
  });
});

// --- the server pipeline -----------------------------------------------------

const READY: RecordingDetail = {
  id: 'recording-9',
  title: '2주차 강의',
  youtubeId: null,
  durationMs: 300_000,
  status: 'ready',
  byteSize: 2048,
  createdAt: '2026-09-02T04:00:00.000Z',
  contentType: 'audio/mp4',
  transcript: '오늘은 정렬 알고리즘을 다룹니다.',
  summary: '정렬 알고리즘의 개요와 비교 기준을 정리했습니다.',
  keyPoints: ['병합 정렬은 분할 정복이다.', '퀵 정렬은 피벗에 좌우된다.'],
  lensReport: null,
  lensEvaluatedAt: null,
  lensCount: 0,
  pageImageCount: 0,
  studyPack: {
    concepts: [
      {
        term: '병합 정렬',
        description: '반씩 나눠 정렬한 뒤 합치는 방법입니다.',
        sourceStartMs: 2_000,
        difficulty: 'intermediate',
      },
    ],
    quiz: [
      {
        type: 'true-false',
        concept: '병합 정렬',
        prompt: '병합 정렬은 분할 정복을 사용한다.',
        choices: ['맞아요', '아니에요'],
        correctChoiceIndex: 0,
        explanation: '반씩 나눈 뒤 합치기 때문입니다.',
        sourceStartMs: 2_000,
      },
    ],
  },
};

const SEGMENTS = [
  { startMs: 0, endMs: 2_000, text: '오늘은 정렬 알고리즘을 다룹니다.' },
  {
    startMs: 2_000,
    endMs: 6_000,
    text: '여기서 가장 중요한 것은 병합 정렬의 분할 정복 구조입니다.',
  },
  { startMs: 6_000, endMs: 9_000, text: '다음 시간에는 퀵 정렬을 보겠습니다.' },
];

function serverService(
  overrides: {
    recordings?: RecordingDetail[];
    segments?: typeof SEGMENTS;
    upload?: jest.Mock;
  } = {},
) {
  const recordings = [...(overrides.recordings ?? [READY])];
  const getRecording = jest.fn(async () =>
    recordings.length > 1 ? (recordings.shift() as RecordingDetail) : recordings[0],
  );
  const client = {
    getRecording,
    getRecordingSegments: jest.fn(async () => overrides.segments ?? SEGMENTS),
  } as unknown as PremindApiClient;
  const sessions = {
    session: null,
    authorize: <T,>(operation: (token: string) => Promise<T>) =>
      operation('access-token'),
  } as unknown as SessionManager;
  const upload =
    overrides.upload ??
    jest.fn(async () => ({ uploadId: 'upload-1', recordingId: 'recording-9' }));
  const uploader = { upload } as unknown as ResumableUploader;

  return {
    service: new StudyMaterialService(client, sessions, uploader),
    getRecording,
    upload,
  };
}

function localMaterial(): StudyMaterial {
  return createService().createLocalMaterial({
    projectId: 'project-1',
    uri: 'file:///documents/lecture.m4a',
    fileName: 'lecture.m4a',
    mimeType: 'audio/mp4',
    durationMs: 300_000,
    markers: [
      {
        id: 'marker-1',
        timestampMs: 120_000,
        label: '중요 표시',
        source: 'teacher',
      },
    ],
  });
}

describe('StudyMaterialService.processOnServer', () => {
  it("keeps a document page's own summary, which the 대본 offers as a view", async () => {
    const { service } = serverService({
      segments: [
        {
          startMs: 0,
          endMs: 999,
          text: '지도학습의 정의를 길게 설명한 쪽의 본문이에요.',
          summary: '지도학습이 무엇인지 정리한 쪽이에요.',
        },
        { startMs: 1_000, endMs: 1_999, text: '분류와 회귀를 비교한 쪽의 본문이에요.' },
      ] as typeof SEGMENTS,
    });

    const result = await service.processOnServer(localMaterial());

    // Dropping this is what made the 쪽 요약 chip never appear.
    expect(result.transcript[0]?.summary).toBe('지도학습이 무엇인지 정리한 쪽이에요.');
    expect(result.transcript[0]?.text).toBe('지도학습의 정의를 길게 설명한 쪽의 본문이에요.');
    // A page the model skipped carries no summary rather than an empty one.
    expect(result.transcript[1]).not.toHaveProperty('summary');
  });

  it('folds the server transcript, summary and study pack into the material', async () => {
    const { service, upload } = serverService();
    const stages: MaterialProcessingProgress[] = [];
    const onUploaded = jest.fn();

    const result = await service.processOnServer(localMaterial(), {
      onUploaded,
      onProgress: (progress) => stages.push(progress),
    });

    expect(result.status).toBe('ready');
    expect(result.syncStatus).toBe('synced');
    expect(result.serverRecordingId).toBe('recording-9');
    expect(result.transcript.map((segment) => segment.text)).toEqual(
      SEGMENTS.map((segment) => segment.text),
    );
    expect(result.note?.summary).toBe(READY.summary);
    expect(result.note?.keyPoints).toEqual(READY.keyPoints);
    expect(result.note?.concepts[0]).toMatchObject({ term: '병합 정렬' });
    expect(result.quiz).toHaveLength(1);
    expect(result.quiz[0]?.prompt).toBe('병합 정렬은 분할 정복을 사용한다.');
    expect(result.lensReport).toBeUndefined();
    expect(stages.at(-1)).toMatchObject({ status: 'ready', progress: 1 });
    expect(onUploaded).toHaveBeenCalledWith('recording-9');

    // The upload carries the user's own markers, not the AI's.
    expect(upload.mock.calls[0]?.[0]).toMatchObject({
      clientReference: result.id,
      markers: [{ timestampMs: 120_000 }],
    });
  });

  it('resumes server processing without uploading an already stored source', async () => {
    const { service, upload } = serverService();
    const material = {
      ...localMaterial(),
      serverRecordingId: 'recording-9',
      status: 'failed' as const,
    };

    const result = await service.processOnServer(material);

    expect(upload).not.toHaveBeenCalled();
    expect(result.status).toBe('ready');
    expect(result.serverRecordingId).toBe('recording-9');
  });

  it('keeps the markers the user placed and adds evidence-backed ones', async () => {
    const { service } = serverService();

    const result = await service.processOnServer(localMaterial());

    expect(result.markers.some((marker) => marker.source === 'teacher')).toBe(true);
    const automatic = result.markers.filter((marker) => marker.source === 'ai');
    expect(automatic.length).toBeGreaterThan(0);
    // Automatic markers must quote the real transcript, never invent a line.
    for (const marker of automatic) {
      expect(SEGMENTS.map((segment) => segment.text).join(' ')).toContain(
        marker.evidenceText,
      );
    }
  });

  it('keeps the server Lens report with its source timestamps', async () => {
    const lensReport: NonNullable<RecordingDetail['lensReport']> = {
      overall: 4.2,
      rubric: [
        {
          key: 'clarity',
          label: '명료성',
          score: 4.2,
          evidence: '정렬 기준을 예시로 분명히 설명했어요.',
        },
      ],
      strengths: [
        { text: '비교 기준이 명확해요.', sourceStartMs: 2_000 },
      ],
      improvements: [
        {
          text: '전환을 예고해 보세요.',
          sourceStartMs: 4_000,
          action: '다음 주제를 한 문장으로 예고하세요.',
        },
      ],
      priority: {
        text: '전환을 먼저 알리세요.',
        sourceStartMs: 4_000,
        action: '잠깐 멈춘 뒤 다음 주제를 말하세요.',
      },
    };
    const { service } = serverService({
      recordings: [{ ...READY, lensReport }],
    });

    const result = await service.processOnServer(localMaterial());

    expect(result.lensReport).toEqual(lensReport);
    expect(result.lensReport?.priority?.sourceStartMs).toBe(4_000);
  });

  it('waits while the server is still transcribing', async () => {
    const { service, getRecording } = serverService({
      recordings: [
        { ...READY, status: 'transcribing', transcript: null, summary: null },
        READY,
      ],
    });

    const result = await service.processOnServer(localMaterial(), {
      pollIntervalMs: 1,
    });

    expect(getRecording).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('ready');
  });

  it('reports a server-side failure without touching the local file', async () => {
    const { service } = serverService({ recordings: [{ ...READY, status: 'failed' }] });
    const material = localMaterial();

    await expect(service.processOnServer(material)).rejects.toThrow(
      /원본은 기기에 그대로/,
    );
  });

  it('falls back to one span when the engine returned no timings', async () => {
    const { service } = serverService({ segments: [] });

    const result = await service.processOnServer(localMaterial());

    expect(result.transcript).toHaveLength(1);
    expect(result.transcript[0]).toMatchObject({
      startMs: 0,
      endMs: 300_000,
      text: READY.transcript,
    });
  });

  it('leaves no note when the server produced no summary or concepts', async () => {
    const { service } = serverService({
      recordings: [
        { ...READY, summary: null, keyPoints: [], studyPack: null },
      ],
    });

    const result = await service.processOnServer(localMaterial());

    expect(result.note).toBeUndefined();
    expect(result.quiz).toEqual([]);
    // The transcript is still worth having on its own.
    expect(result.transcript.length).toBeGreaterThan(0);
  });
});

// --- Lens ------------------------------------------------------------------

const LENS_REPORT: NonNullable<RecordingDetail['lensReport']> = {
  overall: 4.1,
  rubric: [
    { key: 'structure', label: '구조', score: 4.3, evidence: '목차 제시' },
    { key: 'clarity', label: '명료성', score: 4.1, evidence: '정의 뒤 예시' },
    { key: 'evidence', label: '근거 활용', score: 3.8, evidence: '수치 인용' },
    { key: 'delivery', label: '전달력', score: 4, evidence: '속도 일정' },
  ],
  strengths: [{ text: '개념을 사례로 연결했어요.', sourceStartMs: 402_000 }],
  improvements: [],
  priority: null,
};

function readyMaterial(extra: Partial<StudyMaterial> = {}): StudyMaterial {
  return {
    ...localMaterial(),
    status: 'ready',
    progress: 1,
    syncStatus: 'synced',
    serverRecordingId: 'recording-9',
    ...extra,
  };
}

function lensService(overrides: {
  configured?: boolean;
  recordings?: RecordingDetail[];
  history?: unknown;
  regenerate?: jest.Mock;
}) {
  const recordings = [...(overrides.recordings ?? [READY])];
  const getRecording = jest.fn(async () =>
    recordings.length > 1 ? (recordings.shift() as RecordingDetail) : recordings[0],
  );
  const listLensHistory = jest.fn(async () => {
    if (overrides.history instanceof Error) throw overrides.history;
    return (overrides.history ?? []) as NonNullable<StudyMaterial['lensHistory']>;
  });
  const regenerateLens = overrides.regenerate ?? jest.fn(async () => undefined);
  const client = {
    getRecording,
    listLensHistory,
    regenerateLens,
  } as unknown as PremindApiClient;
  const sessions = {
    session: null,
    authorize: <T,>(operation: (token: string) => Promise<T>) =>
      operation('access-token'),
  } as unknown as SessionManager;
  const service = new StudyMaterialService(client, sessions, {} as ResumableUploader);
  jest
    .spyOn(service, 'canUseServer')
    .mockReturnValue(overrides.configured ?? true);
  return { service, getRecording, listLensHistory, regenerateLens };
}

describe('StudyMaterialService Lens', () => {
  it('answers the demo with the history the material already carries', async () => {
    const entries = [{ id: 'lens-1', evaluatedAt: '2026-09-01T09:00:00.000Z', report: LENS_REPORT }];
    const { service, listLensHistory } = lensService({ configured: false });

    await expect(
      service.loadLensHistory(readyMaterial({ lensHistory: entries })),
    ).resolves.toEqual(entries);
    await expect(service.loadLensHistory(readyMaterial())).resolves.toEqual([]);
    expect(listLensHistory).not.toHaveBeenCalled();
  });

  it('loads the history from the server for a synced material', async () => {
    const entries = [{ id: 'lens-2', evaluatedAt: '2026-09-07T05:02:00.000Z', report: LENS_REPORT }];
    const { service, listLensHistory } = lensService({ history: entries });

    await expect(service.loadLensHistory(readyMaterial())).resolves.toEqual(entries);
    expect(listLensHistory).toHaveBeenCalledWith('access-token', 'recording-9', undefined);
  });

  it('returns the new report with the history once the server dates a new evaluation', async () => {
    const entries = [
      { id: 'lens-2', evaluatedAt: '2026-09-07T05:02:00.000Z', report: LENS_REPORT },
      { id: 'lens-1', evaluatedAt: '2026-09-01T09:00:00.000Z', report: { ...LENS_REPORT, overall: 3.4 } },
    ];
    const evaluated: RecordingDetail = {
      ...READY,
      lensReport: LENS_REPORT,
      lensEvaluatedAt: '2026-09-07T05:02:00.000Z',
      lensCount: 2,
    };
    const { service, getRecording, regenerateLens } = lensService({
      // The first poll still shows the previous evaluation.
      recordings: [
        { ...READY, lensReport: LENS_REPORT, lensEvaluatedAt: '2026-09-01T09:00:00.000Z', lensCount: 1 },
        evaluated,
      ],
      history: entries,
    });

    const result = await service.requestLens(
      readyMaterial({
        lensReport: LENS_REPORT,
        lensEvaluatedAt: '2026-09-01T09:00:00.000Z',
        lensCount: 1,
      }),
      { pollIntervalMs: 1 },
    );

    expect(regenerateLens).toHaveBeenCalledWith('access-token', 'recording-9');
    expect(getRecording).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      report: LENS_REPORT,
      evaluatedAt: '2026-09-07T05:02:00.000Z',
      count: 2,
      history: entries,
    });
  });

  it('still returns the report when the history cannot be loaded', async () => {
    const previous = { id: 'lens-1', evaluatedAt: '2026-09-01T09:00:00.000Z', report: LENS_REPORT };
    const { service } = lensService({
      recordings: [
        { ...READY, lensReport: LENS_REPORT, lensEvaluatedAt: '2026-09-07T05:02:00.000Z', lensCount: 2 },
      ],
      history: new Error('offline'),
    });

    const result = await service.requestLens(
      readyMaterial({ lensHistory: [previous], lensCount: 1 }),
      { pollIntervalMs: 1 },
    );

    expect(result.report).toEqual(LENS_REPORT);
    expect(result.count).toBe(2);
    expect(result.history.map((entry) => entry.evaluatedAt)).toEqual([
      '2026-09-07T05:02:00.000Z',
      '2026-09-01T09:00:00.000Z',
    ]);
  });

  it('passes the server refusal through untouched', async () => {
    const refusal = Object.assign(new Error('말한 내용이 너무 짧아 평가할 수 없어요.'), {
      name: 'ApiError',
      status: 422,
      code: 'LENS_INSUFFICIENT',
    });
    const { service, getRecording } = lensService({
      regenerate: jest.fn(async () => {
        throw refusal;
      }),
    });

    await expect(
      service.requestLens(readyMaterial(), { pollIntervalMs: 1 }),
    ).rejects.toBe(refusal);
    expect(getRecording).not.toHaveBeenCalled();
  });
});

function askService(overrides: {
  configured?: boolean;
  answer?: unknown;
} = {}) {
  const askRecording = jest.fn(async () => {
    if (overrides.answer instanceof Error) throw overrides.answer;
    return (overrides.answer ?? {
      answer: '분류는 범주를 예측해요.',
      grounded: true,
      citations: [{ quote: '분류는 범주를 예측합니다.', sourceStartMs: 4000 }],
    }) as never;
  });
  const client = { askRecording } as unknown as PremindApiClient;
  const sessions = {
    session: null,
    authorize: <T,>(operation: (token: string) => Promise<T>) => operation('access-token'),
  } as unknown as SessionManager;
  const service = new StudyMaterialService(client, sessions, {} as ResumableUploader);
  jest.spyOn(service, 'canUseServer').mockReturnValue(overrides.configured ?? true);
  return { service, askRecording };
}

describe('StudyMaterialService.askMaterial', () => {
  it('returns the server answer with its citations', async () => {
    const { service, askRecording } = askService();

    const result = await service.askMaterial(readyMaterial(), '분류가 뭐야?');

    expect(result.mode).toBe('server-grounded');
    expect(result.status).toBe('answered');
    expect(result.answer).toBe('분류는 범주를 예측해요.');
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.timestampMs).toBe(4000);
    expect(askRecording).toHaveBeenCalledWith(
      'access-token',
      'recording-9',
      '분류가 뭐야?',
      undefined,
    );
  });

  it('marks an answer the transcript could not support as insufficient', async () => {
    const { service } = askService({
      answer: { answer: '대본에 없어요.', grounded: false, citations: [] },
    });

    const result = await service.askMaterial(readyMaterial(), '점심 메뉴는?');

    expect(result.status).toBe('insufficient-evidence');
    expect(result.answer).toBe('대본에 없어요.');
  });

  it('falls back to the on-device answer when the server fails', async () => {
    const { service, askRecording } = askService({ answer: new Error('503') });

    const result = await service.askMaterial(readyMaterial(), '분류가 뭐야?');

    expect(askRecording).toHaveBeenCalled();
    expect(result.mode).toBe('local-extractive');
  });

  it('never calls the server for a demo material', async () => {
    const { service, askRecording } = askService({ configured: false });

    const result = await service.askMaterial(readyMaterial(), '분류가 뭐야?');

    expect(askRecording).not.toHaveBeenCalled();
    expect(result.mode).toBe('local-extractive');
  });
});
