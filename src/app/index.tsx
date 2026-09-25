import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { BrandSplash } from '@/components/BrandSplash';
import { peekReturnTo } from '@/lib/return-to';
import { useAppStore } from '@/state/app-store';

/**
 * How long the launch screen stays up once the app is ready.
 *
 * Hydration usually finishes in a few frames, which would flash the brand for
 * long enough to notice and not long enough to read. Holding it briefly turns
 * a stutter into a deliberate opening; it never *adds* to a slow launch,
 * because it runs alongside hydration rather than after it.
 */
const MINIMUM_SPLASH_MS = 900;

export default function EntryScreen() {
  const { isHydrated, session } = useAppStore();
  const [held, setHeld] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setHeld(false), MINIMUM_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!isHydrated || held) {
    return <BrandSplash />;
  }

  // Signing in lands here (the protected stack falls back to index): a
  // visitor who opened an address while signed out goes on to it.
  return <Redirect href={session ? ((peekReturnTo() ?? '/(tabs)') as Href) : '/login'} />;
}
