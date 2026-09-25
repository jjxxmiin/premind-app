import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppText, Card, Chip, SkeletonLines } from '@/components/ui';
import { type GroundedChatAnswer } from '@/features/chat';
import { chatSuggestions, sourceNoun } from '@/features/chat/chat-suggestions';
import { studyMaterialService } from '@/services/study-material-service';
import { decorative } from '@/lib/a11y';
import { formatSourcePosition } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { inputReset } from '@/theme/input-reset';
import {
  colors,
  iconSizes,
  radii,
  sizes,
  spacing,
  typography,
} from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  result?: GroundedChatAnswer;
  /**
   * Set when the answer never arrived. Carries the question so the row can
   * ask it again: the service falls back to an on-device answer for a server
   * that is down, so reaching here means something unexpected broke and the
   * reader's only useful move is to try once more.
   */
  failedQuestion?: string;
}

export interface StudyChatProps {
  /** A `ready` material; the route gates on status first. */
  material: StudyMaterial;
  /**
   * Open the keyboard as soon as the screen has settled. The material
   * screen's "이 자료에 물어보기" pill passes this so a tap there lands the
   * reader straight in the composer.
   */
  autoFocus?: boolean;
  /**
   * A question to send as soon as the screen opens, as if the reader had
   * typed it. 대본's 여기가 헷갈려요 uses this: they said they were stuck, so
   * the chat asks about that passage rather than waiting to be asked.
   */
  initialQuestion?: string;
  /**
   * Extra space under the composer for the system navigation bar. The chat
   * route passes `insets.bottom` while the keyboard is hidden and 0 while it
   * is showing, because the keyboard covers that bar and the inset would
   * otherwise become a gap between the composer and the keys.
   */
  bottomInset?: number;
}

/**
 * The local service answers synchronously. A short beat between the question
 * landing and the answer appearing lets the reader see their message before
 * the "analysing" line gives way to the reply.
 */
/**
 * The shortest a "생각 중" state may last. It exists only for the on-device
 * answer, which returns in a millisecond and would otherwise flash. A server
 * answer already takes seconds, so it is never held back.
 */
const MIN_THINKING_MS = 450;
/**
 * The stack push animation is about 300ms; focusing the composer earlier
 * asks Android for a keyboard while the screen is still off-stage, and the
 * request is dropped.
 */
const AUTO_FOCUS_DELAY_MS = 350;
/** The send disc and the single-line input share one height inside the 48pt pill. */
const COMPOSER_CONTROL_SIZE = 32;
/** About four lines of body text before the composer scrolls. */
const COMPOSER_MAX_HEIGHT = 112;
/** Compact row height, per the layout rules. */
const COMPACT_ROW_HEIGHT = 54;
/** How long the 복사 chip says 복사했어요 before going back. */
const COPIED_MS = 1600;

function messageId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function sourceLabel(sourceKind: GroundedChatAnswer['citations'][number]['sourceKind']): string {
  if (sourceKind === 'summary') return '요약';
  if (sourceKind === 'concept') return '개념';
  return '대본';
}

/**
 * Source-grounded Q&A over one study pack: the message list, suggested
 * questions, citation chips and the composer. The list fills whatever
 * height the parent gives it and the composer is pinned beneath the list,
 * outside the scroll view; the chat route owns keyboard avoidance.
 */
