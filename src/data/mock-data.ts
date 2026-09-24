import type {
  AppSettings,
  LensReport,
  PersistedAppSnapshot,
  Project,
  ShareRoom,
  StudyMaterial,
} from '../types';

/**
 * A five-page PDF, as the server hands one back: page N carries `startMs`
 * (N - 1) * 1000 and no speaker, because nobody spoke it.
 */
const DOC_PAGES = [
  {
    id: 'seg-doc-1',
    startMs: 0,
    endMs: 999,
    text: '지도학습이란 무엇인가. 지도학습은 입력과 정답이 짝지어진 데이터를 반복해서 보면서 둘 사이의 관계를 배우는 방식이다. 사람이 미리 정답을 달아 둔 데이터가 필요하다는 점이 다른 방식과 갈라지는 지점이다. 사진과 그 사진이 고양이인지 개인지가 함께 주어지면, 모델은 어떤 특징이 어느 쪽 답과 이어지는지를 스스로 찾아 나간다. 학습이 끝나면 정답이 없는 새 사진에도 답을 내놓을 수 있게 된다.',
    summary:
      '지도학습이 무엇인지, 왜 정답이 달린 데이터가 필요한지를 고양이와 개 사진 예시로 설명해요.',
  },
  {
    id: 'seg-doc-2',
    startMs: 1_000,
    endMs: 1_999,
    text: '분류와 회귀. 지도학습은 맞혀야 하는 답의 생김새에 따라 둘로 나뉜다. 분류는 답이 범주일 때 쓰고, 회귀는 답이 숫자일 때 쓴다. 메일이 스팸인지 아닌지를 가리는 것은 분류이고, 내일 기온이 몇 도일지를 맞히는 것은 회귀다. 같은 데이터라도 무엇을 묻느냐에 따라 둘 중 어느 쪽인지가 달라진다. 집값이 얼마인지 묻는 것은 회귀지만, 비싼지 싼지를 묻는 것은 분류다.',
    summary:
      '분류는 범주를, 회귀는 숫자를 맞힌다는 차이를 스팸 메일과 기온 예측으로 나눠 설명해요.',
  },
  {
    id: 'seg-doc-3',
    startMs: 2_000,
    endMs: 2_999,
    text: '훈련 데이터와 검증 데이터. 가진 데이터를 전부 학습에 쓰면 모델이 잘하는지 알 방법이 없다. 시험 문제를 미리 알려 주고 시험을 보는 것과 같기 때문이다. 그래서 데이터를 훈련용과 검증용으로 나누고, 검증용은 학습이 끝날 때까지 손대지 않는다. 보통 훈련에 70~80퍼센트를 쓰고 나머지를 남겨 둔다. 검증 데이터에서의 성능이 실제로 기대할 수 있는 성능이다.',
    summary:
      '데이터를 훈련용과 검증용으로 나누는 이유와 보통 쓰는 7대 3 비율을 다뤄요.',
  },
  {
    id: 'seg-doc-4',
    startMs: 3_000,
    endMs: 3_999,
    text: '과적합을 알아채는 법. 과적합은 모델이 훈련 데이터를 외워 버린 상태다. 훈련 데이터에서는 거의 다 맞히는데 검증 데이터에서는 눈에 띄게 못 맞히면 과적합을 의심해야 한다. 학습을 진행하면서 두 성능을 함께 그려 보면, 훈련 성능은 계속 오르는데 검증 성능이 어느 지점부터 떨어지기 시작하는 것이 보인다. 그 지점이 학습을 멈춰야 하는 곳이다.',
    summary:
      '훈련 성능은 오르는데 검증 성능이 떨어지는 지점이 과적합이라고 설명해요.',
  },
  {
    id: 'seg-doc-5',
    startMs: 4_000,
    endMs: 4_999,
    text: '정확도만 보면 안 되는 이유. 답이 한쪽으로 크게 치우친 데이터에서는 정확도가 성능을 속인다. 천 명 중 열 명만 병에 걸린 데이터라면, 전부 건강하다고 답하는 모델도 정확도가 99퍼센트다. 정작 찾아내야 할 열 명은 한 명도 못 찾았는데도 그렇다. 그래서 이런 데이터에서는 실제 환자 중 몇 명을 찾아냈는지, 환자라고 답한 사람 중 몇 명이 진짜였는지를 함께 봐야 한다.',
    summary:
      '천 명 중 열 명만 환자인 예로, 정확도만 보면 안 되는 이유를 보여줘요.',
  },
];

