import type { LensReport, StudyMaterial } from '@/types';

import {
  TIPS_UNTIL,
  lensEvaluatedAt,
  lensFailure,
  lensHome,
  lensRowMeta,
  verdictTone,
} from './lens-home';

const REPORT: LensReport = {
  overall: 4.1,
  rubric: [],
  strengths: [],
  improvements: [],
  priority: null,
};

function material(
  id: string,
  updatedAt: string,
  extra: Partial<StudyMaterial> = {},
): StudyMaterial {
  return {
    id,
    projectId: 'project-1',
    title: id,
    source: { kind: 'audio', origin: 'recording', uri: `file://${id}` } as StudyMaterial['source'],
    status: 'ready',
    progress: 1,
    progressLabel: '',
    syncStatus: 'synced',
    createdAt: updatedAt,
    updatedAt,
    transcript: [],
    quiz: [],
    markers: [],
    ...extra,
  } as StudyMaterial;
}

describe('verdictTone', () => {
  it('follows the four score bands', () => {
    expect(verdictTone(4.5)).toBe('positive');
    expect(verdictTone(3.5)).toBe('info');
    expect(verdictTone(2.5)).toBe('neutral');
    expect(verdictTone(2.4)).toBe('warning');
  });
});

describe('lensRowMeta', () => {
  it('joins subject and date with slashes and adds the count past one', () => {
    expect(lensRowMeta('인공지능 개론', '9월 7일', 2)).toBe('인공지능 개론 / 9월 7일 / 평가 2회');
    expect(lensRowMeta('인공지능 개론', '오늘', 1)).toBe('인공지능 개론 / 오늘');
    expect(lensRowMeta('폴더 없음', '어제', undefined)).toBe('폴더 없음 / 어제');
  });
});

describe('lensFailure', () => {
  it('gives the server refusal its own title and keeps the reason', () => {
    const refusal = Object.assign(new Error('말한 내용이 너무 짧아 평가할 수 없어요.'), {
      code: 'LENS_INSUFFICIENT',
    });
    expect(lensFailure(refusal)).toEqual({
      title: '아직 평가할 수 없어요',
      message: '말한 내용이 너무 짧아 평가할 수 없어요.',
    });
  });

  it('treats everything else as a failure to start', () => {
    expect(lensFailure(new Error('연결하지 못했어요.'))).toEqual({
      title: '평가를 시작하지 못했어요',
      message: '연결하지 못했어요.',
    });
    expect(lensFailure(undefined).message).toBe(
      '평가를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
  });
});

describe('lensHome', () => {
  const older = material('older', '2026-09-01T09:00:00.000Z', {
    lensReport: { ...REPORT, overall: 3.5 },
  });
  const newer = material('newer', '2026-09-04T09:00:00.000Z', { lensReport: REPORT });
  const running = material('running', '2026-09-05T09:00:00.000Z');
  const plain = material('plain', '2026-09-03T09:00:00.000Z');
  const processing = material('processing', '2026-09-02T09:00:00.000Z', {
    status: 'transcribing',
  });

  it('features the newest report and lists every report, running ones first', () => {
    const home = lensHome([older, newer, running, plain], ['running']);
    expect(home.latest?.id).toBe('newer');
    expect(home.rows.map((row) => row.id)).toEqual(['running', 'newer', 'older']);
    expect(home.reportCount).toBe(2);
  });

  it('orders by the evaluation date rather than the material date', () => {
    const reEvaluated = material('re-evaluated', '2026-08-20T09:00:00.000Z', {
      lensReport: REPORT,
      lensEvaluatedAt: '2026-09-06T09:00:00.000Z',
      lensCount: 2,
    });
    const home = lensHome([older, newer, reEvaluated], []);
    expect(lensEvaluatedAt(reEvaluated)).toBe('2026-09-06T09:00:00.000Z');
    expect(lensEvaluatedAt(older)).toBe('2026-09-01T09:00:00.000Z');
    expect(home.latest?.id).toBe('re-evaluated');
    expect(home.rows.map((row) => row.id)).toEqual(['re-evaluated', 'newer', 'older']);
    expect(home.history.map((entry) => entry.updatedAt)).toEqual([
      '2026-09-01T09:00:00.000Z',
      '2026-09-04T09:00:00.000Z',
      '2026-09-06T09:00:00.000Z',
    ]);
  });

  it('orders the trend oldest first', () => {
    const home = lensHome([newer, older], []);
    expect(home.history.map((entry) => entry.id)).toEqual(['older', 'newer']);
    expect(home.history.map((entry) => entry.overall)).toEqual([3.5, 4.1]);
  });

  it('has no featured card before the first report finishes', () => {
    const home = lensHome([running, plain], ['running']);
    expect(home.latest).toBeNull();
    expect(home.rows.map((row) => row.id)).toEqual(['running']);
    expect(home.history).toEqual([]);
  });

  it('shows a report being redone as running, not twice', () => {
    const home = lensHome([older, newer], ['older']);
    expect(home.rows.map((row) => row.id)).toEqual(['older', 'newer']);
  });

  it('offers only ready materials that are not being evaluated', () => {
    const home = lensHome([older, newer, running, plain, processing], ['running']);
    expect(home.candidates.map((row) => row.id)).toEqual(['newer', 'plain', 'older']);
  });

  it('never offers a document, which has no speech to score', () => {
    const pdf = material('pdf', '2026-09-07T09:00:00.000Z', {
      source: {
        kind: 'document',
        origin: 'import',
        uri: 'file://pdf',
      } as StudyMaterial['source'],
    });
    const home = lensHome([plain, pdf], []);
    expect(home.candidates.map((row) => row.id)).toEqual(['plain']);
  });

  it('drops the tips once enough reports exist', () => {
    expect(lensHome([], []).showTips).toBe(true);
    expect(lensHome([older, newer], []).showTips).toBe(true);
    const many = Array.from({ length: TIPS_UNTIL }, (_, index) =>
      material(`report-${index}`, `2026-09-0${index + 1}T09:00:00.000Z`, { lensReport: REPORT }),
    );
    expect(lensHome(many, []).showTips).toBe(false);
  });

  it('hides the 지난 평가 list when it would only repeat the featured card', () => {
    const home = lensHome(
      [material('a', '2026-09-01T00:00:00.000Z', { lensReport: REPORT })],
      [],
    );
    expect(home.rows).toHaveLength(1);
    expect(home.showRows).toBe(false);
  });

  it('shows the list once a second evaluation exists', () => {
    const home = lensHome(
      [
        material('a', '2026-09-01T00:00:00.000Z', { lensReport: REPORT }),
        material('b', '2026-08-20T00:00:00.000Z', { lensReport: REPORT }),
      ],
      [],
    );
    expect(home.showRows).toBe(true);
  });

  it('shows the list for an evaluation still running', () => {
    const home = lensHome(
      [
        material('a', '2026-09-01T00:00:00.000Z', { lensReport: REPORT }),
        material('b', '2026-09-02T00:00:00.000Z'),
      ],
      ['b'],
    );
    expect(home.showRows).toBe(true);
  });
});
