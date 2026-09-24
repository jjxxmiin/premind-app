import type { StudyMaterial } from '@/types';

/**
 * The 형광펜: the learner paints single sentences of 요약 and 대본 and gets
 * them back as a revision list.
 *
 * A highlight is stored as the sentence's own text, the same way
 * `checkedPoints` stores a key point. Nothing here knows about ids, so a
 * re-generated summary simply shows its new wording unpainted instead of
 * pointing at a sentence that no longer exists.
 */

/** Sentence enders seen in Korean lecture prose, ASCII and full width. */
const TERMINATORS = new Set(['.', '!', '?', '。', '！', '？']);
/** Punctuation that belongs to the sentence it closes. */
const CLOSERS = new Set(['"', "'", ')', ']', '»', '”', '’', '』', '」', '）']);

function isSpace(char: string): boolean {
  return char.trim().length === 0;
}

/**
 * Splits prose into sentences. A terminator only ends a sentence when
 * whitespace (or the end of the text) follows it, so "3.14" and "AI.ML" stay
 * whole, and a run like "?!" plus any closing quote goes with the sentence it
 * finishes. Blank pieces are dropped and every sentence comes back trimmed.
 */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!TERMINATORS.has(text[index] as string)) continue;
    let end = index + 1;
    while (
      end < text.length &&
      (TERMINATORS.has(text[end] as string) || CLOSERS.has(text[end] as string))
    ) {
      end += 1;
    }
    const next = text[end];
    if (next !== undefined && !isSpace(next)) {
      index = end - 1;
      continue;
    }
    const sentence = text.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    start = end;
    index = end - 1;
  }
  const tail = text.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/**
 * How a sentence is stored and compared. Rendering can re-wrap a line, so
 * the key ignores leading, trailing and repeated whitespace; everything else
 * is the learner's text as written.
 */
export function highlightKey(sentence: string): string {
  return sentence.trim().split(/\s+/u).join(' ');
}

export function isHighlighted(
  highlights: readonly string[],
  sentence: string,
): boolean {
  const key = highlightKey(sentence);
  return key.length > 0 && highlights.some((item) => highlightKey(item) === key);
}

/**
 * One tap paints a sentence, the next tap wipes it. A blank sentence is
 * never stored, so an empty transcript line cannot fill the list with noise.
 */
export function toggleHighlight(
  highlights: readonly string[],
  sentence: string,
): string[] {
  const key = highlightKey(sentence);
  if (!key) return [...highlights];
  return isHighlighted(highlights, key)
    ? highlights.filter((item) => highlightKey(item) !== key)
    : [...highlights, key];
}

/**
 * The painted sentences of one panel, in reading order rather than the order
 * they were painted: the 형광펜 chip filters what is on screen, so it has to
 * follow the lecture, not the learner's clicking history. Duplicates in the
 * source text collapse to one row.
 */
export function filterHighlighted(
  sentences: readonly string[],
  highlights: readonly string[],
): string[] {
  const seen = new Set<string>();
  const painted: string[] = [];
  for (const sentence of sentences) {
    const key = highlightKey(sentence);
    if (!key || seen.has(key) || !isHighlighted(highlights, key)) continue;
    seen.add(key);
    painted.push(sentence);
  }
  return painted;
}

/** How many of the sentences now on screen are painted. */
export function countHighlighted(
  sentences: readonly string[],
  highlights: readonly string[],
): number {
  return filterHighlighted(sentences, highlights).length;
}

/** A block of prose the 형광펜 can reach, and where it was said. */
export interface SentencePart {
  text: string;
  /** Null for prose with no moment of its own, such as the 한눈에 보기 요약. */
  startMs?: number | null;
}

/** One sentence, still carrying the moment the block it came from started at. */
export interface SentenceSource {
  sentence: string;
  startMs: number | null;
}

/**
 * Every sentence of the blocks, in reading order, each keeping its block's
 * timestamp so a painted line can still be played back.
 */
export function sourceSentences(
  parts: readonly SentencePart[],
): SentenceSource[] {
  return parts.flatMap((part) =>
    splitSentences(part.text).map((sentence) => ({
      sentence,
      startMs: part.startMs ?? null,
    })),
  );
}

/**
 * The painted sentences of a 마인드팩, in reading order rather than the order
 * they were painted, each with the moment it was said.
 *
 * A sentence that appears twice (the 요약 repeats a line of the 대본) is kept
 * once, at its first appearance, so the 형광펜 list never shows the same
 * stroke twice.
 */
export function highlightedSentences(
  parts: readonly SentencePart[],
  highlights: readonly string[],
): SentenceSource[] {
  const seen = new Set<string>();
  const painted: SentenceSource[] = [];
  for (const item of sourceSentences(parts)) {
    const key = highlightKey(item.sentence);
    if (!key || seen.has(key) || !isHighlighted(highlights, key)) continue;
    seen.add(key);
    painted.push(item);
  }
  return painted;
}

/**
 * Every block of a 마인드팩 the 형광펜 can reach, in reading order: the
 * 요약 first, then 자세히, then the 대본. The order is what the 형광펜 list
 * and the deck both read, so it is fixed here rather than at each call site.
 */
export function paintableParts(material: StudyMaterial): SentencePart[] {
  return [
    { text: material.note?.summary ?? '', startMs: null },
    ...(material.outline ?? []).map((section) => ({
      text: section.body,
      startMs: section.startMs,
    })),
    ...material.transcript.map((segment) => ({
      text: segment.text,
      startMs: segment.startMs,
    })),
  ];
}