const AI_TRANSCRIPT = [
  {
    id: 'seg-ai-1',
    startMs: 72_000,
    endMs: 111_000,
    speaker: '화자 1',
    text: '오늘은 인공지능과 머신러닝의 차이부터 시작하겠습니다. 인공지능은 더 큰 범주이고, 머신러닝은 데이터로 규칙을 학습하는 한 방법입니다.',
  },
  {
    id: 'seg-ai-2',
    startMs: 402_000,
    endMs: 448_000,
    speaker: '화자 1',
    text: '이 부분은 시험에도 자주 나오는 중요한 내용입니다. 지도학습에서는 입력과 정답이 함께 있는 데이터를 사용하고, 모델은 예측과 정답의 차이를 줄이는 방향으로 학습합니다.',
    isImportant: true,
  },
  {
    id: 'seg-ai-3',
    startMs: 751_000,
    endMs: 798_000,
    speaker: '화자 1',
    text: '분류는 범주를, 회귀는 연속된 수치를 예측합니다. 스팸 메일 판별은 분류이고 주택 가격 예측은 회귀입니다.',
  },
  {
    id: 'seg-ai-4',
    startMs: 1_694_000,
    endMs: 1_746_000,
    speaker: '화자 1',
    text: '여기는 꼭 기억해야 합니다. 학습 데이터에만 지나치게 맞춘 상태를 과적합이라고 하며, 검증 데이터를 따로 두는 이유가 여기에 있습니다.',
    isImportant: true,
  },
  {
    id: 'seg-ai-5',
    startMs: 2_238_000,
    endMs: 2_290_000,
    speaker: '화자 1',
    text: '정확도 하나만으로 모델을 판단하면 안 됩니다. 문제의 비용에 따라 정밀도와 재현율을 함께 봐야 합니다.',
  },
] as const;

/** The demo 발표 평가, and the weaker first attempt kept in its history. */
const LENS_AI_INTRO: LensReport = {
  overall: 4.1,
  rubric: [
  {
    key: 'structure',
    label: '구조',
    score: 4.3,
    evidence: '인공지능과 머신러닝의 관계를 큰 범주에서 세부 개념 순서로 설명했어요.',
  },
  {
    key: 'clarity',
    label: '명료성',
    score: 4.1,
    evidence: '분류와 회귀를 스팸 판별과 주택 가격 사례로 구분했어요.',
  },
  {
    key: 'evidence',
    label: '근거 활용',
    score: 3.8,
    evidence: '평가 지표의 필요성은 설명했지만 선택 기준을 더 구체화할 수 있어요.',
  },
  {
    key: 'delivery',
    label: '전달력',
    score: 4,
    evidence: '중요한 개념을 명시적으로 강조해 흐름을 따라가기 쉬웠어요.',
  },
  ],
  strengths: [
  {
    text: '지도학습의 정의 뒤에 학습 과정을 바로 연결해 개념의 쓰임을 분명히 했어요.',
    sourceStartMs: 402_000,
  },
  {
    text: '분류와 회귀를 일상적인 예시로 대비해 차이를 이해하기 쉬웠어요.',
    sourceStartMs: 751_000,
  },
  ],
  improvements: [
  {
    text: '평가 지표가 달라지는 조건을 질문으로 먼저 환기하면 선택 기준이 더 선명해져요.',
    sourceStartMs: 2_238_000,
    action: '놓치면 더 큰 비용이 드는 오류가 무엇인지 먼저 정하고, 정밀도와 재현율을 비교해요.',
  },
  ],
  priority: {
  text: '정확도에서 정밀도, 재현율로 넘어가기 전에 판단 기준이 한 문장으로 먼저 나오면 좋아요.',
  sourceStartMs: 2_238_000,
  action: '오류 비용을 먼저 정한 뒤 두 지표를 비교해요.',
  },
  };

