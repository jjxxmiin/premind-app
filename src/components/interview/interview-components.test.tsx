import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { webBackupPayload } from '@/features/interview/__fixtures__/web-backup';
import type { CustomInterviewQuestion, InterviewSession } from '@/features/interview/types';

import { AllowanceCard } from './AllowanceCard';
import { InterviewSessionRow } from './InterviewSessionRow';
import { QuestionListEditor } from './QuestionListEditor';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/interview/interview-media', () => ({ interviewMedia: {} }));

const base = { planRenewsAt: null, questions: { used: 0, limit: 1 }, periodEnd: null };

describe('AllowanceCard', () => {
  it('says the free AI trial is still there and opens the plans', async () => {
    const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };
    await render(<AllowanceCard allowance={{ ...base, plan: 'free', ai: { used: 0, limit: 0, freeTrial: true } }} />);
    expect(screen.getByText('AI 피드백 무료 체험 1회가 남았어요')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button'));
    expect(router.push).toHaveBeenCalledWith('/subscription');
  });

  it('counts this month for 스탠다드 without a plan link', async () => {
    await render(<AllowanceCard allowance={{ ...base, plan: 'standard', ai: { used: 3, limit: 10, freeTrial: false } }} />);
    expect(screen.getByText('이번 달 AI 피드백 7회 남았어요')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

it('lists a practice by what was done, never by a score', async () => {
  const onPress = jest.fn();
  await render(<InterviewSessionRow onPress={onPress} session={webBackupPayload as InterviewSession} />);
  expect(screen.getByText('한빛전자 영업관리 면접 연습')).toBeTruthy();
  expect(screen.getByText(/^2 \/ 2개 답변 \/ /)).toBeTruthy();
  expect(screen.getByLabelText(/AI 피드백 연습, 연습 완료/)).toBeTruthy();
  expect(screen.queryByText(/점수|합격/)).toBeNull();
  await fireEvent.press(screen.getByRole('button'));
  expect(onPress).toHaveBeenCalled();
});

function EditorHarness({ initial }: { initial: CustomInterviewQuestion[] }) {
  const [questions, setQuestions] = useState(initial);
  return <QuestionListEditor onAdd={() => undefined} onChange={setQuestions} questions={questions} />;
}

it('removes a 자소서 question together with its 꼬리질문', async () => {
  await render(
    <EditorHarness
      initial={[
        { id: 'c', question: '자기소개를 해 주세요.', answerDurationSec: 90, kind: 'common' },
        { id: 'r', question: '맡은 역할을 설명해 주세요.', answerDurationSec: 120, kind: 'resume', sourceQuote: '예산을 맡았다' },
        { id: 'f', question: '가장 어려웠던 판단은요?', answerDurationSec: 90, kind: 'follow_up', parentQuestionId: 'r' },
      ]}
    />,
  );
  expect(screen.getByText('꼬리질문')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('2번 질문 지우기'));
  expect(screen.queryByText('꼬리질문')).toBeNull();
  expect(screen.getAllByLabelText(/번 질문 지우기/)).toHaveLength(1);
});
