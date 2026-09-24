import type {
  StudyConcept,
  StudyMaterial,
  TranscriptSegment,
} from '../../types';

/**
 * This version identifies output produced by the on-device text heuristics.
 * It does not identify an AI model or a server-side processing version.
 */
export const LOCAL_HIGHLIGHT_HEURISTIC_VERSION = '2026-09-02.1' as const;

export type LocalHighlightSignal =
  | 'existing-importance-flag'
  | 'explicit-language-cue'
  | 'concept-reference'
  | 'definition-language'
  | 'repetition';

export interface LocalHighlightCandidate {
  /** Makes the non-model origin explicit to future persistence/UI code. */
  source: 'local-heuristic';
  heuristicVersion: typeof LOCAL_HIGHLIGHT_HEURISTIC_VERSION;
  segmentId: string;
  timestampMs: number;
  endMs: number;
  label: string;
  /** Ranking score from 0 to 1. This is not a calibrated probability. */
  confidence: number;
  reasons: string[];
  /** The original transcript sentence that supports the candidate. */
  evidenceSentence: string;
  signals: LocalHighlightSignal[];
  matchedCues: string[];
  matchedConcepts: string[];
  repeatedTerms: string[];
}

export interface GenerateLocalHighlightCandidatesInput {
  transcript: readonly TranscriptSegment[];
  concepts?: readonly Pick<StudyConcept, 'term' | 'sourceStartMs'>[];
  /** Defaults to 12. The best candidates are selected, then returned in time order. */
  maxCandidates?: number;
  /** Defaults to 0.4. Values outside 0...1 are clamped. */
  minimumConfidence?: number;
}

type CueRule = {
  id: string;
  label: string;
  pattern: RegExp;
  confidence: number;
};

type CueMatch = Omit<CueRule, 'pattern'> & {
  text: string;
};

type ConceptMatch = {
  term: string;
  directMention: boolean;
};

const CUE_RULES: readonly CueRule[] = [
  {
    id: 'exam',
    label: '시험, 평가 언급',
    pattern: /시험(?:에|에서|으로)?(?:\s*(?:나오|출제))?|평가에\s*나오/i,
    confidence: 0.65,
  },
  {
    id: 'importance',
    label: '중요하다는 언급',
    pattern: /(?:가장\s*)?중요(?:한|하게|하|합니다|해요|합니다만)?/i,
    confidence: 0.58,
  },
  {
    id: 'memory',
    label: '기억, 암기 요청',
    pattern: /기억(?:해|해야|하|할|하세요|해\s*두)|외워|암기|잊지/i,
    confidence: 0.57,
  },
  {
    id: 'core',
    label: '핵심 언급',
    pattern: /핵심(?:은|이|을|만|입니다|이에요)?/i,
    confidence: 0.56,
  },
  {
    id: 'emphasis',
    label: '강조 표현',
    pattern: /강조(?:하|할|해|합니다|해요)/i,
    confidence: 0.54,
  },
  {
    id: 'summary',
    label: '정리, 요약 신호',
    pattern: /(?:정리|요약)(?:하면|하자면|해\s*보면)/i,
    confidence: 0.52,
  },
  {
    id: 'restatement',
    label: '다시 설명하는 신호',
    pattern: /다시\s*말(?:하면|하자면)|바꾸어\s*말하면/i,
    confidence: 0.5,
  },
  {
    id: 'mandatory',
    label: '필수 확인 요청',
    pattern: /반드시|꼭\s*(?:기억|알아|확인|외워)/i,
    confidence: 0.53,
  },
];

const DEFINITION_LANGUAGE =
  /(?:정의|뜻은|의미(?:는|합니다|해요)?|(?:이|)라고\s*(?:합니다|해요|부릅니다)|(?:개념|용어)(?:은|는)\s)/i;

const INSTRUCTOR_NAMES = ['교수', '강사', '선생', 'teacher', 'instructor', 'lecturer'];

