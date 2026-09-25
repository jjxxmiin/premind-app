import NetInfo from '@react-native-community/netinfo';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, PipelineSteps, Screen } from '@/components/ui';
import { refreshResultPreparation, startInterviewAnalysis } from '@/features/interview/analysis-queue';
import { subscribeInterviewSessions } from '@/features/interview/interview-storage';
import { derivePreparationState } from '@/features/interview/result-preparation';
import { getResultPreparationCopy, RESULT_SLOW_NOTICE_MS } from '@/features/interview/result-preparation-copy';
import { resolveSessionSource } from '@/features/interview/session-source';
import type { InterviewSession } from '@/features/interview/types';
import { decorative } from '@/lib/a11y';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

/**
 * 결과 준비: 답변마다 글로 옮기고(전사), 모두 끝나면 한 번에 피드백을 받는다.
 * 최대 2분을 기다리고, 늦어지면 받은 것까지로 결과를 연다. 실패한 답변은
 * 결과 화면에서 다시 시도할 수 있다. (interview-result-preparing.tsx)
 */
export default function InterviewPreparingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [online, setOnline] = useState(true);
  const [slow, setSlow] = useState(false);
  const [textIndex, setTextIndex] = useState(0);
  const reading = useRef(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (reading.current || !id) return;
    reading.current = true;
    try {
      const next = await refreshResultPreparation(id);
      if (!mounted.current) return;
      setSession(next);
      setLoaded(true);
      setLoadError(false);
      const startedAt = next?.resultPreparation?.startedAt;
      setSlow(Boolean(startedAt && Date.now() - Date.parse(startedAt) >= RESULT_SLOW_NOTICE_MS));
    } catch {
      if (mounted.current) {
        setLoaded(true);
        setLoadError(true);
      }
    } finally {
      reading.current = false;
    }
  }, [id]);

  useEffect(() => {
    mounted.current = true;
    if (!id) return;
    const first = setTimeout(() => {
      void refresh();
      void startInterviewAnalysis(id);
    }, 0);
    const unsubscribe = subscribeInterviewSessions((changed) => {
      if (changed === id) void refresh();
    });
    const timer = setInterval(() => void refresh(), 1_000);
    const offNet = NetInfo.addEventListener((state) => {
      const next = state.isConnected !== false;
      setOnline(next);
      if (next) void startInterviewAnalysis(id);
    });
    return () => {
      mounted.current = false;
      clearTimeout(first);
      clearInterval(timer);
      unsubscribe();
      offNet();
    };
  }, [id, refresh]);

  const source = session ? resolveSessionSource(session) : null;
  const state = session ? derivePreparationState(session, source?.questions.map((question) => question.id)) : null;

  useEffect(() => {
    if (!id || !state) return;
    if (state.kind === 'complete' || state.kind === 'open-report') router.replace({ pathname: '/interview/report/[id]', params: { id } });
    if (state.kind === 'unfinished') router.replace({ pathname: '/interview/room/[id]', params: { id } });
  }, [id, state]);

  const copy = getResultPreparationCopy(state, online, slow);
  useEffect(() => {
    if (!copy.animated || copy.texts.length < 2) return;
    const timer = setInterval(() => setTextIndex((value) => (value + 1) % copy.texts.length), 3_500);
    return () => clearInterval(timer);
  }, [copy.animated, copy.key, copy.texts.length]);

  const problem = loadError || (loaded && !session) || state?.kind === 'problem';
  const transcribed = session ? session.attempts.filter((attempt) => attempt.analysis && ['ready', 'failed', 'unavailable'].includes(attempt.analysis.transcription.status)).length : 0;
  const withAudio = session ? session.attempts.filter((attempt) => attempt.analysis).length : 0;
  const phaseIndex = state?.kind === 'working' ? (state.phase === 'transcription' ? 0 : 1) : 0;

  return (
    <Screen centered maxWidth={560}>
      {problem ? (
        <Card style={styles.card}>
          <View {...decorative} style={styles.icon}>
            <AlertCircle color={colors.warningStrong} size={iconSizes.section} />
          </View>
          <AppText align="center" variant="heading">
            연습 기록을 열지 못했어요.
          </AppText>
          <AppText align="center" tone="muted" variant="body">
            연습 기록에서 다시 확인해 주세요.
          </AppText>
          <Button fullWidth onPress={() => router.replace('/interview/history')}>
            연습 기록으로
          </Button>
        </Card>
      ) : (
        <View style={styles.card}>
          <AppText align="center" variant="heroTitle">
            연습하느라 수고했어요!
          </AppText>
          <AppText accessibilityLiveRegion="polite" align="center" tone="brand" variant="heading">
            {copy.texts[textIndex % copy.texts.length]}
          </AppText>
          <AppText align="center" tone="muted" variant="body">
            {copy.description}
          </AppText>
          <PipelineSteps
            active={state?.kind === 'working'}
            stageIndex={phaseIndex}
            label={withAudio ? `내가 한 말 정리 ${transcribed} / ${withAudio}` : undefined}
            progress={phaseIndex === 0 ? (withAudio ? (transcribed / withAudio) * 0.6 : 0.2) : 0.8}
            steps={['내가 한 말 정리', '답변 피드백']}
          />
          <AppText accessibilityLiveRegion="polite" align="center" tone="muted" variant="meta">
            {copy.note}
          </AppText>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'stretch', gap: spacing.lg, width: '100%' },
  icon: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.warningSoft, borderRadius: radii.full, height: 48, justifyContent: 'center', width: 48 },
});
