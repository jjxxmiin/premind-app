import type {
  StudyConcept,
  StudyMaterial,
  TranscriptSegment,
} from '../../types';

export type GroundedChatSourceKind = 'transcript' | 'summary' | 'concept';

export interface GroundedChatCitation {
  id: string;
  sourceKind: GroundedChatSourceKind;
  /** Millisecond position to open in the original audio or video. */
  timestampMs: number;
  excerpt: string;
  transcriptSegmentId?: string;
  conceptId?: string;
  speaker?: string;
}

export type GroundedChatAnswerStatus =
  | 'answered'
  | 'insufficient-evidence';

export interface GroundedChatAnswer {
  status: GroundedChatAnswerStatus;
  answer: string;
  citations: GroundedChatCitation[];
  /** Lexical retrieval confidence, not a claim of factual correctness. */
  confidence: number;
  /**
   * How the answer was made. `server-grounded` is written by the model from
   * the transcript and reads like an explanation; `local-extractive` quotes
   * the closest lines and is what a demo or an offline device falls back to.
   */
  mode: 'local-extractive' | 'server-grounded';
  refusalReason?: 'empty-question' | 'no-supported-source';
}

export interface GroundedChatOptions {
  maxCitations?: number;
  minimumRelevance?: number;
}

interface SourceChunk {
  sourceKind: GroundedChatSourceKind;
  sourceId: string;
  text: string;
  timestampMs: number;
  transcriptSegmentId?: string;
  conceptId?: string;
  speaker?: string;
}

interface RankedChunk {
  chunk: SourceChunk;
  relevance: number;
}

const EMPTY_QUESTION_MESSAGE = '궁금한 내용을 입력해 주세요.';

export const NO_GROUNDED_ANSWER_MESSAGE =
  '이 자료의 대본과 요약에서 답할 근거를 찾지 못했어요. 다른 말로 물어보거나 대본에서 직접 찾아보세요.';

const STOP_WORDS = new Set([
  '가',
  '과',
  '강사',
  '그',
  '그리고',
  '나',
  '내용',
  '는',
  '다',
  '대해',
  '대한',
  '도',
  '를',
  '말',
  '말한',
  '말하는',
  '말했어',
  '말했나요',
  '무엇',
  '뭐',
  '뭐야',
  '및',
  '부분',
  '에서',
  '에게',
  '왜',
  '언제',
  '언제야',
  '으로',
  '은',
  '이',
  '이것',
  '자료',
  '저것',
  '좀',
  '중',
  '하는',
  '한',
  '해',
  '해줘',
  '설명',
  '설명해줘',
  '알려줘',
  '말해줘',
  'the',
  'a',
  'an',
  'and',
  'about',
  'from',
  'in',
  'is',
  'of',
  'on',
  'please',
  'tell',
  'this',
  'to',
  'what',
]);

const SUMMARY_INTENT_PATTERN = /(?:요약|정리|summary|summari[sz]e)/i;
const KOREAN_PARTICLES = [
  '으로부터',
  '에게서',
  '에서는',
  '으로',
  '에서',
  '에게',
  '까지',
  '부터',
  '처럼',
  '보다',
  '라고',
  '이나',
  '나',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '과',
  '와',
  '의',
  '도',
  '만',
] as const;

function normalizedText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

function withoutKoreanParticle(token: string): string {
  const particle = KOREAN_PARTICLES.find(
    (candidate) =>
      token.endsWith(candidate) && token.length - candidate.length >= 2,
  );
  return particle ? token.slice(0, -particle.length) : token;
}

function tokens(value: string): string[] {
  return normalizedText(value)
    .split(/\s+/)
    .map(withoutKoreanParticle)
    .filter(
      (token) =>
        token.length >= 2 &&
        !STOP_WORDS.has(token) &&
        !/^\d+$/.test(token),
    );
}

