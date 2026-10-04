import { router, useLocalSearchParams } from 'expo-router';
import { MessagesSquare, Presentation } from 'lucide-react-native';
import { useEffect, useState } from 'react';

import { SpeakTabs, type SpeakTab } from '@/components/speak/SpeakTabs';
import { loadInterviewScreen, loadPresentationScreen, type PracticeScreenModule } from '@/components/speak/load-practice-screen';
import { RouteLoading } from '@/components/ui/RouteLoading';
import { useT } from '@/lib/i18n';

export { RouteError as ErrorBoundary } from '@/components/ui/RouteLoading';

export type SpeakMode = 'presentation' | 'interview';

const OPTIONS: readonly SpeakTab<SpeakMode>[] = [
  { value: 'presentation', label: '발표', icon: Presentation, accessibilityLabel: '발표 평가' },
  { value: 'interview', label: '면접', icon: MessagesSquare, accessibilityLabel: '면접 연습' },
];

/**
 * 말하기 탭 (2026-09-26): 내가 말한 것을 돌려받는 두 가지, 발표 평가와 면접 연습을 한 곳에.
 * 배우기 쪽(홈, 이해도)과 나눠 탭이 여섯에서 다섯이 됐다. 어느 쪽인지는 주소(`?mode=`)가 들고 있어
 * 옛 주소(/lens, /interview)와 뒤로 가기가 그대로 맞는다.
 */
export default function SpeakScreen() {
  const [screens, setScreens] = useState<Partial<Record<SpeakMode, PracticeScreenModule['default']>>>({});
  const [failure, setFailure] = useState<{ mode: SpeakMode; error: Error } | null>(null);
  const t = useT();
  const options = OPTIONS.map((option) => ({
    ...option,
    label: t.ctx('speak', option.label),
    accessibilityLabel: option.accessibilityLabel ? t(option.accessibilityLabel) : undefined,
  }));
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: SpeakMode = params.mode === 'interview' ? 'interview' : 'presentation';
  useEffect(() => {
    if (screens[mode]) return;
    let cancelled = false;
    const load = mode === 'interview' ? loadInterviewScreen : loadPresentationScreen;
    void load().then(({ default: ScreenComponent }) => {
      if (!cancelled) setScreens((current) => ({ ...current, [mode]: ScreenComponent }));
    }).catch((error: unknown) => {
      if (!cancelled) setFailure({ mode, error: error instanceof Error ? error : new Error(String(error)) });
    });
    return () => { cancelled = true; };
  }, [mode, screens]);

  if (failure?.mode === mode) throw failure.error;
  const PracticeScreen = screens[mode];
  const switcher = (
    <SpeakTabs<SpeakMode>
      onChange={(next) => router.setParams({ mode: next })}
      options={options}
      testID="speak-mode"
      value={mode}
    />
  );
  return PracticeScreen ? <PracticeScreen switcher={switcher} /> : <RouteLoading />;
}
