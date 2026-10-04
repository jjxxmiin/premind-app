import * as Clipboard from 'expo-clipboard';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router, useNavigation } from 'expo-router';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { useScreenOverlay } from '@/components/ui/Screen';
import { AppText, AuthField, Button, Card, Dialog, EmptyState, ListRow, Screen, StatusBadge, Toast, useToast } from '@/components/ui';
import { transcriptText, type LiveTranscriptDraft } from '@/features/recording/live-transcript-repository';
import { useLiveTranscript } from '@/features/recording/use-live-transcript';
import { formatDuration } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { goBackOrReplace } from '@/lib/navigation';
import { useAppStore } from '@/state/app-store';
import { spacing } from '@/theme/tokens';

export default function LiveTranscriptRoute() {
  const { session } = useAppStore();
  const t = useT();
  if (!session) return <Screen><AppText>{t('로그인 후 이용해 주세요.')}</AppText></Screen>;
  return <LiveTranscriptScreen key={session.user.id} workspaceId={session.user.id} />;
}

function LiveTranscriptScreen({ workspaceId }: { readonly workspaceId: string }) {
  const t = useT();
  const navigation = useNavigation();
  const recorder = useLiveTranscript(workspaceId);
  const toast = useToast();
  const [title, setTitle] = useState(() => t('자막 녹음'));
  const [selected, setSelected] = useState<LiveTranscriptDraft | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(10);
  const transcriptScroll = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const state = recorder.state;
  const draft = state?.draft ?? selected;
  const phase = state?.phase;
  const busy = recorder.preparing || phase === 'starting' || phase === 'pausing' || phase === 'saving';
  const active = busy || phase === 'recording';
  const dirty = Boolean(state?.unsaved && (state.draft.paragraphs.length || state.draft.interim || state.draft.parts.length));

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (active || dirty) { event.preventDefault(); setLeaving(true); }
  }), [active, dirty, navigation]);

  const back = () => {
    if (active || dirty) { setLeaving(true); return; }
    if (state) { void recorder.reset(); return; }
    if (selected) { setSelected(null); return; }
    goBackOrReplace('/record');
  };
  const share = async () => {
    if (!draft || exporting) return;
    setExporting(true);
    try {
      const text = transcriptText(draft);
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(text);
        toast.show(t('대본을 복사했어요'));
      } else if (await Sharing.isAvailableAsync()) {
        const file = new File(Paths.cache, `${draft.id}.txt`);
        file.write(text);
        await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: draft.title, UTI: 'public.plain-text' });
      } else {
        await Share.share({ message: text, title: draft.title });
      }
    } catch (error) {
      toast.show(error instanceof Error ? t('대본을 내보내지 못했어요. 다시 시도해 주세요.') : t('공유를 열지 못했어요.'));
    } finally { setExporting(false); }
  };
  const phaseLabel = recorder.preparing ? '음성 인식 준비 중' : ({
    idle: '준비', starting: '마이크 연결 중', recording: '듣고 있어요',
    pausing: '대본 정리 중', paused: '일시정지', saving: '마지막 문장 저장 중',
    completed: '녹음 완료', interrupted: '녹음 중단',
  } as const)[phase ?? 'idle'];

  return (
    <Screen padded={false} overlay={<Toast message={toast.message} />}>
      <AppHeader onBack={back} title={t('자막 녹음')} />
      <ScrollView ref={transcriptScroll} style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        scrollEventThrottle={100}
        onScroll={({ nativeEvent }) => { nearBottom.current = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y < spacing.massive; }}
        onContentSizeChange={() => { if (phase === 'recording' && nearBottom.current) transcriptScroll.current?.scrollToEnd({ animated: true }); }}>
        {!draft ? <>
          <AppText variant="heroTitle">{t('말하는 대로 자막이 떠요')}</AppText>
          <Card style={styles.card}>
            <AuthField label={t('녹음 제목')} value={title} onChangeText={setTitle} maxLength={80} editable={!busy} />
            {/* What the start button's 동의 refers to; it stays visible above it. */}
            <AppText tone="muted">{t('기기의 음성 인식 서비스를 사용해요. 서비스에 따라 음성이 Google 또는 Apple 서버로 전송될 수 있어요.')}</AppText>
            <AppText tone="muted">{t('화면을 벗어나거나 잠그면 일시정지해요')}</AppText>
            <Button disabled={!recorder.supported || !title.trim()} loading={busy} variant="primary" onPress={() => void recorder.start(title)}>{t('동의하고 자막 녹음 시작')}</Button>
            {!recorder.supported ? <AppText tone="muted">{t('Android 13 이상이나 iOS 앱에서 쓸 수 있어요')}</AppText> : null}
            <Button variant="secondary" disabled={busy} onPress={() => router.dismissTo('/record')}>{t('일반 녹음으로 시작')}</Button>
          </Card>
          <AppText variant="heading">{t('저장한 대본')}</AppText>
          {recorder.loadingHistory ? <AppText tone="muted">{t('대본을 불러오고 있어요')}</AppText>
            : recorder.history.length ? <Card padding={false}>
              {recorder.history.slice(0, historyLimit).map((item) => <ListRow key={item.id} title={item.title}
                subtitle={t('{n}문장 / {state}', { n: item.paragraphs.length, state: t(item.status === 'completed' ? '완료' : '이어서 녹음 가능') })}
                onPress={() => setSelected(item)} />)}
              {recorder.history.length > historyLimit ? <Button variant="ghost" onPress={() => setHistoryLimit((value) => value + 10)}>{t('더 보기')}</Button> : null}
            </Card> : <AppText tone="muted">{t('아직 저장한 대본이 없어요')}</AppText>}
        </> : <>
          <AppText variant="heading">{draft.title}</AppText>
          <StatusBadge label={t(state ? phaseLabel : draft.status === 'completed' ? '저장한 대본' : '이어서 녹음 가능')} tone={phase === 'recording' ? 'brand' : 'neutral'} />
          <AppText tone="muted" variant="meta" accessibilityLiveRegion="polite">{t(state?.unsaved ? '기기에 저장 중…' : '이 기기에 자동 저장됨')}</AppText>
          {draft.paragraphs.map((text, index) => <AppText key={index} selectable>{text}</AppText>)}
          {draft.interim ? <Card style={styles.card}><AppText variant="badge">{t('인식 중')}</AppText><AppText selectable tone="muted">{draft.interim}</AppText></Card> : null}
          {!draft.paragraphs.length && !draft.interim ? <EmptyState title={t(phase === 'recording' ? '이제 말씀해 주세요' : '아직 대본이 없어요')} description={t('조용한 곳에서 마이크 가까이 말씀해 주세요')} /> : null}
          {!active && draft.parts.length ? <Card style={styles.card}>
            <AppText variant="heading">{t('원본 녹음')}</AppText>
            <AudioParts parts={draft.parts} />
          </Card> : null}
          {!active && draft.status !== 'completed' ? <Button loading={exporting} disabled={!draft.paragraphs.length && !draft.interim} variant="ghost" onPress={() => void share()}>{t(Platform.OS === 'web' ? '대본 복사' : '대본 파일 내보내기')}</Button> : null}
        </>}
        {recorder.error || state?.error ? <Card style={styles.card}><AppText accessibilityRole="alert" tone="negative">{t(recorder.error ?? state?.error ?? '')}</AppText>
          {state?.unsaved ? <Button variant="secondary" onPress={recorder.retrySave}>{t('다시 저장')}</Button> : null}
          {!active ? <Button variant="ghost" onPress={() => router.dismissTo('/record')}>{t('일반 녹음으로 전환')}</Button> : null}
        </Card> : null}
      </ScrollView>
      {draft ? <TranscriptActions>
        {busy ? <Button loading variant="primary">{t(phaseLabel)}</Button>
          : phase === 'recording' ? <><Button variant="primary" onPress={recorder.pause}>{t('일시정지')}</Button><Button variant="secondary" onPress={recorder.finish}>{t('종료하고 저장')}</Button></>
          : <>
            {phase !== 'completed' && draft.status !== 'completed' ? <Button disabled={!recorder.supported || dirty} variant="primary" onPress={() => state ? recorder.resume() : void recorder.start(draft.title, draft)}>{t('이어서 녹음')}</Button> : null}
            {state && phase !== 'completed' ? <Button disabled={dirty} variant="secondary" onPress={recorder.finish}>{t('종료하고 저장')}</Button> : null}
            {draft.status === 'completed' ? <Button loading={exporting} disabled={!draft.paragraphs.length && !draft.interim} variant="primary" onPress={() => void share()}>{t(Platform.OS === 'web' ? '대본 복사' : '대본 파일 내보내기')}</Button> : null}
            {!state || phase === 'completed' ? <Button disabled={dirty} variant="secondary" onPress={back}>{t('대본 목록으로')}</Button> : null}
          </>}
      </TranscriptActions> : null}
      <Dialog visible={leaving} title={t('녹음을 저장한 뒤 나가요')} onRequestClose={() => setLeaving(false)}
        cancel={{ label: t('계속 보기'), onPress: () => setLeaving(false) }}
        confirm={{ label: t(dirty && !active ? '다시 저장' : '종료하고 저장'), disabled: busy,
          onPress: () => { if (dirty && !active) recorder.retrySave(); else recorder.finish(); setLeaving(false); } }} />
    </Screen>
  );
}