const KOREAN_PARTICLES = [
  '에게서는',
  '으로서는',
  '에서는',
  '으로는',
  '이라고',
  '에게서',
  '부터는',
  '까지는',
  '처럼은',
  '에서는',
  '에게',
  '에서',
  '으로',
  '로서',
  '라고',
  '라도',
  '부터',
  '까지',
  '처럼',
  '보다',
  '마저',
  '조차',
  '만큼',
  '에는',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '과',
  '와',
  '도',
  '에',
  '의',
  '만',
] as const;

const REPETITION_STOP_WORDS = new Set([
  '가장',
  '강의',
  '개념',
  '경우',
  '그리고',
  '기억',
  '내용',
  '다시',
  '다음',
  '대한',
  '됩니다',
  '때문',
  '마지막',
  '말하면',
  '먼저',
  '부분',
  '설명',
  '시험',
  '어떤',
  '오늘',
  '위해',
  '이것',
  '이번',
  '이제',
  '있습니다',
  '있어요',
  '정리하면',
  '정말',
  '중요',
  '하지만',
  '학습',
  '함께',
  '핵심',
  '합니다',
  '해요',
  'and',
  'are',
  'for',
  'from',
  'that',
  'the',
  'this',
  'with',
]);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundedConfidence(value: number): number {
  return Math.round(clamp(value, 0, 0.98) * 100) / 100;
}

function normalizedText(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
}

function unique(values: readonly string[]): string[] {
  const found = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const key = normalizedText(value);
    if (!key || found.has(key)) {
      return;
    }
    found.add(key);
    result.push(value.trim());
  });

  return result;
}

function stripKoreanParticle(token: string): string {
  for (const particle of KOREAN_PARTICLES) {
    if (token.endsWith(particle) && token.length >= particle.length + 2) {
      return token.slice(0, -particle.length);
    }
  }
  return token;
}

function meaningfulTerms(text: string): string[] {
  const rawTerms = normalizedText(text).match(
    /[가-힣]{2,}|[a-z][a-z0-9-]{2,}|\d+(?:\.\d+)?/g,
  );

  if (!rawTerms) {
    return [];
  }

  return unique(
    rawTerms
      .map(stripKoreanParticle)
      .filter((term) => term.length >= 2 && !REPETITION_STOP_WORDS.has(term)),
  );
}