const LENS_AI_INTRO_FIRST: LensReport = {
  overall: 3.2,
  rubric: [
  {
    key: 'structure',
    label: '구조',
    score: 3.4,
    evidence: '인공지능과 머신러닝의 관계를 큰 범주에서 세부 개념 순서로 설명했어요.',
  },
  {
    key: 'clarity',
    label: '명료성',
    score: 3.1,
    evidence: '분류와 회귀를 스팸 판별과 주택 가격 사례로 구분했어요.',
  },
  {
    key: 'evidence',
    label: '근거 활용',
    score: 2.9,
    evidence: '평가 지표의 필요성은 설명했지만 선택 기준을 더 구체화할 수 있어요.',
  },
  {
    key: 'delivery',
    label: '전달력',
    score: 3.4,
    evidence: '중요한 개념을 명시적으로 강조해 흐름을 따라가기 쉬웠어요.',
  },
  ],
  strengths: [
  {
    text: '지도학습의 정의 뒤에 학습 과정을 바로 연결해 개념의 쓰임을 분명히 했어요.',
    sourceStartMs: 402_000,
  },
  {
    text: '분류와 회귀를 일상적인 예시로 대비해 차이를 이해하기 쉬웠어요.',
    sourceStartMs: 751_000,
  },
  ],
  improvements: [
  {
    text: '평가 지표가 달라지는 조건을 질문으로 먼저 환기하면 선택 기준이 더 선명해져요.',
    sourceStartMs: 2_238_000,
    action: '놓치면 더 큰 비용이 드는 오류가 무엇인지 먼저 정하고, 정밀도와 재현율을 비교해요.',
  },
  ],
  priority: {
  text: '정확도에서 정밀도, 재현율로 넘어가기 전에 판단 기준이 한 문장으로 먼저 나오면 좋아요.',
  sourceStartMs: 2_238_000,
  action: '오류 비용을 먼저 정한 뒤 두 지표를 비교해요.',
  },
  };

