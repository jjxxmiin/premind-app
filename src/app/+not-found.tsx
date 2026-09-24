import { router } from 'expo-router';
import { SearchX } from 'lucide-react-native';

import { EmptyState, Screen } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <Screen centered maxWidth={560}>
      <EmptyState
        actionLabel="홈으로"
        description="주소가 바뀌었거나 없는 페이지예요"
        icon={SearchX}
        onAction={() => router.replace('/')}
        title="페이지를 찾을 수 없어요"
      />
    </Screen>
  );
}
