import { fireEvent, render, screen } from '@testing-library/react-native';

import { lensHome } from '@/components/lens/lens-home';
import { PresentationOverview } from '@/components/speak/PresentationOverview';
import type { StudyMaterial } from '@/types';

import { LibraryWelcome } from './LibraryWelcome';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/app/Tappable', () => ({
  Tappable: jest.requireActual('react-native').Pressable,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 24 }),
}));

function reportMaterial(id: string, day: number): StudyMaterial {
  const date = `2026-09-${String(day).padStart(2, '0')}T09:00:00.000Z`;
  return {
    id,
    projectId: 'practice',
    title: id,
    source: {
      kind: 'audio',
      origin: 'recording',
      uri: `file://${id}.m4a`,
      fileName: `${id}.m4a`,
      mimeType: 'audio/mp4',
    },
    status: 'ready',
    progress: 1,
    progressLabel: '',
    syncStatus: 'synced',
    createdAt: date,
    updatedAt: date,
    transcript: [],
    quiz: [],
    markers: [],
    lensReport: { overall: 4, rubric: [], strengths: [], improvements: [], priority: null },
  };
}

it('opens the common add entry from the first-use library', async () => {
  const onAdd = jest.fn();
  await render(<LibraryWelcome onAdd={onAdd} />);

  await fireEvent.press(screen.getByRole('button', { name: '자료 추가' }));

  expect(onAdd).toHaveBeenCalledTimes(1);
});

it('opens an older report from full history while the home remains bounded', async () => {
  const materials = Array.from({ length: 8 }, (_, index) => reportMaterial(`발표 ${index + 1}`, index + 1));
  const onOpen = jest.fn();
  await render(
    <PresentationOverview
      evaluatingIds={[]}
      home={lensHome(materials, [])}
      onOpen={onOpen}
      projectTitle={() => '발표 연습'}
    />,
  );
  expect(screen.queryByText('발표 1')).toBeNull();
  expect(screen.getByText('발표 8')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '전체 8개' }));
  await fireEvent.press(screen.getByRole('button', { name: '발표 1' }));

  expect(onOpen).toHaveBeenCalledWith(materials[0]);
  expect(screen.queryByText('발표 1')).toBeNull();
});

it('switches between the latest report and its trend in one content area', async () => {
  const materials = [reportMaterial('첫 발표', 1), reportMaterial('최근 발표 자료', 2)];
  await render(
    <PresentationOverview
      evaluatingIds={[]}
      home={lensHome(materials, [])}
      onOpen={jest.fn()}
      projectTitle={() => '발표 연습'}
    />,
  );

  await fireEvent.press(screen.getByRole('tab', { name: '변화 추이' }));

  expect(screen.queryByText('최근 발표 자료')).toBeNull();
  expect(screen.getByLabelText(/^평가 추이, 2번/)).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('tab', { name: '최근 평가' }));
  expect(screen.getByText('최근 발표 자료')).toBeOnTheScreen();
  expect(screen.queryByLabelText(/^평가 추이, 2번/)).toBeNull();
});