export const mockMaterials: StudyMaterial[] = [
  {
    id: 'material-ai-intro-01',
    projectId: 'project-ai-intro',
    title: '5주차, 지도학습의 원리',
    source: {
      uri: 'mock://recordings/ai-intro-week-5.m4a',
      fileName: '인공지능개론_5주차.m4a',
      mimeType: 'audio/mp4',
      kind: 'audio',
      origin: 'recording',
      sizeBytes: 50_112_000,
      durationMs: 3_134_000,
    },
    status: 'ready',
    progress: 1,
    progressLabel: '마인드팩 준비 완료',
    syncStatus: 'synced',
    serverRecordingId: 'sample-ai-video',
    createdAt: '2026-08-31T01:10:00.000Z',
    updatedAt: '2026-08-31T02:08:00.000Z',
    transcript: AI_TRANSCRIPT.map((segment) => ({ ...segment })),
    note: {
      summary:
        '지도학습의 기본 구조를 분류와 회귀 사례로 살펴보고, 학습 데이터 분리와 과적합 방지, 평가 지표 선택까지 이어지는 강의예요.',
      keyPoints: [
        '지도학습은 입력과 정답의 관계를 데이터에서 학습한다.',
        '분류는 범주를, 회귀는 연속값을 예측한다.',
        '훈련 데이터와 검증 데이터를 분리해 일반화 성능을 확인한다.',
        '불균형 데이터에서는 정확도 외 지표도 함께 확인한다.',
      ],
      concepts: [
        {
          id: 'concept-supervised',
          term: '지도학습',
          description: '입력 데이터와 정답 레이블의 대응 관계를 학습하는 방식',
          sourceStartMs: 402_000,
          difficulty: 'basic',
        },
        {
          id: 'concept-overfit',
          term: '과적합',
          description: '훈련 데이터에는 잘 맞지만 새로운 데이터에는 성능이 낮은 상태',
          sourceStartMs: 1_694_000,
          difficulty: 'intermediate',
        },
        {
          id: 'concept-recall',
          term: '재현율',
          description: '실제 양성 가운데 모델이 양성으로 찾아낸 비율',
          sourceStartMs: 2_238_000,
          difficulty: 'intermediate',
        },
      ],
      estimatedReviewMinutes: 5,
      teacherVerified: true,
      updatedAt: '2026-08-31T02:08:00.000Z',
    },
    outline: [
      {
        heading: '인공지능과 머신러닝의 관계',
        startMs: 72_000,
        body: '인공지능은 사람의 지능을 흉내 내는 기술 전체를 가리키는 큰 범주예요. 머신러닝은 그 안에서 데이터로 규칙을 스스로 찾아내는 방법이에요. 그래서 모든 머신러닝은 인공지능이지만, 모든 인공지능이 머신러닝인 것은 아니에요. 이 관계를 먼저 잡아 두면 뒤에 나오는 개념들이 어디에 속하는지 헷갈리지 않아요.',
      },
      {
        heading: '지도학습이 배우는 방식',
        startMs: 402_000,
        body: '지도학습은 입력과 정답이 짝으로 있는 데이터를 사용해요. 모델은 예측을 내놓고, 정답과 얼마나 차이 나는지 확인해요. 그 차이를 줄이는 방향으로 내부 값을 조금씩 고쳐 나가요. 이 과정을 반복하면 처음 보는 입력에도 답을 낼 수 있게 돼요. 시험에 자주 나오는 구간이니 학습 순서를 그대로 기억해 두세요.',
      },
      {
        heading: '분류와 회귀의 차이',
        startMs: 751_000,
        body: '분류는 정해진 범주 가운데 하나를 고르는 문제예요. 스팸 메일인지 아닌지 판별하는 일이 여기에 해당해요. 회귀는 연속된 수치를 예측하는 문제예요. 주택 가격처럼 값이 이어지는 대상을 다룰 때 씁니다. 무엇을 예측하려는지에 따라 모델과 평가 방법이 함께 달라져요.',
      },
      {
        heading: '과적합과 검증 데이터',
        startMs: 1_694_000,
        body: '학습 데이터에만 지나치게 맞춰진 상태를 과적합이라고 해요. 이때는 훈련 성적만 좋고 새로운 데이터에서는 성능이 떨어져요. 그래서 데이터를 훈련용과 검증용으로 나누어 일반화 성능을 확인해요. 정확도 하나만 보지 않고 정밀도와 재현율을 함께 보는 이유도 같아요. 어떤 오류가 더 큰 비용을 만드는지 정한 뒤 지표를 골라야 해요.',
      },
    ],
    quiz: [
      {
        id: 'quiz-ai-1',
        type: 'multiple-choice',
        concept: '지도학습',
        prompt: '지도학습 데이터에 반드시 함께 있어야 하는 것은 무엇인가요?',
        choices: ['정답 레이블', '무작위 잡음', '군집 개수', '보상 함수'],
        correctChoiceIndex: 0,
        explanation: '지도학습은 입력과 정답 레이블의 관계를 학습해요.',
        sourceStartMs: 402_000,
      },
      {
        id: 'quiz-ai-2',
        type: 'multiple-choice',
        concept: '분류와 회귀',
        prompt: '다음 중 회귀 문제에 해당하는 것은 무엇인가요?',
        choices: ['스팸 여부 판별', '강아지 품종 판별', '주택 가격 예측', '문서 주제 분류'],
        correctChoiceIndex: 2,
        explanation: '가격처럼 연속된 수치를 예측하는 문제는 회귀예요.',
        sourceStartMs: 751_000,
      },
      {
        id: 'quiz-ai-3',
        type: 'true-false',
        concept: '과적합',
        prompt: '훈련 데이터의 정확도가 높으면 새로운 데이터에서도 항상 잘 작동한다.',
        choices: ['맞아요', '아니에요'],
        correctChoiceIndex: 1,
        explanation: '과적합된 모델은 훈련 성능은 높아도 새로운 데이터에서는 성능이 낮을 수 있어요.',
        sourceStartMs: 1_694_000,
      },
      {
        id: 'quiz-ai-4',
        type: 'multiple-choice',
        concept: '평가 지표',
        prompt: '실제 양성을 놓치지 않는 것이 특히 중요할 때 우선 확인할 지표는?',
        choices: ['재현율', '학습 시간', '파라미터 수', '파일 크기'],
        correctChoiceIndex: 0,
        explanation: '재현율은 실제 양성 중 모델이 찾아낸 비율이에요.',
        sourceStartMs: 2_238_000,
      },
      {
        id: 'quiz-ai-5',
        type: 'true-false',
        concept: '검증 데이터',
        prompt: '검증 데이터는 모델의 일반화 성능을 점검하는 데 사용한다.',
        choices: ['맞아요', '아니에요'],
        correctChoiceIndex: 0,
        explanation: '학습에 직접 쓰지 않은 데이터로 성능을 점검해야 과적합을 발견할 수 있어요.',
        sourceStartMs: 1_694_000,
      },
    ],
    lensReport: LENS_AI_INTRO,
    // Two evaluations of the same recording, so 평가 이력 has something to show.
    lensEvaluatedAt: '2026-09-04T10:20:00.000Z',
    lensCount: 2,
    lensHistory: [
      {
        id: 'lens-ai-intro-2',
        evaluatedAt: '2026-09-04T10:20:00.000Z',
        report: LENS_AI_INTRO,
      },
      {
        id: 'lens-ai-intro-1',
        evaluatedAt: '2026-08-30T09:05:00.000Z',
        report: LENS_AI_INTRO_FIRST,
      },
    ],
    markers: [
      {
        id: 'marker-ai-1',
        timestampMs: 402_000,
        label: '시험에 나오는 지도학습 정의',
        source: 'ai',
        confidence: 0.92,
        reason: '시험에 나온다는 말과 중요하다는 강조를 감지했어요.',
        evidenceText: '이 부분은 시험에도 자주 나오는 중요한 내용입니다.',
      },
      {
        id: 'marker-ai-2',
        timestampMs: 1_694_000,
        label: '과적합 설명',
        source: 'ai',
        confidence: 0.88,
        reason: '꼭 기억하라는 강조를 감지했어요.',
        evidenceText: '여기는 꼭 기억해야 합니다.',
      },
      {
        id: 'marker-ai-3',
        timestampMs: 2_238_000,
        label: '평가 지표 비교',
        source: 'ai',
        confidence: 0.76,
        reason: '핵심 개념인 재현율의 근거 시점과 겹쳐요.',
        evidenceText: '정확도 하나만으로 모델을 판단하면 안 됩니다.',
      },
    ],
  },
  {
    id: 'material-ai-intro-02',
    projectId: 'project-ai-intro',
    title: '6주차, 신경망 맛보기',
    source: {
      uri: 'mock://recordings/ai-intro-week-6.m4a',
      fileName: '인공지능개론_6주차.m4a',
      mimeType: 'audio/mp4',
      kind: 'audio',
      origin: 'recording',
      sizeBytes: 44_980_000,
      durationMs: 2_811_000,
    },
    status: 'generating',
    progress: 0.72,
    progressLabel: '문제를 만들고 있어요',
    syncStatus: 'synced',
    serverRecordingId: 'sample-neural-video',
    createdAt: '2026-09-02T00:20:00.000Z',
    updatedAt: '2026-09-02T00:58:00.000Z',
    transcript: AI_TRANSCRIPT.slice(0, 3).map((segment, index) => ({
      ...segment,
      id: `seg-neural-${index + 1}`,
    })),
    quiz: [],
    markers: [
      {
        id: 'marker-neural-1',
        timestampMs: 1_124_000,
        label: '활성화 함수 비교',
        source: 'teacher',
      },
    ],
  },
  {
    id: 'material-data-01',
    projectId: 'project-data-lab',
    title: '시각화 실습, 좋은 그래프의 조건',
    source: {
      uri: 'mock://imports/data-visualization.mp4',
      fileName: '데이터시각화_실습.mp4',
      mimeType: 'video/mp4',
      kind: 'video',
      origin: 'import',
      sizeBytes: 184_300_000,
      durationMs: 2_086_000,
    },
    status: 'ready',
    progress: 1,
    progressLabel: '마인드팩 준비 완료',
    syncStatus: 'local-only',
    createdAt: '2026-08-28T05:00:00.000Z',
    updatedAt: '2026-08-28T05:39:00.000Z',
    transcript: [
      {
        id: 'seg-data-1',
        startMs: 86_000,
        endMs: 132_000,
        speaker: '화자 1',
        text: '여기서 핵심은 그래프를 고르기 전에 비교, 분포, 관계 중 무엇을 보여주려는지 먼저 정하는 것입니다.',
        isImportant: true,
      },
      {
        id: 'seg-data-2',
        startMs: 624_000,
        endMs: 681_000,
        speaker: '화자 1',
        text: '막대그래프의 축을 중간에서 자르면 작은 차이가 과장될 수 있으므로 독자가 오해하지 않도록 표시해야 합니다.',
      },
    ],
    note: {
      summary: '데이터의 목적에 맞는 차트를 고르고 축, 색상, 주석으로 왜곡 없이 메시지를 전달하는 실습이에요.',
      keyPoints: ['메시지를 먼저 정한 뒤 차트를 고른다.', '축과 색상은 차이를 과장하지 않아야 한다.', '제목은 관찰 결과를 구체적으로 말한다.'],
      concepts: [
        {
          id: 'concept-chart-purpose',
          term: '차트 선택',
          description: '비교, 분포, 관계 등 전달 목적에 맞춰 시각화 방식을 선택하는 과정',
          sourceStartMs: 86_000,
          difficulty: 'basic',
        },
      ],
      estimatedReviewMinutes: 4,
      teacherVerified: false,
      updatedAt: '2026-08-28T05:39:00.000Z',
    },
    quiz: [
      {
        id: 'quiz-data-1',
        type: 'multiple-choice',
        concept: '차트 선택',
        prompt: '여러 집단의 값 크기를 비교할 때 가장 먼저 고려할 차트는?',
        choices: ['막대그래프', '산점도', '히트맵', '워드클라우드'],
        correctChoiceIndex: 0,
        explanation: '범주별 값의 크기를 비교할 때는 막대그래프가 가장 직접적이에요.',
        sourceStartMs: 86_000,
      },
    ],
    markers: [
      {
        id: 'marker-data-1',
        timestampMs: 86_000,
        label: '차트를 고르는 기준',
        source: 'ai',
        confidence: 0.84,
        reason: '핵심이라는 표현을 감지했어요.',
        evidenceText: '여기서 핵심은 그래프를 고르기 전에 전달 목적을 정하는 것입니다.',
      },
    ],
  },
  {
    id: 'material-edu-01',
    projectId: 'project-education',
    title: '학습 동기와 자기효능감 세미나',
    source: {
      uri: 'mock://imports/education-seminar.m4a',
      fileName: '교육심리학_세미나.m4a',
      mimeType: 'audio/mp4',
      kind: 'audio',
      origin: 'import',
      sizeBytes: 36_200_000,
      durationMs: 2_260_000,
    },
    status: 'imported',
    progress: 0,
    progressLabel: '기기에 저장됨',
    syncStatus: 'local-only',
    createdAt: '2026-09-01T06:30:00.000Z',
    updatedAt: '2026-09-01T06:30:00.000Z',
    transcript: [],
    quiz: [],
    markers: [],
  },
  {
    // The demo tour had no PDF in it, so the one feature people ask about
    // most was invisible until they signed up. Pages are numbered into
    // `startMs` exactly as the server does it: page 1 is 0, page 2 is 1000.
    id: 'material-ai-doc-01',
    projectId: 'project-ai-intro',
    title: '지도학습 강의자료 (PDF)',
    source: {
      uri: 'mock://imports/supervised-learning-slides.pdf',
      fileName: '인공지능개론_지도학습.pdf',
      mimeType: 'application/pdf',
      kind: 'document',
      origin: 'import',
      sizeBytes: 2_480_000,
    },
    status: 'ready',
    progress: 1,
    progressLabel: '마인드팩 준비 완료',
    syncStatus: 'synced',
    createdAt: '2026-09-02T04:00:00.000Z',
    updatedAt: '2026-09-02T04:03:00.000Z',
    transcript: DOC_PAGES.map((segment) => ({ ...segment })),
    note: {
      summary:
        '지도학습이 무엇인지부터 분류와 회귀의 차이, 데이터를 훈련용과 검증용으로 나누는 이유, 과적합을 알아채는 방법까지 다섯 쪽에 걸쳐 정리한 강의자료예요. 마지막 쪽은 정확도만 보면 안 되는 경우를 다뤄요.',
      keyPoints: [
        '지도학습은 입력과 정답이 짝지어진 데이터에서 둘 사이의 관계를 배운다.',
        '분류는 범주를 맞히고, 회귀는 숫자를 맞힌다.',
        '훈련 데이터와 검증 데이터를 나눠야 처음 보는 데이터에서의 성능을 알 수 있다.',
        '훈련 성능만 오르고 검증 성능이 떨어지면 과적합이다.',
        '한쪽 답이 대부분인 데이터에서는 정확도가 성능을 속인다.',
      ],
      concepts: [
        {
          id: 'concept-doc-supervised',
          term: '지도학습',
          description: '입력과 정답이 짝지어진 데이터로 둘 사이의 관계를 배우는 방식',
          sourceStartMs: 0,
          difficulty: 'basic',
        },
        {
          id: 'concept-doc-split',
          term: '데이터 분리',
          description: '가진 데이터를 훈련용과 검증용으로 나눠 일반화 성능을 재는 절차',
          sourceStartMs: 2_000,
          difficulty: 'basic',
        },
        {
          id: 'concept-doc-overfit',
          term: '과적합',
          description: '훈련 데이터는 잘 맞히지만 새 데이터에서는 성능이 떨어지는 상태',
          sourceStartMs: 3_000,
          difficulty: 'intermediate',
        },
      ],
      estimatedReviewMinutes: 9,
      teacherVerified: false,
      updatedAt: '2026-09-02T04:03:00.000Z',
    },
    outline: [
      {
        heading: '지도학습이란 무엇인가',
        startMs: 0,
        body: '지도학습은 입력과 정답이 짝지어진 데이터를 반복해서 보면서 둘 사이의 관계를 배우는 방식이에요. 사람이 미리 정답을 달아 둔 데이터가 필요하다는 점이 다른 방식과 갈라지는 지점이에요. 사진과 그 사진이 고양이인지 개인지가 함께 주어지면, 모델은 어떤 특징이 어느 쪽 답과 이어지는지를 스스로 찾아 나가요. 학습이 끝나면 정답이 없는 새 사진에도 답을 내놓을 수 있게 돼요.',
      },
      {
        heading: '분류와 회귀',
        startMs: 1_000,
        body: '지도학습은 맞혀야 하는 답의 생김새에 따라 둘로 나뉘어요. 분류는 답이 범주일 때 쓰고, 회귀는 답이 숫자일 때 써요. 메일이 스팸인지 아닌지를 가리는 것은 분류이고, 내일 기온이 몇 도일지를 맞히는 것은 회귀예요. 같은 데이터라도 무엇을 묻느냐에 따라 둘 중 어느 쪽인지가 달라져요. 집값을 얼마인지 묻는 것은 회귀지만, 비싼지 싼지를 묻는 것은 분류예요.',
      },
      {
        heading: '훈련 데이터와 검증 데이터',
        startMs: 2_000,
        body: '가진 데이터를 전부 학습에 쓰면 모델이 잘하는지 알 방법이 없어요. 시험 문제를 미리 알려 주고 시험을 보는 것과 같기 때문이에요. 그래서 데이터를 훈련용과 검증용으로 나누고, 검증용은 학습이 끝날 때까지 손대지 않아요. 보통 훈련에 70~80퍼센트를 쓰고 나머지를 남겨 둬요. 검증 데이터에서의 성능이 우리가 실제로 기대할 수 있는 성능이에요.',
      },
      {
        heading: '과적합을 알아채는 법',
        startMs: 3_000,
        body: '과적합은 모델이 훈련 데이터를 외워 버린 상태예요. 훈련 데이터에서는 거의 다 맞히는데 검증 데이터에서는 눈에 띄게 못 맞히면 과적합을 의심해야 해요. 학습을 진행하면서 두 성능을 함께 그려 보면, 훈련 성능은 계속 오르는데 검증 성능이 어느 지점부터 떨어지기 시작하는 것이 보여요. 그 지점이 학습을 멈춰야 하는 곳이에요.',
      },
      {
        heading: '정확도만 보면 안 되는 이유',
        startMs: 4_000,
        body: '답이 한쪽으로 크게 치우친 데이터에서는 정확도가 성능을 속여요. 천 명 중 열 명만 병에 걸린 데이터라면, 전부 건강하다고 답하는 모델도 정확도가 99퍼센트예요. 정작 찾아내야 할 열 명은 한 명도 못 찾았는데도요. 그래서 이런 데이터에서는 실제 환자 중 몇 명을 찾아냈는지, 환자라고 답한 사람 중 몇 명이 진짜였는지를 함께 봐야 해요.',
      },
    ],
    quiz: [
      {
        id: 'quiz-doc-01',
        type: 'multiple-choice',
        concept: '지도학습',
        prompt: '지도학습에 반드시 필요한 것은 무엇인가요?',
        choices: [
          '입력과 정답이 짝지어진 데이터',
          '정답이 없는 대량의 데이터',
          '사람의 실시간 개입',
          '데이터를 나누지 않은 전체 집합',
        ],
        correctChoiceIndex: 0,
        explanation:
          '지도학습은 사람이 미리 정답을 달아 둔 데이터가 있어야 입력과 정답의 관계를 배울 수 있어요.',
        sourceStartMs: 0,
      },
      {
        id: 'quiz-doc-02',
        type: 'multiple-choice',
        concept: '분류와 회귀',
        prompt: '내일 기온이 몇 도일지 맞히는 문제는 어디에 해당하나요?',
        choices: ['회귀', '분류', '군집화', '차원 축소'],
        correctChoiceIndex: 0,
        explanation: '맞혀야 하는 답이 숫자이므로 회귀예요. 범주를 맞히면 분류예요.',
        sourceStartMs: 1_000,
      },
      {
        id: 'quiz-doc-03',
        type: 'multiple-choice',
        concept: '데이터 분리',
        prompt: '검증 데이터를 학습에 쓰지 않고 남겨 두는 이유는 무엇인가요?',
        choices: [
          '처음 보는 데이터에서의 성능을 재기 위해',
          '학습 속도를 높이기 위해',
          '데이터 용량을 줄이기 위해',
          '정답을 지우기 위해',
        ],
        correctChoiceIndex: 0,
        explanation:
          '학습에 쓴 데이터로 성능을 재면 시험 문제를 미리 알려 준 셈이라, 실제 성능을 알 수 없어요.',
        sourceStartMs: 2_000,
      },
      {
        id: 'quiz-doc-04',
        type: 'multiple-choice',
        concept: '과적합',
        prompt: '과적합이 일어나고 있다는 가장 분명한 신호는 무엇인가요?',
        choices: [
          '훈련 성능은 오르는데 검증 성능이 떨어진다',
          '훈련 성능과 검증 성능이 함께 오른다',
          '두 성능이 모두 낮게 유지된다',
          '학습이 시작되지 않는다',
        ],
        correctChoiceIndex: 0,
        explanation:
          '모델이 훈련 데이터를 외워 버리면 훈련 성능만 계속 오르고 검증 성능은 떨어지기 시작해요.',
        sourceStartMs: 3_000,
      },
      {
        id: 'quiz-doc-05',
        type: 'multiple-choice',
        concept: '평가 지표',
        prompt: '천 명 중 열 명만 환자인 데이터에서 정확도가 위험한 이유는 무엇인가요?',
        choices: [
          '전부 건강하다고 답해도 99퍼센트가 나오기 때문',
          '정확도 계산이 느리기 때문',
          '환자 수가 매일 바뀌기 때문',
          '정확도는 회귀에서만 쓰이기 때문',
        ],
        correctChoiceIndex: 0,
        explanation:
          '답이 한쪽으로 치우치면 아무것도 못 찾는 모델도 정확도가 높게 나와요. 찾아낸 비율을 함께 봐야 해요.',
        sourceStartMs: 4_000,
      },
    ],
    markers: [],
  },
];

