import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { mockMaterials } from '@/data/mock-data';
import type { GroundedChatAnswer } from '@/features/chat';
import { studyMaterialService } from '@/services/study-material-service';

import { StudyChat } from './StudyChat';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/components/app/Tappable', () => ({
  Tappable: jest.requireActual('react-native').Pressable,
}));
jest.mock('@/services/study-material-service', () => ({
  studyMaterialService: { askMaterial: jest.fn() },
}));

const ask = jest.mocked(studyMaterialService.askMaterial);
const material = mockMaterials[0];
if (!material) throw new Error('A demo material is required');

function deferredAnswer() {
  let resolve!: (answer: GroundedChatAnswer) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<GroundedChatAnswer>((fulfill, fail) => {
    resolve = fulfill;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const answer: GroundedChatAnswer = {
  status: 'answered',
  answer: '자료에서 찾은 답변이에요.',
  citations: [],
  confidence: 1,
  mode: 'server-grounded',
};

beforeEach(() => ask.mockReset());

it('keeps pending feedback visible, prevents duplicate sends, and recovers after a failed answer', async () => {
  const first = deferredAnswer();
  ask.mockReturnValueOnce(first.promise).mockResolvedValueOnce(answer);
  await render(<StudyChat material={material} />);
  await fireEvent.changeText(screen.getByLabelText('질문 입력'), '과적합이 뭐야?');
  await fireEvent.press(screen.getByRole('button', { name: '질문 보내기' }));

  expect(screen.getByText('대본에서 근거를 찾고 있어요')).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('질문 입력'), '두 번째 질문');
  expect(screen.getByRole('button', { name: '질문 보내기' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: '질문 보내기' }));
  expect(ask).toHaveBeenCalledTimes(1);

  await act(async () => first.reject(new Error('connection interrupted')));
  expect(screen.queryByText('대본에서 근거를 찾고 있어요')).toBeNull();
  expect(screen.getByText('답변을 만들지 못했어요. 다시 시도해 주세요.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  expect(ask).toHaveBeenLastCalledWith(material, '과적합이 뭐야?', expect.any(Object));
  expect(await screen.findByText(answer.answer)).toBeOnTheScreen();
});

it('aborts an unfinished answer when leaving the chat', async () => {
  const pending = deferredAnswer();
  ask.mockReturnValueOnce(pending.promise);
  const result = await render(<StudyChat initialQuestion="과적합이 뭐야?" material={material} />);
  const signal = ask.mock.calls[0]?.[2]?.signal;
  expect(signal?.aborted).toBe(false);

  await result.unmount();

  expect(signal?.aborted).toBe(true);
  await act(async () => pending.resolve(answer));
});