function wordsMatch(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  return shorter.length >= 2 && longer.startsWith(shorter);
}

function matchingTokenCount(questionTokens: string[], text: string): number {
  const sourceTokens = [...new Set(tokens(text))];
  return questionTokens.filter((questionToken) =>
    sourceTokens.some((sourceToken) => wordsMatch(questionToken, sourceToken)),
  ).length;
}

function lexicalRelevance(questionTokens: string[], text: string): number {
  if (!questionTokens.length) {
    return 0;
  }

  const matchCount = matchingTokenCount(questionTokens, text);
  if (!matchCount) {
    return 0;
  }

  const coverage = matchCount / questionTokens.length;
  const evidenceBreadth = Math.min(matchCount, 3) / 3;
  return coverage * 0.72 + evidenceBreadth * 0.28;
}

function validTimestamp(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function timestampBearingChunks(
  transcript: TranscriptSegment[],
  concepts: StudyConcept[],
): SourceChunk[] {
  const transcriptChunks = transcript
    .filter((segment) => segment.text.trim())
    .map<SourceChunk>((segment) => ({
      sourceKind: 'transcript',
      sourceId: segment.id,
      text: segment.text.trim(),
      timestampMs: validTimestamp(segment.startMs),
      transcriptSegmentId: segment.id,
      speaker: segment.speaker,
    }));

  const conceptChunks = concepts
    .filter((concept) => concept.term.trim() || concept.description.trim())
    .map<SourceChunk>((concept) => ({
      sourceKind: 'concept',
      sourceId: concept.id,
      text: [concept.term.trim(), concept.description.trim()]
        .filter(Boolean)
        .join(': '),
      timestampMs: validTimestamp(concept.sourceStartMs),
      conceptId: concept.id,
    }));

  return [...transcriptChunks, ...conceptChunks];
}

function summarySentences(summary: string): string[] {
  return (
    summary
      .match(/[^.!?。！？]+[.!?。！？]?/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? []
  );
}

function linkedSummaryChunks(
  summary: string | undefined,
  timestampSources: SourceChunk[],
): SourceChunk[] {
  if (!summary?.trim() || !timestampSources.length) {
    return [];
  }

  return summarySentences(summary).flatMap((sentence, index) => {
    const sentenceTokens = tokens(sentence);
    const linked = timestampSources
      .map((source) => ({
        source,
        relevance: lexicalRelevance(sentenceTokens, source.text),
      }))
      .sort((left, right) => right.relevance - left.relevance)[0];

    if (!linked || linked.relevance <= 0) {
      return [];
    }

    return [
      {
        sourceKind: 'summary' as const,
        sourceId: `summary-${index + 1}`,
        text: sentence,
        timestampMs: linked.source.timestampMs,
        transcriptSegmentId: linked.source.transcriptSegmentId,
        conceptId: linked.source.conceptId,
      },
    ];
  });
}

function sourceChunks(material: StudyMaterial): SourceChunk[] {
  const concepts = material.note?.concepts ?? [];
  const timestampSources = timestampBearingChunks(material.transcript, concepts);
  return [
    ...timestampSources,
    ...linkedSummaryChunks(material.note?.summary, timestampSources),
  ];
}

function rankChunks(
  chunks: SourceChunk[],
  questionTokens: string[],
  isSummaryIntent: boolean,
  minimumRelevance: number,
): RankedChunk[] {
  return chunks
    .map((chunk) => {
      const lexicalScore = lexicalRelevance(questionTokens, chunk.text);
      const summaryIntentScore =
        isSummaryIntent && chunk.sourceKind === 'summary' ? 1 : 0;
      const conceptTermBonus =
        chunk.sourceKind === 'concept' && lexicalScore > 0 ? 0.04 : 0;
      const relevance = Math.min(
        1,
        Math.max(lexicalScore, summaryIntentScore) + conceptTermBonus,
      );
      return { chunk, relevance };
    })
    .filter(({ relevance }) => relevance >= minimumRelevance)
    .sort((left, right) => {
      if (right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }
      if (left.chunk.sourceKind !== right.chunk.sourceKind) {
        const sourcePriority: Record<GroundedChatSourceKind, number> = {
          transcript: 0,
          concept: 1,
          summary: 2,
        };
        return (
          sourcePriority[left.chunk.sourceKind] -
          sourcePriority[right.chunk.sourceKind]
        );
      }
      return left.chunk.timestampMs - right.chunk.timestampMs;
    });
}

function answerSentence(chunk: SourceChunk, citationNumber: number): string {
  const citation = `[${citationNumber}]`;
  if (chunk.sourceKind === 'summary') {
    return `요약에는 “${chunk.text}”라고 정리돼 있어요. ${citation}`;
  }
  if (chunk.sourceKind === 'concept') {
    return `요약에는 “${chunk.text}”라고 정리돼 있어요. ${citation}`;
  }
  return `대본에서는 “${chunk.text}”라고 말해요. ${citation}`;
}

function refusal(
  answer: string,
  refusalReason: GroundedChatAnswer['refusalReason'],
): GroundedChatAnswer {
  return {
    status: 'insufficient-evidence',
    answer,
    citations: [],
    confidence: 0,
    mode: 'local-extractive',
    refusalReason,
  };
}

/**
 * Deterministic local retrieval for the current offline demo.
 *
 * This deliberately does not call or imitate a production AI model. It only
 * extracts text already present in the material transcript, summary, or
 * concepts and links each excerpt back to a source timestamp.
 */
export class LocalSourceGroundedChatService {
  answer(
    material: StudyMaterial,
    question: string,
    options: GroundedChatOptions = {},
  ): GroundedChatAnswer {
    const normalizedQuestion = normalizedText(question);
    if (!normalizedQuestion) {
      return refusal(EMPTY_QUESTION_MESSAGE, 'empty-question');
    }

    const isSummaryIntent = SUMMARY_INTENT_PATTERN.test(normalizedQuestion);
    const questionTokens = tokens(question).filter(
      (token) => !SUMMARY_INTENT_PATTERN.test(token),
    );
    if (!questionTokens.length && !isSummaryIntent) {
      return refusal(NO_GROUNDED_ANSWER_MESSAGE, 'no-supported-source');
    }

    const minimumRelevance = Math.min(
      1,
      Math.max(0.1, options.minimumRelevance ?? 0.42),
    );
    const maxCitations = Math.min(
      5,
      Math.max(1, Math.round(options.maxCitations ?? 3)),
    );
    const ranked = rankChunks(
      sourceChunks(material),
      questionTokens,
      isSummaryIntent,
      minimumRelevance,
    );

    if (!ranked.length) {
      return refusal(NO_GROUNDED_ANSWER_MESSAGE, 'no-supported-source');
    }

    const strongestRelevance = ranked[0]?.relevance ?? 0;
    const selected = ranked
      .filter(
        ({ relevance }) => relevance >= Math.max(minimumRelevance, strongestRelevance * 0.65),
      )
      .slice(0, maxCitations);

    const citations = selected.map<GroundedChatCitation>(({ chunk }, index) => ({
      id: `citation-${index + 1}`,
      sourceKind: chunk.sourceKind,
      timestampMs: chunk.timestampMs,
      excerpt: chunk.text,
      transcriptSegmentId: chunk.transcriptSegmentId,
      conceptId: chunk.conceptId,
      speaker: chunk.speaker,
    }));

    return {
      status: 'answered',
      answer: selected
        .map(({ chunk }, index) => answerSentence(chunk, index + 1))
        .join(' '),
      citations,
      confidence: Number(strongestRelevance.toFixed(2)),
      mode: 'local-extractive',
    };
  }
}

export const localSourceGroundedChatService =
  new LocalSourceGroundedChatService();