export const mockProjects: Project[] = [
  {
    id: 'project-ai-intro',
    title: '인공지능 개론',
    courseName: '2026학년도 2학기, 컴퓨터공학과',
    description: '매주 강의를 녹음하고 마인드팩으로 복습해요.',
    ownerName: '김프리마인드',
    status: 'processing',
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-09-02T00:58:00.000Z',
    materialIds: ['material-ai-intro-01', 'material-ai-intro-02'],
    memberCount: 1,
    accentColor: '#D25417',
    nextReviewAt: '2026-09-03T00:00:00.000Z',
  },
  {
    id: 'project-data-lab',
    title: '데이터 분석 실습',
    courseName: '사내 데이터 리터러시 과정',
    description: '실습 영상을 올려 개념과 문제로 복습해요.',
    ownerName: '김프리마인드',
    status: 'ready',
    createdAt: '2026-08-22T01:00:00.000Z',
    updatedAt: '2026-08-28T05:39:00.000Z',
    materialIds: ['material-data-01'],
    memberCount: 1,
    accentColor: '#0F8A72',
  },
  {
    id: 'project-education',
    title: '교육심리학 세미나',
    courseName: '교육학과 전공 세미나',
    description: '세미나 녹음을 짧게 정리해서 복습해요.',
    ownerName: '김프리마인드',
    status: 'draft',
    createdAt: '2026-09-01T06:20:00.000Z',
    updatedAt: '2026-09-01T06:30:00.000Z',
    materialIds: ['material-edu-01'],
    memberCount: 1,
    accentColor: '#B9761A',
  },
];

