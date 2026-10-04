import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';

import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { Screen } from './Screen';

/** Used only while hydration or a route's Suspense boundary is pending. */
export function RouteLoading() {
  const t = useT();
  return (
    <Screen centered>
      <View
        accessible
        accessibilityLabel={t('불러오는 중')}
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        style={styles.content}
      >
        <ActivityIndicator {...decorative} color={colors.text} />
        <AppText tone="muted" variant="meta">{t('불러오는 중')}</AppText>
      </View>
    </Screen>
  );
}

export function RouteError({ retry }: ErrorBoundaryProps) {
  const t = useT();
  return (
    <Screen centered>
      <View style={styles.content}>
        <AppText accessibilityRole="header" variant="heading">{t('문제가 생겼어요')}</AppText>
        <AppText align="center" tone="muted" variant="meta">{t('잠시 후 다시 시도해 주세요.')}</AppText>
        <Button onPress={() => void retry()} variant="primary">{t('다시 시도')}</Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center' },
});
