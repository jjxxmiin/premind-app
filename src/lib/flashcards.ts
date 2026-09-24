import type { SentenceSource } from '@/lib/highlights';
import type { StudyConcept, StudyNote } from '@/types';

/**
 * 암기 카드 — the deck behind the 카드 tab and `/cards/[id]`.
 *
 * Every card here is built from something the 마인드팩 already contains: a
 * concept the model pulled out of the 대본, a line from 꼭 기억할 내용, or a
 * sentence the learner painted with the 형광펜. Nothing is invented, and
 * nothing is promised that the material cannot back up — the screen shows the
 * real count ("3 / 12") rather than a target number it then quietly fails to
 * reach.
 */

export type FlashcardOrigin = 'concept' | 'keyPoint' | 'highlight';

export interface Flashcard {
  id: string;
  /** The cue: a term, or the opening of a remembered sentence. */
  front: string;
  /** What the learner is trying to recall. */
  back: string;
  origin: FlashcardOrigin;
  /** Where it was said, for the timestamp chip. Null for a key point. */
  sourceStartMs: number | null;
  /** Only concepts carry one. */
  difficulty?: StudyConcept['difficulty'];
}

/** What the learner said about a card. */
export type CardVerdict = 'known' | 'again';

/** Which cards the learner has judged, in the order they judged them. */
export interface DeckProgress {
  known: string[];
  again: string[];
}

/**
 * A deck this thin is not worth opening on its own, so 꼭 기억할 내용 fills it
 * out. Above it the concepts already carry the material and the key points
 * would only repeat them.
 */
export const MIN_DECK_SIZE = 8;

export function emptyProgress(): DeckProgress {
  return { known: [], again: [] };
}

/** One card per concept: the term on the front, its meaning on the back. */
export function conceptCards(note: StudyNote | null | undefined): Flashcard[] {
  if (!note) return [];
  return note.concepts
    .filter((concept) => concept.term.trim() !== '' && concept.description.trim() !== '')
    .map((concept) => ({
      id: `concept:${concept.id}`,
      front: concept.term.trim(),
      back: concept.description.trim(),
      origin: 'concept' as const,
      sourceStartMs: concept.sourceStartMs,
      difficulty: concept.difficulty,
    }));
}

/**
 * The cue for a key point: the first half of the sentence, so the learner
 * recalls the rest instead of reading the answer off the front.
 *
 * Null when there is nothing to hide — a one-word line would put the same
 * text on both faces, which is a card that teaches nothing.
 */
export function keyPointCue(text: string): string | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  const take = Math.max(1, Math.floor(words.length / 2));
  return `${words.slice(0, take).join(' ')} …`;
}

/** One card per key point, cued by its opening. */
export function keyPointCards(note: StudyNote | null | undefined): Flashcard[] {
  if (!note) return [];
  const cards: Flashcard[] = [];
  note.keyPoints.forEach((point, index) => {
    const answer = point.trim();
    const cue = keyPointCue(answer);
    if (!cue) return;
    cards.push({
      id: `point:${index}`,
      front: cue,
      back: answer,
      origin: 'keyPoint',
      sourceStartMs: null,
    });
  });
  return cards;
}

/** The blank a hidden term leaves behind on the front of a 형광펜 card. */
export const TERM_BLANK = '____';
/**
 * The cue a 형광펜 card asks with. It sits above the sentence, so a card whose
 * term could not be hidden still asks for something rather than showing the
 * answer.
 */
export const HIGHLIGHT_PROMPT = '이 문장은 무엇을 말하나요?';
/** Below this much text left around the blank, the card would give nothing away. */
const MIN_REMAINDER = 4;

/** Every occurrence of `term`, blanked out, matching without regard to case. */
function blankOut(sentence: string, term: string): string {
  const haystack = sentence.toLowerCase();
  const needle = term.toLowerCase();
  // A locale where lowercasing changes the length would misplace every index,
  // so that text is matched as written instead.
  const source = haystack.length === sentence.length ? haystack : sentence;
  const target = source === haystack ? needle : term;
  if (!target) return sentence;
  let out = '';
  let cursor = 0;
  for (;;) {
    const at = source.indexOf(target, cursor);
    if (at < 0) break;
    out += sentence.slice(cursor, at) + TERM_BLANK;
    cursor = at + target.length;
  }
  return out + sentence.slice(cursor);
}

/**
 * The sentence with its key term hidden: "지도학습은 …" becomes "____은 …".
 *
 * The longest matching term wins, so "지도학습" is hidden rather than the
 * "학습" inside it. Null when no term is in the sentence, or when hiding it
 * would leave too little to recall from.
 */
export function hideTerm(
  sentence: string,
  terms: readonly string[],
): string | null {
  const answer = sentence.trim();
  if (!answer) return null;
  const candidates = terms
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    .sort((a, b) => b.length - a.length);
  for (const term of candidates) {
    const blanked = blankOut(answer, term);
    if (blanked === answer) continue;
    const remainder = blanked.split(TERM_BLANK).join('').trim();
    if (remainder.length < MIN_REMAINDER) continue;
    return blanked;
  }
  return null;
}

/**
 * The front of a 형광펜 card: the sentence with its key term hidden, or, when
 * it holds no term the 마인드팩 knows, its opening half — the same cue a
 * 꼭 기억할 내용 card uses.
 */
export function highlightCue(
  sentence: string,
  terms: readonly string[],
): string | null {
  return hideTerm(sentence, terms) ?? keyPointCue(sentence);
}

/**
 * The cards a learner's own 형광펜 makes: front the sentence with its term
 * hidden, back the sentence in full.
 *
 * Painting is study input rather than decoration — what the learner thought
 * mattered comes back as something to answer. The order is the order they
 * were painted in, which `highlightedSentences` has already put back into
 * reading order.
 */
