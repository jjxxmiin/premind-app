import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, ListRow, SegmentedControl, StatusBadge } from '@/components/ui';
import { COMMON_PACKS, COMPANY_PACKS, INTERVIEW_DISCLAIMER } from '@/features/interview/company-packs';
import { useT } from '@/lib/i18n';
import { spacing } from '@/theme/tokens';

export function PackPicker({ selected, onPick }: { readonly selected: string | null; readonly onPick: (id: string) => void }) {
  const t = useT();
  const [group, setGroup] = useState<'common' | 'company'>(COMPANY_PACKS.some((pack) => pack.id === selected) ? 'company' : 'common');
  const packs = group === 'common' ? COMMON_PACKS : COMPANY_PACKS;
  return (
    <View style={styles.section}>
      <AppText variant="heading">{t('어떤 면접을 준비하나요?')}</AppText>
      <AppText tone="muted" variant="meta">{t('질문을 고르면 답변 시간과 피드백 방식을 정할 수 있어요.')}</AppText>
      <SegmentedControl onChange={setGroup} options={[{ value: 'common', label: t('공통 질문') }, { value: 'company', label: t('회사별 질문') }]} value={group} />
      <Card padding={false}>
        {packs.map((pack, index) => (
          <ListRow accessibilityLabel={`${t(pack.name)}, ${t('질문 {n}개', { n: pack.questions.length })}`}
            divider={index < packs.length - 1} key={pack.id} onPress={() => onPick(pack.id)} selected={selected === pack.id} showChevron={false}
            subtitle={t('{label} / 질문 {n}개', { label: t(pack.audience ?? pack.stage), n: pack.questions.length })}
            title={t(pack.name)} trailing={selected === pack.id ? <StatusBadge label={t('선택됨')} tone="brand" /> : undefined} />
        ))}
      </Card>
      <AppText tone="faint" variant="badge">{t(INTERVIEW_DISCLAIMER).replace(/\n/g, ' ')}</AppText>
    </View>
  );
}
const styles = StyleSheet.create({ section: { gap: spacing.md } });
