import { router } from 'expo-router';
import { SearchX } from 'lucide-react-native';

import { EmptyState, Screen } from '@/components/ui';
import { useT } from '@/lib/i18n';

export default function NotFoundScreen() {
  const t = useT();
  return (
    <Screen centered maxWidth={560}>
      <EmptyState
        actionLabel={t('홈으로')}
        description={t('주소가 바뀌었거나 없는 페이지예요')}
        icon={SearchX}
        onAction={() => router.replace('/')}
        title={t('페이지를 찾을 수 없어요')}
      />
    </Screen>
  );
}
