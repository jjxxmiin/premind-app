import * as Haptics from 'expo-haptics';
import { Layers } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { AppText, Button, EmptyState, ProgressBar } from '@/components/ui';
import {
  buildDeck,
  emptyProgress,
  markCard,
  orderCards,
  pickCards,
  progressLabel,
  progressPercent,
  sessionResult,
  type CardVerdict,
  type DeckProgress,
} from '@/lib/flashcards';
import { highlightedSentences, paintableParts } from '@/lib/highlights';
import { colors, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

import { DeckResult } from './DeckResult';
import { FlashcardFace } from './FlashcardFace';
import { useCardSwipe } from './useCardSwipe';

/**
 * `screen` fills the `/cards/[id]` route: the deck scrolls and the two
 * verdicts sit in a bar pinned to the bottom edge. `panel` is the 카드 tab of
 * a 마인드팩, which is already inside the material screen's scroll view, so it
 * lays the same session out in the flow instead.
 */
export type CardSessionLayout = 'screen' | 'panel';

export interface CardSessionProps {
  material: StudyMaterial;
  /** `studyNotes[materialId].highlights`; painted sentences join the deck. */
  highlights: readonly string[];
  layout?: CardSessionLayout;
  /** Plays the 대본 from the moment the card came from. */
  onSeek?: (sourceStartMs: number) => void;
  /** The way out of the route. The 카드 tab is already on its material. */
  onDone?: () => void;
  /** Horizontal padding the host does not already provide. */
  gutter?: number;
}

/**
 * 암기 카드 — one card at a time, built from the 마인드팩 and from whatever the
 * learner painted with the 형광펜.
 *
 * The whole session lives here: which cards this pass shows, what the learner
 * said about each, and where they are. Nothing is written to the store, so
 * leaving and coming back starts a clean pass rather than resuming half of one
 * — a deck of twelve is a two-minute job, and a half-remembered position is
 * worse than a fresh start.
 *
 * The route and the tab share this one component so the deck can never differ
 * between the two places a learner reaches it.
 */
export function CardSession({
  material,
  highlights,
  layout = 'screen',
  onSeek,
  onDone,
  gutter = 0,
}: CardSessionProps) {
  const painted = useMemo(
    () => highlightedSentences(paintableParts(material), highlights),
    [highlights, material],
  );
  const deck = useMemo(
    () => buildDeck(material.note, painted),
    [material.note, painted],
  );

  /** Null while the pass is the whole deck; a list of ids during a review pass. */
  const [passIds, setPassIds] = useState<string[] | null>(null);
  const [progress, setProgress] = useState<DeckProgress>(emptyProgress);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const pass = useMemo(
    () => (passIds === null ? deck : pickCards(deck, passIds)),
    [deck, passIds],
  );
  const card = pass[index];
  const finished = pass.length > 0 && index >= pass.length;
  const result = useMemo(() => sessionResult(pass, progress), [pass, progress]);

  const answer = useCallback(
    (verdict: CardVerdict) => {
      const current = pass[index];
      if (!current) return;
      setProgress((value) => markCard(value, current.id, verdict));
      setFlipped(false);
      setIndex((value) => value + 1);
      void Haptics.selectionAsync();
    },
    [index, pass],
  );

  const swipe = useCardSwipe({ enabled: !finished, onVerdict: answer });

  const startPass = (ids: string[] | null) => {
    setPassIds(ids);
    setProgress(emptyProgress());
    setIndex(0);
    setFlipped(false);
  };

  /** The next pass: what this one left in 다시 볼래요, in the order it was flagged. */
  const reviewAgain = () => {
    const next = orderCards(pass, progress);
    if (next.length === 0) return;
    startPass(next.map((item) => item.id));
  };

  const padding = { paddingHorizontal: gutter };
  const isScreen = layout === 'screen';

  if (deck.length === 0) {
    return (
      <EmptyState
        actionLabel={onDone ? '자료 보기' : undefined}
        compact={!isScreen}
        description="마인드팩이 준비되면 개념과 꼭 기억할 내용으로 카드가 만들어져요. 요약에서 문장을 칠해도 카드가 늘어요."
        icon={Layers}
        onAction={onDone}
        title="아직 만들 카드가 없어요"
      />
    );
  }

  if (finished || !card) {
    const body = <DeckResult result={result} />;
    const actions = (
      <>
        {result.againCount > 0 ? (
          <Button fullWidth onPress={reviewAgain} size="large" variant="primary">
            다시 볼 것만 복습
          </Button>
        ) : null}
        <Button
          fullWidth
          onPress={onDone ?? (() => startPass(null))}
          size={result.againCount > 0 ? 'medium' : 'large'}
          variant={result.againCount > 0 ? 'secondary' : 'primary'}
        >
          {onDone ? '닫기' : '처음부터 다시'}
        </Button>
      </>
    );

    if (!isScreen) {
      return (
        <View style={styles.panel} testID="card-session">
          {body}
          <View style={styles.panelActions}>{actions}</View>
        </View>
      );
    }
    return (
      <View style={styles.flex} testID="card-session">
        <ScrollView
          contentContainerStyle={[styles.resultContent, padding]}
          showsVerticalScrollIndicator={false}
          style={styles.flex}
        >
          {body}
        </ScrollView>
        <View style={[styles.bottomBar, padding]}>{actions}</View>
      </View>
    );
  }

  const progressRow = (
    <View style={[styles.progressRow, padding]}>
      <ProgressBar
        height={3}
        style={styles.flex}
        tone="ink"
        value={progressPercent(index, pass.length)}
      />
      <AppText
        accessibilityLabel={`카드 ${pass.length}개 중 ${index + 1}번째`}
        tabular
        tone="muted"
        variant="meta"
      >
        {progressLabel(index, pass.length)}
      </AppText>
    </View>
  );

  const face = (
    <GestureDetector gesture={swipe} touchAction="pan-y">
      <View collapsable={false} style={isScreen ? styles.flex : styles.face}>
        <FlashcardFace
          card={card}
          flipped={flipped}
          onFlip={() => setFlipped((value) => !value)}
          onSeek={onSeek}
          page={material.source.kind === 'document'}
        />
      </View>
    </GestureDetector>
  );

  const actions = (
    <>
      <View style={styles.verdictRow}>
        <Button
          accessibilityHint="이 카드를 다시 볼 목록에 담아요"
          onPress={() => answer('again')}
          size="large"
          style={styles.verdictButton}
          variant="secondary"
        >
          다시 볼래요
        </Button>
        <Button
          accessibilityHint="이 카드를 외운 것으로 표시해요"
          onPress={() => answer('known')}
          size="large"
          style={styles.verdictButton}
          variant="primary"
        >
          알아요
        </Button>
      </View>
      <AppText align="center" tone="faint" variant="badge">
        카드를 옆으로 밀어도 넘어가요
      </AppText>
    </>
  );

  if (!isScreen) {
    return (
      <View style={styles.panel} testID="card-session">
        {progressRow}
        {face}
        <View style={styles.panelActions}>{actions}</View>
      </View>
    );
  }

  return (
    <View style={styles.flex} testID="card-session">
      {progressRow}
      {/* A scroller, so a short window (a phone held sideways) scrolls the card
          rather than folding it. The swipe gives up on vertical travel, so the
          two never fight. */}
      <ScrollView
        contentContainerStyle={[styles.deck, padding]}
        showsVerticalScrollIndicator={false}
        style={styles.flex}
      >
        {face}
      </ScrollView>
      <View style={[styles.bottomBar, padding]}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /** The panel's own blocks sit 12 apart, like every other study panel. */
  panel: { gap: spacing.md },
  /** Inside the material screen the card is a block, not the whole window. */
  face: { minHeight: 300 },
  /** Header → first block 8; the progress line and its count sit 12 apart. */
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  deck: {
    flexGrow: 1,
    paddingBottom: spacing.gutter,
    paddingTop: spacing.sm,
  },
  resultContent: {
    flexGrow: 1,
    gap: spacing.xl,
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  /** Hairline on top, 12 above and 20 below; the Screen owns the bottom inset. */
  bottomBar: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingBottom: spacing.gutter,
    paddingTop: spacing.md,
  },
  /** In the flow there is no bar to pin, so the actions keep only the gap. */
  panelActions: { gap: spacing.md },
  /** Two equal choices sit 12 apart; at 8 they read as one blob. */
  verdictRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  verdictButton: {
    flex: 1,
  },
});
