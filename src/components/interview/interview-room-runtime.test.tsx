import { act, fireEvent, render, screen } from '@testing-library/react-native';

import InterviewRoomScreen from '@/app/interview/room/[id]';
import { commitUsage, reserveUsage } from '@/features/interview/interview-api';
import { getSession } from '@/features/interview/interview-storage';
import type { InterviewSession } from '@/features/interview/types';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'runtime-practice' }), router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock('@/components/interview/CameraPreview', () => ({ CameraPreview: () => null }));
jest.mock('@/features/interview/analysis-queue', () => ({ startInterviewAnalysis: jest.fn() }));
jest.mock('@/features/interview/interview-media', () => ({ interviewMedia: {} }));
jest.mock('@/features/interview/interview-storage', () => ({ getSession: jest.fn(), mutateSession: jest.fn(), newId: () => 'new-id' }));
jest.mock('@/features/interview/interview-api', () => ({
  interviewServerAvailable: () => true,
  isPlanLimit: () => false,
  reserveUsage: jest.fn(),
  commitUsage: jest.fn(async () => undefined),
  cancelUsage: jest.fn(async () => undefined),
}));
jest.mock('@/features/interview/use-interview-account', () => ({ refreshInterviewAccount: jest.fn(async () => undefined) }));
jest.mock('@/features/interview/use-answer-recorder', () => {
  const recorder = { support: () => ({ ok: true }), prepare: jest.fn(), start: jest.fn(async () => true), stop: jest.fn(), release: jest.fn(), discard: jest.fn(), previewStream: () => null };
  return { useAnswerRecorder: () => recorder };
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const practice: InterviewSession = {
  id: 'runtime-practice', companyId: 'public-common', status: 'active', currentQuestionIndex: 0,
  attempts: [], createdAt: '2026-10-04T00:00:00Z', feedbackMode: 'basic', billingVersion: 1,
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(getSession).mockResolvedValue(practice);
  jest.mocked(commitUsage).mockResolvedValue(undefined);
});
afterEach(() => { jest.useRealTimers(); });

it('keeps the question visible and announces a delayed usage reservation before recording starts', async () => {
  let finishReservation: (() => void) | undefined;
  let finishCommit: (() => void) | undefined;
  jest.mocked(commitUsage).mockImplementation(() => new Promise((resolve) => { finishCommit = () => resolve(undefined); }));
  jest.mocked(reserveUsage).mockImplementation(() => new Promise((resolve) => {
    finishReservation = () => resolve({ result: { id: 'usage', token: 'token', kind: 'basic', alreadyPaid: false } });
  }));
  await render(<InterviewRoomScreen />);
  await act(async () => { await Promise.resolve(); });
  await act(async () => { jest.advanceTimersByTime(700); });
  await fireEvent.press(screen.getByRole('button', { name: '바로 답하기' }));
  expect(reserveUsage).toHaveBeenCalledTimes(1);
  expect(commitUsage).not.toHaveBeenCalled();
  expect(screen.getByRole('header', { name: '지원한 기관과 직무에 맞춰 자신을 소개해 주세요.' })).toBeOnTheScreen();
  expect(screen.getByText('답변을 시작하고 있어요.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '바로 답하기' })).toBeNull();
  await act(async () => { finishReservation?.(); });
  expect(commitUsage).toHaveBeenCalledTimes(1);
  expect(screen.getByText('답변을 시작하고 있어요.')).toBeOnTheScreen();
  await act(async () => { finishCommit?.(); });
  expect(screen.getByRole('button', { name: '답변 마치기' })).toBeOnTheScreen();
});

it('offers an in-place retry after a failed reservation instead of trapping the learner', async () => {
  jest.mocked(reserveUsage).mockRejectedValueOnce(new Error('인터넷 연결을 확인한 뒤 다시 시도해 주세요.'));
  await render(<InterviewRoomScreen />);
  await act(async () => { await Promise.resolve(); });
  await act(async () => { jest.advanceTimersByTime(700); });
  await fireEvent.press(screen.getByRole('button', { name: '바로 답하기' }));
  expect(screen.getByText('인터넷 연결을 확인한 뒤 다시 시도해 주세요.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeOnTheScreen();
  jest.mocked(reserveUsage).mockResolvedValueOnce({ result: { id: 'usage', token: 'token', kind: 'basic', alreadyPaid: false } });
  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  expect(screen.getByRole('button', { name: '답변 마치기' })).toBeOnTheScreen();
  expect(reserveUsage).toHaveBeenCalledTimes(2);
  expect(commitUsage).toHaveBeenCalledTimes(1);
});

it('keeps the native question column intrinsic and the stage scrollable for long questions', async () => {
  await render(<InterviewRoomScreen />);
  await act(async () => { await Promise.resolve(); });
  const heading = screen.getByRole('header', { name: '지원한 기관과 직무에 맞춰 자신을 소개해 주세요.' });
  const column = heading.parent?.parent;
  expect(column).toBeTruthy();
  const { StyleSheet } = jest.requireActual<typeof import('react-native')>('react-native');
  expect(StyleSheet.flatten(column?.props.style)?.flex).toBeUndefined();
  expect(screen.getByTestId('interview-question-stage').props.contentContainerStyle).toBeDefined();
});
