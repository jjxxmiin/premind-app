import { router } from 'expo-router';
import { useEffect } from 'react';

import { Screen } from '@/components/ui';

/**
 * "질문" no longer has a tab: asking lives inside each study pack. Old links
 * to the picker land on home, where every pack's menu leads to it.
 */
export default function ChatRedirectScreen() {
  useEffect(() => {
    router.replace('/(tabs)');
  }, []);

  return <Screen padded={false} safeAreaEdges={['top', 'left', 'right']} />;
}
