import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Component, type ReactNode } from 'react';
import { Text } from 'react-native';

import { RouteError } from '@/components/ui/RouteLoading';

import type { PracticeScreenModule } from './load-practice-screen';

let mockMode = 'presentation';
const mockLoadInterview = jest.fn<Promise<PracticeScreenModule>, []>();
const mockLoadPresentation = jest.fn<Promise<PracticeScreenModule>, []>();

jest.mock('expo-router', () => ({
  router: { setParams: jest.fn() },
  useLocalSearchParams: () => ({ mode: mockMode }),
}));
jest.mock('lucide-react-native', () => ({ MessagesSquare: () => null, Presentation: () => null }));
jest.mock('./SpeakTabs', () => ({ SpeakTabs: () => null }));
jest.mock('./load-practice-screen', () => ({
  loadInterviewScreen: () => mockLoadInterview(),
  loadPresentationScreen: () => mockLoadPresentation(),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});

const presentation = { default: () => <Text>발표 화면</Text> };
const interview = { default: () => <Text>면접 화면</Text> };
const { default: SpeakScreen } = jest.requireActual<typeof import('@/app/(tabs)/speak')>('@/app/(tabs)/speak');

function pendingInterview() {
  let finish: (value: PracticeScreenModule) => void = () => {};
  const request = new Promise<PracticeScreenModule>((resolve) => { finish = resolve; });
  mockLoadInterview.mockReturnValue(request);
  return async () => {
    await act(async () => { finish(interview); await request; });
  };
}

beforeEach(() => {
  mockMode = 'presentation';
  mockLoadPresentation.mockReset().mockResolvedValue(presentation);
  mockLoadInterview.mockReset().mockResolvedValue(interview);
});

it('loads only the chosen module and removes progress as soon as it resolves', async () => {
  const finish = pendingInterview();
  await render(<SpeakScreen />);
  expect(mockLoadInterview).not.toHaveBeenCalled();
  expect(screen.getByText('발표 화면')).toBeOnTheScreen();

  mockMode = 'interview';
  await screen.rerender(<SpeakScreen />);
  expect(mockLoadInterview).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('progressbar', { name: '불러오는 중' })).toBeOnTheScreen();
  await finish();
  expect(screen.getByText('면접 화면')).toBeOnTheScreen();
  expect(screen.queryByRole('progressbar')).toBeNull();

  mockMode = 'presentation';
  await screen.rerender(<SpeakScreen />);
  expect(mockLoadPresentation).toHaveBeenCalledTimes(1);
  expect(screen.getByText('발표 화면')).toBeOnTheScreen();
});

it('ignores completion of a module after the user has switched away', async () => {
  const finish = pendingInterview();
  await render(<SpeakScreen />);
  mockMode = 'interview';
  await screen.rerender(<SpeakScreen />);
  mockMode = 'presentation';
  await screen.rerender(<SpeakScreen />);
  await finish();
  expect(screen.getByText('발표 화면')).toBeOnTheScreen();
  expect(screen.queryByText('면접 화면')).toBeNull();
  expect(screen.queryByRole('progressbar')).toBeNull();
});

it('retries a failed module through the route error UI', async () => {
  class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    state: { error: Error | null } = { error: null };
    static getDerivedStateFromError(error: Error) { return { error }; }
    render() {
      return this.state.error
        ? <RouteError error={this.state.error} retry={async () => this.setState({ error: null })} />
        : this.props.children;
    }
  }
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    mockLoadPresentation.mockRejectedValueOnce(new Error('module offline'));
    await render(<Boundary><SpeakScreen /></Boundary>);
    expect(screen.getByText('문제가 생겼어요')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('다시 시도'));
    expect(screen.getByText('발표 화면')).toBeOnTheScreen();
    expect(mockLoadPresentation).toHaveBeenCalledTimes(2);
  } finally {
    errors.mockRestore();
  }
});
