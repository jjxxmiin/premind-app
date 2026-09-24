import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { Screen } from '@/components/ui';

/**
 * The library is the home tab now. This route stays so old links keep
 * working; a `newProject` request is carried across so a "새 프로젝트" deep
 * link still opens the sheet on home.
 */
export default function LibraryRedirectScreen() {
  const { newProject } = useLocalSearchParams<{
    newProject?: string | string[];
  }>();

  useEffect(() => {
    const request = Array.isArray(newProject) ? newProject[0] : newProject;
    if (request) {
      router.replace({ pathname: '/(tabs)', params: { newProject: request } });
      return;
    }
    router.replace('/(tabs)');
  }, [newProject]);

  return <Screen padded={false} safeAreaEdges={['top', 'left', 'right']} />;
}