export function StudyChat({
  material,
  autoFocus = false,
  bottomInset = 0,
  initialQuestion,
}: StudyChatProps) {
  const t = useT();
  const { breakpoint, isTablet } = useLayout();
  /** A desktop window keeps the chat to a reading column, composer included. */
  const readable = breakpoint === 'expanded' ? styles.readable : null;
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const listHeight = useRef(0);
  /** Aborts the answer in flight when the screen goes away mid-question. */
  const pending = useRef<AbortController | null>(null);
  /** Whether the question carried in from 대본 has already been sent. */
  const askedInitial = useRef(false);
  /** Clears the 복사했어요 confirmation; cancelled if the screen goes away. */
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [question, setQuestion] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  /** The answer whose 복사 chip is showing its confirmation, if any. */
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const asked = useMemo(
    () =>
      messages
        .filter((message) => message.role === 'user')
        .map((message) => message.text),
    [messages],
  );
  const suggestions = useMemo(
    () => chatSuggestions(material, asked, t.locale),
    [asked, material, t.locale],
  );
  /** A document cites pages, not timestamps, and opens rather than plays. */
  const isDocument = material.source.kind === 'document';
  const noun = t.ctx('noun', sourceNoun(material));
  const citationAt = (timestampMs: number) =>
    formatSourcePosition(timestampMs, isDocument);
  const citationHint = isDocument
    ? t('그 쪽을 대본에서 열어요.')
    : t('그 시점부터 대본을 재생해요.');
  /** "근거 2, 3쪽열기" / "근거 2, 1:05부터 재생": the position and the action read as one phrase. */
  const citationA11y = (ko: string, index: number, timestampMs: number) =>
    t(isDocument ? `${ko}열기` : `${ko}부터 재생`, { i: index + 1, pos: citationAt(timestampMs) });

  useEffect(
    () => () => {
      pending.current?.abort();
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => inputRef.current?.focus(), AUTO_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  /**
   * The list loses height when the keyboard opens (Android resizes the
   * window, iOS pads the parent). Keep the newest message in view; with no
   * messages the suggestions sit at the top and stay where they are.
   */
  const handleListLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (listHeight.current && height < listHeight.current) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
    listHeight.current = height;
  };

  const submitQuestion = (value = question) => {
    const trimmed = value.trim();
    if (!trimmed || thinking) return;

    setMessages((current) => [
      ...current,
      { id: messageId('question'), role: 'user', text: trimmed },
    ]);
    setQuestion('');
    setThinking(true);
    void Haptics.selectionAsync();

    // The server writes the answer from the transcript; without one the
    // service falls back to on-device retrieval, so this always resolves.
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    void studyMaterialService
      .askMaterial(material, trimmed, { signal: controller.signal })
      .then(async (result) => {
        if (controller.signal.aborted) return;
        // Only the instant on-device answer needs padding out; a server answer
        // has already made the reader wait and must not wait any longer.
        if (result.mode === 'local-extractive') {
          await new Promise((resolve) => setTimeout(resolve, MIN_THINKING_MS));
          if (controller.signal.aborted) return;
        }
        setMessages((current) => [
          ...current,
          { id: messageId('answer'), role: 'assistant', text: result.answer, result },
        ]);
        setThinking(false);
      })
      .catch(() => {
        // Without this the spinner ran forever and the screen was dead: the
        // service already falls back to an on-device answer for an unreachable
        // server, so anything landing here is unexpected and the reader needs
        // a way out rather than an explanation.
        if (controller.signal.aborted) return;
        setMessages((current) => [
          ...current,
          {
            id: messageId('failed'),
            role: 'assistant',
            // Kept in Korean and drawn through t(): the row renders `t(message.text)`.
            text: '답변을 만들지 못했어요. 다시 시도해 주세요.',
            failedQuestion: trimmed,
          },
        ]);
        setThinking(false);
      });
  };

  /**
   * Send the question the reader arrived with, once. Guarded by a ref rather
   * than by state: this fires an action, and a re-render must not repeat it.
   */
  useEffect(() => {
    if (!initialQuestion || askedInitial.current) return;
    askedInitial.current = true;
    submitQuestion(initialQuestion);
    // `submitQuestion` closes over render-fresh state and is deliberately not
    // a dependency; the ref is what keeps this to one send.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  const openCitation = (timestampMs: number) => {
    router.push({
      pathname: '/material/[id]',
      params: {
        at: String(timestampMs),
        id: material.id,
        tab: 'transcript',
      },
    });
  };

  const copyAnswer = async (messageKey: string, text: string) => {
    await Clipboard.setStringAsync(text);
    void Haptics.selectionAsync();
    setCopiedId(messageKey);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), COPIED_MS);
  };

  const toggleSources = (messageKey: string) => {
    setExpandedSources((current) => ({ ...current, [messageKey]: !current[messageKey] }));
  };

  const canSend = question.trim().length > 0 && !thinking;

  return (
    <View style={styles.fill}>
      <ScrollView
        contentContainerStyle={[styles.messages, readable]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        onLayout={handleListLayout}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        testID="study-chat-messages"
      >
        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <View accessibilityLabel={t('내 질문')} key={message.id} style={styles.userRow}>
                <View
                  style={[
                    styles.userBubble,
                    // 84% of a tablet column is a 640pt line of chat — past the
                    // width at which a reader's eye can find the next line.
                    isTablet ? styles.userBubbleTablet : null,
                  ]}
                >
                  <AppText variant="body">{message.text}</AppText>
                </View>
              </View>
            );
          }

          const citations = message.result?.citations ?? [];
          const expanded = Boolean(expandedSources[message.id]);

          return (
            <View accessibilityLabel={t('답변')} key={message.id} style={styles.answer}>
              <View style={styles.answerLabel}>
                <Sparkles
                  {...decorative}
                  color={colors.text}
                  size={iconSizes.inline}
                  strokeWidth={2}
                />
                <AppText variant="label">{t('답변')}</AppText>
              </View>
              {/* An AI answer passes through unchanged; only the app's own lines have English. */}
              <AppText variant="body">{t(message.text)}</AppText>

              {citations.length ? (
                <View style={styles.sources}>
                  <Pressable
                    accessibilityLabel={t('근거 {n}개, {action}', { n: citations.length, action: expanded ? t('접기') : t('펼치기') })}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    hitSlop={6}
                    onPress={() => toggleSources(message.id)}
                    style={({ pressed }) => [styles.sourcesToggle, pressed ? styles.pressed : null]}
                  >
                    <AppText tone="muted" variant="label">
                      {t('근거 {n}개', { n: citations.length })}
                    </AppText>
                    {expanded ? (
                      <ChevronUp
                        {...decorative}
                        color={colors.textFaint}
                        size={iconSizes.inline}
                        strokeWidth={2}
                      />
                    ) : (
                      <ChevronDown
                        {...decorative}
                        color={colors.textFaint}
                        size={iconSizes.inline}
                        strokeWidth={2}
                      />
                    )}
                  </Pressable>
                  <View style={styles.citationChips}>
                    {citations.map((citation, index) => (
                      <Chip
                        accessibilityHint={citationHint}
                        accessibilityLabel={citationA11y('근거 {i}, {pos}', index, citation.timestampMs)}
                        icon={isDocument ? FileText : Play}
                        key={citation.id}
                        label={t('근거 {pos}', { pos: citationAt(citation.timestampMs) })}
                        onPress={() => openCitation(citation.timestampMs)}
                      />
                    ))}
                  </View>
                  {expanded ? (
                    <Card padding={false}>
                      {citations.map((citation, index) => (
                        <Pressable
                          accessibilityHint={citationHint}
                          accessibilityLabel={citationA11y('근거 {i} 원문, {pos}', index, citation.timestampMs)}
                          accessibilityRole="button"
                          key={citation.id}
                          onPress={() => openCitation(citation.timestampMs)}
                          style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                            styles.citationRow,
                            index < citations.length - 1 ? styles.rowDivider : null,
                            hovered || pressed ? styles.rowPressed : null,
                          ]}
                        >
                          <View style={styles.citationIndex}>
                            <AppText tone="muted" variant="badge">{index + 1}</AppText>
                          </View>
                          <View style={styles.flex}>
                            <AppText variant="label">
                              {t.ctx('source', sourceLabel(citation.sourceKind))} / {citationAt(citation.timestampMs)}
                            </AppText>
                            <AppText numberOfLines={3} tone="muted" variant="meta">
                              {citation.excerpt}
                            </AppText>
                          </View>
                        </Pressable>
                      ))}
                    </Card>
                  ) : null}
                </View>
              ) : null}

              {message.result?.status === 'insufficient-evidence' ? (
                <AppText tone="muted" variant="meta">
                  {t('다른 말로 물어보거나 대본 탭에서 직접 찾아보세요.')}
                </AppText>
              ) : null}

              <View style={styles.answerActions}>
                {message.failedQuestion ? (
                  <Chip
                    accessibilityHint={t('같은 질문을 다시 보내요.')}
                    icon={RotateCcw}
                    label={t('다시 시도')}
                    onPress={() => submitQuestion(message.failedQuestion)}
                  />
                ) : (
                  <Chip
                    accessibilityHint={t('답변을 클립보드에 복사해요.')}
                    icon={copiedId === message.id ? Check : Copy}
                    label={copiedId === message.id ? t('복사했어요') : t('복사')}
                    onPress={() => void copyAnswer(message.id, t(message.text))}
                  />
                )}
              </View>
            </View>
          );
        })}

        {thinking ? (
          <View accessibilityLiveRegion="polite" style={styles.answer}>
            <View style={styles.answerLabel}>
              <Sparkles
                {...decorative}
                color={colors.text}
                size={iconSizes.inline}
                strokeWidth={2}
              />
              <AppText variant="label">{t('답변')}</AppText>
            </View>
            <AppText tone="muted" variant="body">
              {t('대본에서 근거를 찾고 있어요')}
            </AppText>
            <SkeletonLines lines={3} />
          </View>
        ) : null}

        {/* Kept on screen after every answer, not only at the start: being
            stuck for the next question is what ends a chat, and the list
            drops whatever has already been asked. */}
        {!thinking && suggestions.length ? (
          <View style={styles.suggestions}>
            <AppText tone="muted" variant="meta">
              {messages.length === 0 ? t('이런 걸 물어볼 수 있어요') : t('이어서 물어보기')}
            </AppText>
            <Card padding={false}>
              {suggestions.map((suggestion, index) => (
                <Pressable
                  accessibilityLabel={suggestion}
                  accessibilityRole="button"
                  key={suggestion}
                  onPress={() => submitQuestion(suggestion)}
                  style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                    styles.suggestionRow,
                    index < suggestions.length - 1 ? styles.rowDivider : null,
                    hovered || pressed ? styles.rowPressed : null,
                  ]}
                >
                  <AppText numberOfLines={2} style={styles.flex} variant="body">
                    {suggestion}
                  </AppText>
                  <Plus
                    {...decorative}
                    color={colors.textMuted}
                    size={iconSizes.section}
                    strokeWidth={2}
                  />
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[styles.composerBar, { paddingBottom: spacing.md + bottomInset }]}
        testID="study-chat-composer"
      >
        <View
          style={[
            styles.composer,
            readable,
            composerFocused ? styles.composerFocused : null,
          ]}
        >
          <TextInput
            accessibilityLabel={t('질문 입력')}
            blurOnSubmit={false}
            multiline
            numberOfLines={1}
            onBlur={() => setComposerFocused(false)}
            onChangeText={setQuestion}
            onFocus={() => setComposerFocused(true)}
            onSubmitEditing={() => submitQuestion()}
            placeholder={t('이 {noun}에서 궁금한 걸 물어보세요', { noun })}
            placeholderTextColor={colors.textFaint}
            ref={inputRef}
            returnKeyType="send"
            style={[styles.input, inputReset]}
            value={question}
          />
          <Pressable
            accessibilityLabel={t('질문 보내기')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={() => submitQuestion()}
            style={({ pressed }) => [
              styles.sendButton,
              !canSend ? styles.sendDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <ArrowUp
              {...decorative}
              color={colors.textInverse}
              size={iconSizes.inline}
              strokeWidth={2.5}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  /**
   * `minHeight: 0` lets the column actually bound the list; without it
   * Android can size the ScrollView to its content and push the composer
   * off the bottom.
   */
  list: { flex: 1, minHeight: 0 },
  flex: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  /** Header → first message 8; between messages 24; last message clears the composer by 32. */
  messages: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  userRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  userBubble: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.card,
    maxWidth: '84%',
    minWidth: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  userBubbleTablet: { maxWidth: 520 },
  readable: { alignSelf: 'center', maxWidth: 720, width: '100%' },
  answer: {
    gap: spacing.sm,
    minWidth: 0,
  },
  answerActions: { flexDirection: 'row', gap: spacing.sm },
  answerLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sources: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sourcesToggle: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: sizes.buttonSmall,
  },
  citationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  citationRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: sizes.minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  citationIndex: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.full,
    height: sizes.badge,
    justifyContent: 'center',
    width: sizes.badge,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    backgroundColor: colors.backgroundSoft,
  },
  suggestions: {
    gap: spacing.md,
  },
  suggestionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: COMPACT_ROW_HEIGHT,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm,
  },
  /** Hairline + 12pt vertical padding on the 20pt gutter; `bottomInset` is added inline. */
  composerBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.backgroundSoft,
    borderRadius: radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: sizes.input,
    paddingLeft: spacing.gutter,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
  },
  composerFocused: {
    borderColor: colors.borderStrong,
  },
  input: {
    color: colors.text,
    flex: 1,
    maxHeight: COMPOSER_MAX_HEIGHT,
    minHeight: COMPOSER_CONTROL_SIZE,
    minWidth: 0,
    paddingVertical: spacing.xs,
    ...typography.body,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.action,
    borderRadius: radii.full,
    height: COMPOSER_CONTROL_SIZE,
    justifyContent: 'center',
    width: COMPOSER_CONTROL_SIZE,
  },
  sendDisabled: { opacity: 0.38 },
  pressed: { opacity: 0.72 },
});
