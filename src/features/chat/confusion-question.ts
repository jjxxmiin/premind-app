/**
 * Turning "여기가 헷갈려요" into a question the AI can actually answer.
 *
 * The button used to file the reason into local state and close the sheet.
 * Nothing ever read that state and nothing appeared on screen, so from the
 * reader's side it did nothing at all — they said they were stuck and the app
 * said nothing back.
 *
 * Being stuck on a passage has an obvious next step: ask about that passage.
 * The reason picks how to ask, the passage says what about, and the answer
 * comes back grounded in the material with its source position attached.
 */

import type { ConfusionReason } from '@/types';

/** How much of the passage goes into the question. */
const MAX_QUOTE = 120;

/**
 * The passage, trimmed to something quotable.
 *
 * Cut at a sentence end when one is near the limit so the quote does not stop
 * mid-clause; a question that quotes half a sentence reads as a glitch and
 * gives the model less to find.
 */
export function quotePassage(text: string, limit = MAX_QUOTE): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const head = clean.slice(0, limit);
  const lastStop = Math.max(
    head.lastIndexOf('. '),
    head.lastIndexOf('요. '),
    head.lastIndexOf('다. '),
  );
  // Only honour a sentence end in the back half; an early one would throw
  // away most of the passage.
  if (lastStop > limit * 0.5) return head.slice(0, lastStop + 1).trim();
  return `${head.trim()}...`;
}

/**
 * What to ask about a passage the reader is stuck on.
 *
 * Returns the whole message, quote included, ready to send as if they had
 * typed it: it appears in the chat as their own question, because it is.
 */
export function confusionQuestion(
  reason: ConfusionReason,
  passage: string,
): string {
  const quote = quotePassage(passage);
  const opening = quote ? `"${quote}"\n\n` : '';
  switch (reason) {
    case 'terminology':
      return `${opening}여기 나오는 용어들을 쉬운 말로 하나씩 풀어서 설명해줘.`;
    case 'needs-example':
      return `${opening}이 부분을 구체적인 예를 들어서 설명해줘.`;
    case 'too-fast':
      return `${opening}이 부분을 단계별로 나눠서 천천히 설명해줘.`;
    case 'unclear':
      return `${opening}이 부분이 무슨 뜻인지 처음부터 다시 설명해줘.`;
  }
}
