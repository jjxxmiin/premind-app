import { router } from 'expo-router';
import { useEffect } from 'react';

import { Screen } from '@/components/ui';

/**
 * The 녹음 tab is a launcher: its tab-bar press is intercepted in the tabs
 * layout and opens `/record` directly. This screen only exists for deep links
 * and old bookmarks, and forwards them to the recorder as well.
 */
export default function CreateRedirectScreen() {
  useEffect(() => {
    router.replace('/record');
  }, []);

  return <Screen padded={false} safeAreaEdges={['top', 'left', 'right']} />;
}
