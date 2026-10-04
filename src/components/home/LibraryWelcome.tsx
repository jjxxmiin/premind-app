import { BookOpen, CircleHelp, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, ListRow } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, spacing } from '@/theme/tokens';

export function LibraryWelcome({ onAdd }: { readonly onAdd: () => void }) {
  const t = useT();

  return (
    <View style={styles.content}>
      <View style={styles.copy}>
        <AppText accessibilityRole="header" variant="pageTitle">
          {t('내 자료로 시작해요')}
        </AppText>
        <AppText tone="muted" variant="body">
          {t('녹음, PDF, 영상으로 요약과 문제를 만들어요.')}
        </AppText>
      </View>
      <Button
        fullWidth
        leftIcon={<Plus color={colors.textInverse} size={iconSizes.inline} />}
        onPress={onAdd}
        size="large"
      >
        {t('자료 추가')}
      </Button>
      <Card padding={false}>
        <ListRow
          leadingIcon={BookOpen}
          subtitle={t('요약과 마인드맵으로 긴 내용을 정리해요.')}
          title={t('핵심부터 읽기')}
        />
        <ListRow
          divider={false}
          leadingIcon={CircleHelp}
          subtitle={t('문제를 풀고 모르는 부분은 자료에 물어봐요.')}
          title={t('이해했는지 확인')}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.xl,
  },
  copy: {
    gap: spacing.sm,
  },
});
