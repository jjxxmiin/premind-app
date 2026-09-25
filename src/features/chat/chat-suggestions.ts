/**
 * What to offer asking next.
 *
 * The chat used to show three fixed lines, all of them saying 강의, and only
 * before the first question. That was wrong twice over: a PDF is not a 강의,
 * and the moment a reader is most stuck for a question is *after* an answer,
 * not before. These follow the material and keep going.
 */

import { getLocale, translate, type AppLocale, type Vars } from '@/lib/i18n';
import { EN } from '@/lib/i18n/en';
import { josa } from '@/lib/mastery';
import type { StudyMaterial } from '@/types';

/** What to call this material in a sentence. */
export function sourceNoun(material: StudyMaterial): string {
  if (material.source.kind === 'document') return '문서';
  if (material.source.origin === 'link' || material.source.kind === 'video') {
    return '영상';
  }
  return '강의';
}

/** How many suggestions are shown at once. */
const SHOWN = 3;

function normalize(question: string): string {
  return question.replace(/\s+/g, '').toLowerCase();
}

/**
 * Up to three questions worth asking, in order of how much they usually help,
 * with anything already asked removed.
 *
 * The whole-material summary leads only while the chat is empty; once there
 * are answers on screen the reader has moved past it, and repeating it as the
 * top suggestion is the chat asking them to start over.
 */
export function chatSuggestions(
  material: StudyMaterial,
  asked: readonly string[] = [],
  locale: AppLocale = getLocale(),
): string[] {
  // The questions go to the AI as the reader's own words, so they are written
  // in the screen's language; Korean stays exactly as before.
  const tx = (ko: string, vars?: Vars) => translate(locale, [EN], ko, vars);
  const noun = translate(locale, [EN], sourceNoun(material), undefined, 'noun');
  const concepts = material.note?.concepts ?? [];
  const started = asked.length > 0;

  const opening = tx('이 {noun}를 한 문단으로 요약해줘', { noun });
  const conceptQuestions = concepts
    .slice(0, 3)
    .map((concept) => tx('{term}{j} 뭐야?', { term: concept.term, j: josa(concept.term, '이') }));
  const deeper = concepts[0]
    ? tx('{term}{j} 예를 들어 설명해줘', { term: concepts[0].term, j: josa(concepts[0].term, '을') })
    : null;

  const ordered = [
    ...(started ? [] : [opening]),
    ...conceptQuestions,
    tx('가장 중요한 내용 세 가지만 알려줘'),
    deeper,
    tx('이 {noun}에서 시험에 나올 만한 부분은 어디야?', { noun }),
    ...(started ? [opening] : []),
  ].filter((question): question is string => Boolean(question));

  const seen = new Set(asked.map(normalize));
  const picked: string[] = [];
  for (const question of ordered) {
    const key = normalize(question);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(question);
    if (picked.length === SHOWN) break;
  }
  return picked;
}
