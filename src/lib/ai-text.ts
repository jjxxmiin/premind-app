/**
 * Tidy up prose the model wrote before it reaches the screen.
 *
 * The design system bans the middot: lists of words use a comma. The prompts
 * ask for that, but a model still slips one in now and then, and text written
 * before the rule existed is already stored on the server. Cleaning at the
 * boundary means no screen has to think about it.
 */

/** Middot and its lookalikes, all of which read as a list separator here. */
const SEPARATORS = /[·・･•∙]/g;

export function cleanAiText(value: string): string {
  if (!value.includes('·') && !SEPARATORS.test(value)) {
    SEPARATORS.lastIndex = 0;
    return value;
  }
  SEPARATORS.lastIndex = 0;
  return value
    .replace(SEPARATORS, ', ')
    .replace(/\s+,/g, ',')
    .replace(/,\s+(?=[,.])/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/,\s*$/gm, '')
    .trimEnd();
}

/** The same, for a list of lines. */
export function cleanAiLines(values: readonly string[]): string[] {
  return values.map(cleanAiText);
}
