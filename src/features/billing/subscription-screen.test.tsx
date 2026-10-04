import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SubscriptionScreen from '@/app/subscription';
import { configureBilling, getStoreEntitlement, getStoreOffering, purchaseStorePackage } from '@/services/billing';
import { usePlanStatus } from './use-plan-status';

jest.mock('./use-plan-status');
let mockUserId = 'buyer';
jest.mock('./web-subscription', () => ({ fetchWebSubscription: async () => null }));
jest.mock('@/state/app-store', () => ({
  useAppStore: () => ({ session: { user: { id: mockUserId } } }),
}));
jest.mock('@/features/interview/interview-api', () => ({
  interviewServerAvailable: () => false,
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('lucide-react-native', () => ({
  Check: () => null, CreditCard: () => null, ExternalLink: () => null,
  FileText: () => null, Mail: () => null, Minus: () => null,
  RotateCcw: () => null, ShieldCheck: () => null, XCircle: () => null,
  ChevronRight: () => null, X: () => null,
}));
jest.mock('@/components/ui', () => {
  const real = jest.requireActual('@/components/ui');
  const { View: MockView } = jest.requireActual('react-native');
  return {
    ...real,
    Screen: ({ children }: { readonly children: ReactNode }) => <MockView>{children}</MockView>,
  };
});
jest.mock('@/services/billing', () => ({
  PRODUCT_IDS: { monthly: 'monthly', yearly: 'yearly' },
  isStoreBillingAvailable: () => true,
  configureBilling: jest.fn(),
  getStoreOffering: jest.fn(),
  getStoreEntitlement: jest.fn(),
  purchaseStorePackage: jest.fn(),
}));

const offering = {
  monthly: {
    cycle: 'monthly' as const,
    priceString: '₩9,900',
    perMonthString: null,
    productId: 'monthly',
    identifier: 'monthly-package',
  },
  yearly: null,
};

function TestSafeArea({ children }: { readonly children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    }}>
      {children}
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'buyer';
  jest.mocked(configureBilling).mockResolvedValue(true);
  jest.mocked(getStoreEntitlement).mockResolvedValue({
    active: false, productId: null, expiresAt: null, willRenew: false,
  });
  jest.mocked(getStoreOffering).mockResolvedValue(offering);
  jest.mocked(usePlanStatus).mockReturnValue({
    plan: 'free', renewsAt: null, usage: null, loading: false, error: false,
    refresh: async () => undefined,
  });
});

it('prevents a new purchase when the existing subscription could not be verified', async () => {
  jest.mocked(usePlanStatus).mockReturnValue({
    plan: 'free', renewsAt: null, usage: null, loading: false, error: true,
    refresh: async () => undefined,
  });

  await render(<SubscriptionScreen />, { wrapper: TestSafeArea });
  await fireEvent.press(screen.getByRole('button', { name: '구독 시작하기' }));

  expect(purchaseStorePackage).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '다시 확인' })).toBeEnabled();
});

it('reloads missing products without attempting a purchase', async () => {
  jest.mocked(getStoreOffering).mockResolvedValueOnce(null);
  await render(<SubscriptionScreen />, { wrapper: TestSafeArea });

  await fireEvent.press(screen.getByRole('button', { name: '다시 불러오기' }));

  expect(getStoreOffering).toHaveBeenCalledTimes(2);
  expect(purchaseStorePackage).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '구독 시작하기' })).toBeEnabled();
});

it('returns to an available purchase button when the store sheet is cancelled', async () => {
  jest.mocked(purchaseStorePackage).mockResolvedValue({ status: 'cancelled' });
  await render(<SubscriptionScreen />, { wrapper: TestSafeArea });

  await fireEvent.press(screen.getByRole('button', { name: '구독 시작하기' }));

  expect(purchaseStorePackage).toHaveBeenCalledWith('monthly-package');
  expect(screen.getByRole('button', { name: '구독 시작하기' })).toBeEnabled();
});

it('discards a previous account entitlement when the signed-in buyer changes', async () => {
  jest.mocked(getStoreEntitlement).mockResolvedValueOnce({
    active: true, productId: 'monthly', expiresAt: null, willRenew: true,
  });
  const view = await render(<SubscriptionScreen />, { wrapper: TestSafeArea });
  expect(screen.queryByRole('button', { name: '구독 시작하기' })).toBeNull();

  mockUserId = 'another-buyer';
  await view.rerender(<SubscriptionScreen />);

  expect(screen.getByRole('button', { name: '구독 시작하기' })).toBeEnabled();
});

it.each([configureBilling, getStoreOffering, getStoreEntitlement])(
  'recovers a rejected store initialization through a visible retry',
  async (operation) => {
    jest.mocked(operation).mockRejectedValueOnce(new Error('Store unavailable'));

    await render(<SubscriptionScreen />, { wrapper: TestSafeArea });

    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(screen.getByRole('button', { name: '구독 시작하기' })).toBeEnabled();
  },
);
