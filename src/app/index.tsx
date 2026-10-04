import { Redirect, type Href } from 'expo-router';

import { RouteLoading } from '@/components/ui/RouteLoading';
import { peekReturnTo } from '@/lib/return-to';
import { useAppStore } from '@/state/app-store';

export default function EntryScreen() {
  const { isHydrated, session } = useAppStore();

  if (!isHydrated) {
    return <RouteLoading />;
  }

  // Signing in lands here (the protected stack falls back to index): a
  // visitor who opened an address while signed out goes on to it.
  return <Redirect href={session ? ((peekReturnTo() ?? '/(tabs)') as Href) : '/login'} />;
}
