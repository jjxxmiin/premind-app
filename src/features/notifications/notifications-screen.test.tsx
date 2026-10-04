import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import NotificationsScreen from '@/app/notifications';
import type { StudyMaterial } from '@/types';

let mockMaterials: StudyMaterial[] = [];
let mockProcessingMaterialIds: string[] = [];
jest.mock('@/state/app-store', () => ({
  useAppStore: () => ({
    materials: mockMaterials,
    processingMaterialIds: mockProcessingMaterialIds,
    settings: { notificationsEnabled: true },
  }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('lucide-react-native', () => ({
  BadgeCheck: () => null, BellOff: () => null, ChevronRight: () => null,
  Headphones: () => null, SlidersHorizontal: () => null, TriangleAlert: () => null,
}));
jest.mock('@/components/ui', () => {
  const real = jest.requireActual('@/components/ui');
  const { View: MockView } = jest.requireActual('react-native');
  return { ...real, Screen: ({ children }: { children: ReactNode }) => <MockView>{children}</MockView> };
});

function material(status: StudyMaterial['status']): StudyMaterial {
  return {
    id: 'notification-source', projectId: 'folder', title: '내 강의',
    source: { kind: 'audio', origin: 'recording', uri: 'file://lecture.m4a', fileName: 'lecture.m4a', mimeType: 'audio/mp4' },
    status, progress: 0.3, progressLabel: '대본을 만들고 있어요', syncStatus: 'synced',
    createdAt: '2026-10-01T09:00:00.000Z', updatedAt: '2026-10-01T09:00:00.000Z',
    transcript: [], quiz: [], markers: [],
  };
}

beforeEach(() => { jest.clearAllMocks(); mockProcessingMaterialIds = []; });

it('describes an imported original as saved and makes generation an explicit tap action', async () => {
  mockMaterials = [material('imported')];
  await render(<NotificationsScreen />);
  expect(screen.getByText('가져옴')).toBeOnTheScreen();
  expect(screen.getByText('원본만 저장했어요. 눌러서 마인드팩을 만들어요.')).toBeOnTheScreen();
  expect(screen.queryByText('마인드팩을 만들고 있어요')).toBeNull();
  expect(router.push).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '원본을 저장했어요. 내 강의' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/processing/[id]', params: { id: 'notification-source' } });
});

it.each(['queued', 'transcribing', 'generating'] as const)('offers resume for inactive %s work without claiming it is running', async (status) => {
  mockMaterials = [material(status)];
  await render(<NotificationsScreen />);
  expect(screen.getByText('이어가기')).toBeOnTheScreen();
  expect(screen.getByText('멈춰 있어요. 눌러서 이어가요.')).toBeOnTheScreen();
  expect(screen.queryByText('마인드팩을 만들고 있어요')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '마인드팩 만들기를 이어가세요. 내 강의' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/processing/[id]', params: { id: 'notification-source' } });
});

it.each([['queued', '준비 중'], ['transcribing', '대본 생성'], ['generating', '생성 중']] as const)('shows the active %s phase only for a tracked processing job', async (status, label) => {
  mockMaterials = [material(status)]; mockProcessingMaterialIds = ['notification-source'];
  await render(<NotificationsScreen />);
  expect(screen.getByText(label)).toBeOnTheScreen();
  expect(screen.queryByText('이어가기')).toBeNull();
});

it('opens completed material without entering the processor', async () => {
  mockMaterials = [material('ready')];
  await render(<NotificationsScreen />);
  await fireEvent.press(screen.getByRole('button', { name: '마인드팩이 준비됐어요. 내 강의' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/material/[id]', params: { id: 'notification-source' } });
});