function repeatedTermCounts(
  transcript: readonly TranscriptSegment[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  transcript.forEach((segment) => {
    const termsInSegment = new Set(meaningfulTerms(segment.text));
    termsInSegment.forEach((term) => {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    });
  });

  return counts;
}

function cueMatches(text: string): CueMatch[] {
  return CUE_RULES.flatMap((rule) => {
    const match = rule.pattern.exec(text);
    if (!match?.[0]) {
      return [];
    }
    return [
      {
        confidence: rule.confidence,
        id: rule.id,
        label: rule.label,
        text: match[0].trim(),
      },
    ];
  });
}

function includesConcept(text: string, term: string): boolean {
  const normalizedSource = normalizedText(text);
  const normalizedTerm = normalizedText(term);
  if (!normalizedTerm) {
    return false;
  }

  if (/^[a-z0-9-]+$/i.test(normalizedTerm)) {
    const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(
      normalizedSource,
    );
  }

  return normalizedSource.includes(normalizedTerm);
}

function conceptMatches(
  segment: TranscriptSegment,
  concepts: readonly Pick<StudyConcept, 'term' | 'sourceStartMs'>[],
): ConceptMatch[] {
  const matches = concepts.flatMap((concept) => {
    const term = concept.term.trim();
    if (!term) {
      return [];
    }

    const directMention = includesConcept(segment.text, term);
    const overlapsSource =
      Number.isFinite(concept.sourceStartMs) &&
      concept.sourceStartMs >= segment.startMs &&
      concept.sourceStartMs <= segment.endMs;

    return directMention || overlapsSource ? [{ directMention, term }] : [];
  });

  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = normalizedText(match.term);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isInstructorSpeaker(speaker?: string): boolean {
  if (!speaker) {
    return false;
  }
  const normalizedSpeaker = normalizedText(speaker);
  return INSTRUCTOR_NAMES.some((name) => normalizedSpeaker.includes(name));
}

function transcriptSentences(text: string): string[] {
  return (
    text
      .match(/[^.!?。！？\n]+[.!?。！？]?/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? []
  );
}

function evidenceSentence(
  text: string,
  cues: readonly CueMatch[],
  concepts: readonly ConceptMatch[],
  repeatedTerms: readonly string[],
): string {
  const sentences = transcriptSentences(text);
  if (sentences.length === 0) {
    return text.trim();
  }

  const needles = [
    ...cues.map((cue) => cue.text),
    ...concepts.map((concept) => concept.term),
    ...repeatedTerms,
  ];
  const matched = sentences.find((sentence) =>
    needles.some((needle) => includesConcept(sentence, needle)),
  );

  return matched ?? sentences[0] ?? text.trim();
}

function candidateLabel(
  segment: TranscriptSegment,
  cues: readonly CueMatch[],
  concepts: readonly ConceptMatch[],
  repeatedTerms: readonly string[],
  hasDefinitionLanguage: boolean,
): string {
  const concept = concepts[0]?.term;
  if (concept) {
    return `${concept.slice(0, 32)} 핵심 설명`;
  }
  if (cues[0]) {
    return cues[0].label;
  }
  if (repeatedTerms[0]) {
    return `${repeatedTerms[0].slice(0, 32)} 반복 설명`;
  }
  if (hasDefinitionLanguage) {
    return '개념 정의';
  }
  if (segment.isImportant) {
    return '대본 중요 구간';
  }
  return '중요 구간 후보';
}

function segmentCandidate(
  segment: TranscriptSegment,
  concepts: readonly Pick<StudyConcept, 'term' | 'sourceStartMs'>[],
  repetitions: ReadonlyMap<string, number>,
): LocalHighlightCandidate | null {
  const text = segment.text.trim();
  if (!text || !Number.isFinite(segment.startMs) || !Number.isFinite(segment.endMs)) {
    return null;
  }

  const cues = cueMatches(text);
  const matchedConcepts = conceptMatches(segment, concepts);
  const repeatedTerms = meaningfulTerms(text)
    .filter((term) => (repetitions.get(term) ?? 0) >= 2)
    .sort((left, right) => {
      const frequencyDifference =
        (repetitions.get(right) ?? 0) - (repetitions.get(left) ?? 0);
      return frequencyDifference || right.length - left.length || left.localeCompare(right);
    })
    .slice(0, 3);
  const hasDefinitionLanguage = DEFINITION_LANGUAGE.test(text);
  const instructor = isInstructorSpeaker(segment.speaker);
  const signals: LocalHighlightSignal[] = [];
  const reasons: string[] = [];
  let confidence = 0;

  if (segment.isImportant) {
    signals.push('existing-importance-flag');
    reasons.push('대본에 중요 구간으로 표시되어 있어요.');
    confidence = Math.max(confidence, 0.72);
  }

  if (cues.length > 0) {
    signals.push('explicit-language-cue');
    const bestCueConfidence = Math.max(...cues.map((cue) => cue.confidence));
    confidence = Math.max(confidence, bestCueConfidence);
    confidence += Math.min(0.08, Math.max(0, cues.length - 1) * 0.04);
    cues.forEach((cue) => {
      reasons.push(
        `${instructor ? '강사 발화' : '발화'}에서 “${cue.text}”이라는 ${cue.label} 신호를 찾았어요.`,
      );
    });
  }

  if (matchedConcepts.length > 0) {
    signals.push('concept-reference');
    confidence = Math.max(
      confidence,
      0.44 + Math.min(0.06, Math.max(0, matchedConcepts.length - 1) * 0.03),
    );
    matchedConcepts.forEach((concept) => {
      reasons.push(
        concept.directMention
          ? `학습 개념 “${concept.term}”이 이 발화에 직접 등장해요.`
          : `학습 개념 “${concept.term}”의 근거 시점과 이 발화가 겹쳐요.`,
      );
    });
  }

  if (hasDefinitionLanguage) {
    signals.push('definition-language');
    reasons.push('정의나 의미를 설명하는 표현이 포함되어 있어요.');
    confidence = Math.max(confidence, 0.43);
  }

  if (repeatedTerms.length > 0) {
    signals.push('repetition');
    reasons.push(
      `“${repeatedTerms.join(', ')}”이 여러 대본 구간에서 반복돼요.`,
    );
    const highestFrequency = Math.max(
      ...repeatedTerms.map((term) => repetitions.get(term) ?? 0),
    );
    confidence = Math.max(
      confidence,
      0.4 + Math.min(0.06, Math.max(0, highestFrequency - 2) * 0.03),
    );
  }

  if (signals.length === 0) {
    return null;
  }

  if (signals.length >= 2) {
    confidence += Math.min(0.12, (signals.length - 1) * 0.06);
  }
  if (instructor && (cues.length > 0 || hasDefinitionLanguage)) {
    confidence += 0.04;
  }

  return {
    confidence: roundedConfidence(confidence),
    endMs: Math.max(segment.startMs, segment.endMs),
    evidenceSentence: evidenceSentence(
      text,
      cues,
      matchedConcepts,
      repeatedTerms,
    ),
    heuristicVersion: LOCAL_HIGHLIGHT_HEURISTIC_VERSION,
    label: candidateLabel(
      segment,
      cues,
      matchedConcepts,
      repeatedTerms,
      hasDefinitionLanguage,
    ),
    matchedConcepts: matchedConcepts.map((concept) => concept.term),
    matchedCues: unique(cues.map((cue) => cue.text)),
    reasons,
    repeatedTerms,
    segmentId: segment.id,
    signals,
    source: 'local-heuristic',
    timestampMs: Math.max(0, segment.startMs),
  };
}

/**
 * Creates deterministic highlight candidates from transcript text only.
 *
 * This function performs no network or model call. Its confidence value is a
 * heuristic ranking signal derived from explicit instructor wording, supplied
 * concepts, definition language, repetition, and existing transcript flags.
 */
export function generateLocalHighlightCandidates(
  input: GenerateLocalHighlightCandidatesInput,
): LocalHighlightCandidate[] {
  const maxCandidates = Number.isFinite(input.maxCandidates)
    ? Math.max(0, Math.floor(input.maxCandidates ?? 12))
    : 12;
  if (maxCandidates === 0) {
    return [];
  }

  const minimumConfidence = Number.isFinite(input.minimumConfidence)
    ? clamp(input.minimumConfidence ?? 0.4, 0, 1)
    : 0.4;
  const repetitions = repeatedTermCounts(input.transcript);
  const candidates = input.transcript
    .map((segment) =>
      segmentCandidate(segment, input.concepts ?? [], repetitions),
    )
    .filter(
      (candidate): candidate is LocalHighlightCandidate =>
        candidate !== null && candidate.confidence >= minimumConfidence,
    );

  return candidates
    .sort(
      (left, right) =>
        right.confidence - left.confidence ||
        left.timestampMs - right.timestampMs ||
        left.segmentId.localeCompare(right.segmentId),
    )
    .slice(0, maxCandidates)
    .sort(
      (left, right) =>
        left.timestampMs - right.timestampMs ||
        right.confidence - left.confidence ||
        left.segmentId.localeCompare(right.segmentId),
    );
}

/** Convenience adapter for the current StudyMaterial shape. */
export function generateLocalHighlightsForMaterial(
  material: Pick<StudyMaterial, 'transcript' | 'note'>,
  options: Omit<
    GenerateLocalHighlightCandidatesInput,
    'transcript' | 'concepts'
  > = {},
): LocalHighlightCandidate[] {
  return generateLocalHighlightCandidates({
    ...options,
    concepts: material.note?.concepts,
    transcript: material.transcript,
  });
}
