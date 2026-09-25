import { router, useLocalSearchParams } from 'expo-router';
import { Layers } from 'lucide-react-native';

import { AppHeader } from '@/components/AppHeader';
import { CardSession } from '@/components/cards';
import { EmptyState, Screen } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { goBackOrReplace } from '@/lib/navigation';
import { selectStudyNote, useAppStore } from '@/state/app-store';

/**
 * 암기 카드 as a screen of its own, reached from 이해도.
 *
 * The session itself lives in `CardSession`, which the 마인드팩's 카드 tab
 * renders too, so the deck a learner sees is the same in both places.
 */
export default function CardsScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { materials, state: appState } = useAppStore();
  const { gutter } = useLayout();
  const material = materials.find((item) => item.id === id);
  const highlights = selectStudyNote(appState, material?.id ?? '').highlights;

  const back = () =>
    material
      ? goBackOrReplace({ pathname: '/material/[id]', params: { id: material.id } })
      : goBackOrReplace('/(tabs)/mastery');

  if (!material) {
    return (
      <Screen maxWidth={640} padded={false}>
        <AppHeader onBack={back} title={t('암기 카드')} />
        <EmptyState
          actionLabel={t('돌아가기')}
          description={t('자료를 찾지 못했어요. 목록에서 다시 열어 주세요.')}
          icon={Layers}
          onAction={back}
          title={t('자료가 없어요')}
        />
      </Screen>
    );
  }

  return (
    <Screen maxWidth={640} padded={false}>
      <AppHeader onBack={back} title={t('암기 카드')} />
      <CardSession
        gutter={gutter}
        highlights={highlights}
        layout="screen"
        material={material}
        onDone={back}
        onSeek={(sourceStartMs) =>
          router.push({
            pathname: '/material/[id]',
            params: {
              id: material.id,
              tab: 'transcript',
              at: String(sourceStartMs),
            },
          })
        }
      />
    </Screen>
  );
}