function TranscriptActions({ children }: PropsWithChildren) {
  const { setDockHeight } = useScreenOverlay();
  useEffect(() => () => setDockHeight(0), [setDockHeight]);
  return <View style={styles.actions} onLayout={({ nativeEvent }) => setDockHeight(nativeEvent.layout.height)}>{children}</View>;
}

function AudioParts({ parts }: { readonly parts: LiveTranscriptDraft['parts'] }) {
  const t = useT();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') player.pause(); });
    return () => subscription.remove();
  }, [player]);
  return <>{parts.map((part, index) => <View key={part.uri} style={styles.audioPart}>
    <AppText variant="meta">{t('구간 {n}', { n: index + 1 })} / {formatDuration(part.durationMillis / 1000)}</AppText>
    {part.finalized ? <Button size="small" variant="secondary" loading={selectedUri === part.uri && status.isBuffering} onPress={() => {
      try {
        setError(false);
        if (selectedUri === part.uri && status.playing) player.pause();
        else { player.pause(); player.replace(part.uri); setSelectedUri(part.uri); player.play(); }
      } catch (failure) { setError(failure instanceof Error); }
    }}>{t(selectedUri === part.uri && status.playing ? '정지' : '재생')}</Button>
      : <AppText tone="muted" variant="meta">{t('재생할 수 없는 원본이에요')}</AppText>}
  </View>)}
  {error || status.error ? <AppText tone="negative">{t('원본을 재생하지 못했어요.')}</AppText> : null}</>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  card: { gap: spacing.md },
  content: { gap: spacing.lg, padding: spacing.gutter },
  actions: { gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingVertical: spacing.md },
  audioPart: { gap: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
});
