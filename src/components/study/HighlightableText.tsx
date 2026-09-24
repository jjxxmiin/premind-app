import { Fragment, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { AppText, type AppTextProps } from '@/components/ui';
import { filterHighlighted, isHighlighted, splitSentences } from '@/lib/highlights';
import { colors } from '@/theme/tokens';

export interface HighlightableTextProps extends Omit<AppTextProps, 'children'> {
  text: string;
  /** `studyNotes[materialId].highlights`. */
  highlights: readonly string[];
  /** Receives the sentence the learner painted or wiped. */
  onToggle: (sentence: string) => void;
  /**
   * Whether a plain tap paints. True in 요약, where a tap does nothing else;
   * false in 대본, where the row already answers a tap by seeking. A long
   * press paints either way.
   */
  tapToPaint?: boolean;
  /** Renders only the painted sentences, for the 형광펜 filter. */
  paintedOnly?: boolean;
}

/**
 * Body text the learner can paint a sentence at a time, and wipe with the
 * same gesture that painted it.
 *
 * There is no mode to turn on: in 요약 a tap paints, because nothing else
 * there responds to one. In 대본 the timestamp still seeks, so painting is a
 * long press and the panel says so once. Nothing here steals a tap from a
 * control that already had one.
 */
export function HighlightableText({
  highlights,
  onToggle,
  paintedOnly = false,
  tapToPaint = false,
  text,
  style,
  ...props
}: HighlightableTextProps) {
  const sentences = useMemo(() => {
    const all = splitSentences(text);
    return paintedOnly ? filterHighlighted(all, highlights) : all;
  }, [highlights, paintedOnly, text]);

  if (!sentences.length) {
    return null;
  }

  return (
    <AppText {...props} style={style}>
      {sentences.map((sentence, index) => {
        const painted = isHighlighted(highlights, sentence);
        return (
          <Fragment key={`${index}-${sentence}`}>
            {/* The space between sentences stays unpainted so the marks read
                as separate strokes rather than one long band. */}
            {index > 0 ? ' ' : null}
            {/* A sentence announces itself as a checkbox rather than a
                button: React Native Web renders a button as an atomic inline
                block, which would break the paragraph into one line per
                sentence, and "marked or not" is what a stroke really is. */}
            <AppText
              {...props}
              aria-checked={painted}
              accessibilityHint={
                tapToPaint
                  ? '눌러서 형광펜으로 칠하거나 지워요.'
                  : '길게 눌러서 형광펜으로 칠하거나 지워요.'
              }
              accessibilityLabel={sentence}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: painted }}
              onLongPress={() => onToggle(sentence)}
              onPress={tapToPaint ? () => onToggle(sentence) : undefined}
              style={[style, painted ? styles.painted : null]}
            >
              {sentence}
            </AppText>
          </Fragment>
        );
      })}
    </AppText>
  );
}

const styles = StyleSheet.create({
  /** The 형광펜 stroke: a soft accent wash, the type left as it was. */
  painted: { backgroundColor: colors.brandSoft, color: colors.text },
});
