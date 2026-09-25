import { router, useLocalSearchParams } from 'expo-router';
import { MessagesSquare, Presentation } from 'lucide-react-native';

import { InterviewHome } from '@/components/speak/InterviewHome';
import { PresentationHome } from '@/components/speak/PresentationHome';
import { SegmentedControl, type SegmentOption } from '@/components/ui';
import { useT } from '@/lib/i18n';

export type SpeakMode = 'presentation' | 'interview';

const OPTIONS: readonly SegmentOption<SpeakMode>[] = [
  { value: 'presentation', label: '발표', icon: Presentation, accessibilityLabel: '발표 평가' },
  { value: 'interview', label: '면접', icon: MessagesSquare, accessibilityLabel: '면접 연습' },
];

/**
 * 말하기 탭 (2026-09-26): 내가 말한 것을 돌려받는 두 가지, 발표 평가와 면접 연습을 한 곳에.
 * 배우기 쪽(홈, 이해도)과 나눠 탭이 여섯에서 다섯이 됐다. 어느 쪽인지는 주소(`?mode=`)가 들고 있어
 * 옛 주소(/lens, /interview)와 뒤로 가기가 그대로 맞는다.
 */
export default function SpeakScreen() {
  const t = useT();
  const options = OPTIONS.map((option) => ({
    ...option,
    label: t.ctx('speak', option.label),
    accessibilityLabel: option.accessibilityLabel ? t(option.accessibilityLabel) : undefined,
  }));
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: SpeakMode = params.mode === 'interview' ? 'interview' : 'presentation';
  const switcher = (
    <SegmentedControl<SpeakMode>
      onChange={(next) => router.setParams({ mode: next })}
      options={options}
      testID="speak-mode"
      value={mode}
    />
  );
  return mode === 'interview' ? <InterviewHome switcher={switcher} /> : <PresentationHome switcher={switcher} />;
}
