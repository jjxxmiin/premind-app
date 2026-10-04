import { render, screen } from '@testing-library/react-native';

import EntryScreen from '@/app/index';

const mockState: { isHydrated: boolean; session: object | null } = { isHydrated: true, session: {} };
let mockReturnTo: string | null = null;

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return { Redirect: ({ href }: { href: string }) => <Text testID="destination">{href}</Text> };
});
jest.mock('@/state/app-store', () => ({ useAppStore: () => mockState }));
jest.mock('@/lib/return-to', () => ({ peekReturnTo: () => mockReturnTo }));
jest.mock('./BrandSplash', () => {
  const { Text } = jest.requireActual('react-native');
  return { BrandSplash: () => <Text>브랜드 화면</Text> };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});

beforeEach(() => {
  jest.useFakeTimers();
  mockState.isHydrated = true;
  mockState.session = {};
  mockReturnTo = null;
});
afterEach(() => jest.useRealTimers());

it('redirects a ready session without advancing a branding timer', async () => {
  await render(<EntryScreen />);
  expect(screen.getByTestId('destination')).toHaveTextContent('/(tabs)');
});

it('opens the requested screen immediately after authentication', async () => {
  mockReturnTo = '/notifications';
  await render(<EntryScreen />);
  expect(screen.getByTestId('destination')).toHaveTextContent('/notifications');
});

it('shows loading only until hydration finishes, then opens login', async () => {
  mockState.isHydrated = false;
  mockState.session = null;
  await render(<EntryScreen />);
  expect(screen.getByRole('progressbar', { name: '불러오는 중' })).toBeOnTheScreen();
  mockState.isHydrated = true;
  await screen.rerender(<EntryScreen />);
  expect(screen.getByTestId('destination')).toHaveTextContent('/login');
});