export function highlightCards(
  painted: readonly SentenceSource[],
  terms: readonly string[] = [],
): Flashcard[] {
  const cards: Flashcard[] = [];
  const seen = new Set<string>();
  for (const item of painted) {
    const answer = item.sentence.trim();
    const key = normalizeForCompare(answer);
    if (!key || seen.has(key)) continue;
    const front = highlightCue(answer, terms);
    if (!front) continue;
    seen.add(key);
    cards.push({
      id: `highlight:${key}`,
      front,
      back: answer,
      origin: 'highlight',
      sourceStartMs: item.startMs,
    });
  }
  return cards;
}

/**
 * The deck for one material: every concept, every painted sentence, plus
 * 꼭 기억할 내용 when those alone would make a deck too thin to be worth a
 * session.
 *
 * A card that only restates one already in the deck is dropped, so the learner
 * never sees the same fact twice under two headings.
 */
export function buildDeck(
  note: StudyNote | null | undefined,
  painted: readonly SentenceSource[] = [],
): Flashcard[] {
  const concepts = conceptCards(note);
  const taken = new Set(concepts.map((card) => normalizeForCompare(card.back)));
  const terms = (note?.concepts ?? []).map((concept) => concept.term);
  const highlights = highlightCards(painted, terms).filter((card) => {
    const key = normalizeForCompare(card.back);
    if (taken.has(key)) return false;
    taken.add(key);
    return true;
  });
  const core = [...concepts, ...highlights];
  if (core.length >= MIN_DECK_SIZE) return core;

  const extras = keyPointCards(note).filter((card) => {
    const key = normalizeForCompare(card.back);
    if (taken.has(key)) return false;
    taken.add(key);
    return true;
  });
  return [...core, ...extras];
}

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, '').replace(/[.,!?]/g, '');
}

/**
 * The cards still to show, unseen first and the 다시 볼래요 pile after them.
 *
 * One function covers both passes: a fresh session has judged nothing, so
 * every card is unseen and the whole deck comes back in order; the "다시 볼
 * 것만 복습" pass has judged everything, so only the 다시 볼래요 pile is left,
 * in the order the learner flagged it.
 */
export function orderCards(
  cards: readonly Flashcard[],
  progress: DeckProgress,
): Flashcard[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const judged = new Set([...progress.known, ...progress.again]);
  const unseen = cards.filter((card) => !judged.has(card.id));
  const again = progress.again
    .map((id) => byId.get(id))
    .filter((card): card is Flashcard => card !== undefined);
  return [...unseen, ...again];
}

/**
 * Records a verdict. A card lives in exactly one pile, so answering it again
 * moves it rather than listing it twice, and the newest verdict wins.
 */
export function markCard(
  progress: DeckProgress,
  id: string,
  verdict: CardVerdict,
): DeckProgress {
  const known = progress.known.filter((entry) => entry !== id);
  const again = progress.again.filter((entry) => entry !== id);
  if (verdict === 'known') known.push(id);
  else again.push(id);
  return { known, again };
}

/** How far a finger travels sideways before the card counts as answered. */
export const SWIPE_THRESHOLD = 56;

/**
 * The verdict a swipe carries: right for 알아요, left for 다시 볼래요, and
 * nothing at all for a nudge that never left the threshold, so a scroll or a
 * misfire cannot mark a card the learner never judged.
 */
export function swipeVerdict(
  translationX: number,
  threshold = SWIPE_THRESHOLD,
): CardVerdict | null {
  if (!Number.isFinite(translationX) || Math.abs(translationX) < threshold) {
    return null;
  }
  return translationX > 0 ? 'known' : 'again';
}

/** "3 / 12" — where the learner is in this pass. */
export function progressLabel(index: number, total: number): string {
  if (total <= 0) return '0 / 0';
  const position = Math.min(Math.max(index + 1, 1), total);
  return `${position} / ${total}`;
}

/** How full the progress line is, 0 to 100. */
export function progressPercent(index: number, total: number): number {
  if (total <= 0) return 0;
  const seen = Math.min(Math.max(index, 0), total);
  return Math.round((seen / total) * 100);
}

export interface SessionResult {
  /** Cards judged in this pass. */
  total: number;
  knownCount: number;
  againCount: number;
  /** "12개 중 9개를 알아요" */
  headline: string;
  /** Ids to review next, in the order they were flagged. */
  reviewIds: string[];
}

/**
 * The end of a pass, counted over the cards this pass actually showed — not
 * the whole deck. A review pass of 3 cards reports 3, so the number on screen
 * always matches what the learner just did.
 */
export function sessionResult(
  pass: readonly Flashcard[],
  progress: DeckProgress,
): SessionResult {
  const inPass = new Set(pass.map((card) => card.id));
  const knownCount = progress.known.filter((id) => inPass.has(id)).length;
  const reviewIds = progress.again.filter((id) => inPass.has(id));
  const total = pass.length;
  return {
    total,
    knownCount,
    againCount: reviewIds.length,
    headline: `${total}개 중 ${knownCount}개를 알아요`,
    reviewIds,
  };
}

/**
 * The named cards, in the order they were named.
 *
 * A pass is stored as ids rather than as a copy of the cards so that a deck
 * arriving late (the material is still syncing when the screen opens) fills
 * the pass in instead of freezing it empty.
 */
export function pickCards(
  deck: readonly Flashcard[],
  ids: readonly string[],
): Flashcard[] {
  const byId = new Map(deck.map((card) => [card.id, card]));
  return ids
    .map((id) => byId.get(id))
    .filter((card): card is Flashcard => card !== undefined);
}
