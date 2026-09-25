import { Share2, Undo2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';

import { Button, Dialog } from '@/components/ui';
import { getEffectiveTranscript } from '@/features/interview/analysis';
import { fetchShareStatus, shareWithOrg, unshareWithOrg } from '@/features/interview/interview-api';
import type { SessionSource } from '@/features/interview/session-source';
import type { InterviewSession } from '@/features/interview/types';
import { useT } from '@/lib/i18n';
import { colors, iconSizes } from '@/theme/tokens';

function buildShare(session: InterviewSession, source: SessionSource) {
  const items = source.questions
    .map((question) => {
      const attempt = session.attempts
        .filter((item) => item.questionId === question.id && item.status !== 'failed')
        .sort((a, b) => a.attemptNo - b.attemptNo)
        .at(-1);
      const transcript = attempt?.analysis?.transcription.transcript;
      const result = attempt?.analysis?.evaluation.status === 'ready' ? attempt.analysis.evaluation.result : undefined;
      return {
        question: question.text,
        transcript: transcript ? getEffectiveTranscript(transcript) : '',
        durationMs: attempt?.durationMs ?? 0,
        nextFocus: result?.nextFocus ?? null,
        missingPoints: result?.missingPoints ?? [],
      };
    })
    .filter((item) => item.durationMs > 0);
  return { sessionId: session.id, title: source.title, items, nextPractice: session.feedbackSummary?.result?.nextPractice ?? null };
}

/**
 * 기관 초대 코드로 참여한 학생에게만 보인다. 고른 연습의 글(질문, 전사문,
 * 다음 연습 포인트)만 담당 선생님과 나눈다. 영상, 음성, 자기소개서는 보내지 않는다.
 */
export function ShareWithOrg({
  session,
  source,
  orgName,
  onMessage,
}: {
  session: InterviewSession;
  source: SessionSource;
  orgName: string;
  onMessage: (message: string) => void;
}) {
  const t = useT();
  const [shared, setShared] = useState<boolean | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchShareStatus(session.id)
      .then((value) => active && setShared(value))
      .catch(() => active && setShared(false));
    return () => {
      active = false;
    };
  }, [session.id]);

  if (shared === null) return null;

  async function share() {
    setBusy(true);
    try {
      const body = buildShare(session, source);
      if (!body.items.length) throw new Error('공유할 답변이 아직 없어요.');
      await shareWithOrg(body);
      setShared(true);
      onMessage(t('{org} 선생님께 공유했어요.', { org: orgName }));
    } catch (reason) {
      onMessage(t(reason instanceof Error && reason.message ? reason.message : '공유하지 못했어요.'));
    } finally {
      setBusy(false);
    }
  }

  async function unshare() {
    setBusy(true);
    try {
      await unshareWithOrg(session.id);
      setShared(false);
      onMessage(t('공유를 취소했어요.'));
    } catch {
      onMessage(t('공유를 취소하지 못했어요.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {shared ? (
        <Button leftIcon={<Undo2 color={colors.text} size={iconSizes.inline} />} loading={busy} onPress={() => void unshare()} variant="outline">
          {t('선생님 공유 취소')}
        </Button>
      ) : (
        <Button leftIcon={<Share2 color={colors.text} size={iconSizes.inline} />} loading={busy} onPress={() => setConfirm(true)} variant="outline">
          {t('선생님께 공유하기')}
        </Button>
      )}
      <Dialog
        cancel={{ label: t('취소'), onPress: () => setConfirm(false) }}
        confirm={{
          label: t('공유하기'),
          onPress: () => {
            setConfirm(false);
            void share();
          },
        }}
        description={t('질문, 내가 한 말(전사문), 말한 시간, 다음 연습 포인트만 공유돼요. 영상과 음성, 자기소개서는 공유되지 않고, 언제든 공유를 취소할 수 있어요.')}
        onRequestClose={() => setConfirm(false)}
        title={t('{org} 선생님께 이 연습을 공유할까요?', { org: orgName })}
        visible={confirm}
      />
    </>
  );
}