export const mockShareRooms: ShareRoom[] = [
  {
    id: 'share-ai-week-5',
    projectId: 'project-ai-intro',
    materialId: 'material-ai-intro-01',
    title: '인공지능 개론 5주차 마인드팩',
    slug: 'ai-intro-week-5',
    url: 'premind://watch/ai-intro-week-5',
    distribution: 'local-preview',
    status: 'active',
    content: {
      audio: true,
      summary: true,
      keyPoints: true,
      transcript: false,
      quiz: true,
    },
    createdAt: '2026-08-31T03:00:00.000Z',
    participantCount: 31,
    viewCount: 46,
    quizCompletionCount: 24,
    averageQuizScore: 76,
  },
  {
    id: 'share-data-visualization',
    projectId: 'project-data-lab',
    materialId: 'material-data-01',
    title: '좋은 그래프의 조건',
    slug: 'data-visualization-basics',
    url: 'premind://watch/data-visualization-basics',
    distribution: 'local-preview',
    status: 'active',
    content: {
      audio: true,
      summary: true,
      keyPoints: true,
      transcript: true,
      quiz: true,
    },
    createdAt: '2026-08-28T06:10:00.000Z',
    expiresAt: '2026-09-30T14:59:59.000Z',
    participantCount: 17,
    viewCount: 29,
    quizCompletionCount: 14,
    averageQuizScore: 82,
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const defaultAppSettings: AppSettings = {
  mode: 'student',
  notificationsEnabled: false,
  recordingQuality: 'high',
  homeChecklistDismissed: false,
};

/** A real account starts with nothing in it. */
export function createEmptySnapshot(): PersistedAppSnapshot {
  return {
    schemaVersion: 1,
    projects: [],
    materials: [],
    shareRooms: [],
    activeProjectId: null,
    savedMaterialIds: [],
    confusionFeedback: [],
    quizAttempts: [],
    settings: { ...defaultAppSettings },
  };
}

export function createMockSnapshot(): PersistedAppSnapshot {
  return {
    schemaVersion: 1,
    projects: clone(mockProjects),
    materials: clone(mockMaterials),
    shareRooms: clone(mockShareRooms),
    activeProjectId: 'project-ai-intro',
    savedMaterialIds: ['material-ai-intro-01'],
    confusionFeedback: [],
    quizAttempts: [],
    settings: { ...defaultAppSettings },
  };
}
