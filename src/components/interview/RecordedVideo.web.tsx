import { createElement, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { interviewMedia } from '@/features/interview/interview-media';
import { useT } from '@/lib/i18n';
import { colors, radii, spacing } from '@/theme/tokens';

/** Plays back an answer's camera recording from this browser's storage. */
export function RecordedVideo({ mediaKey }: { mediaKey: string }) {
  const t = useT();
  const [uri, setUri] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    void interviewMedia.videoUri(mediaKey).then((value) => {
      url = value;
      if (alive) setUri(value);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaKey]);
  if (uri === undefined) return null;
  if (!uri) {
    return (
      <AppText tone="muted" variant="meta">
        {t('이 답변의 녹화본은 이 브라우저에 없어요.')}
      </AppText>
    );
  }
  return (
    <View style={styles.frame}>
      {createElement('video', { src: uri, controls: true, playsInline: true, style: { width: '100%', height: '100%', background: '#000' } })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 16 / 9, backgroundColor: colors.stage, borderRadius: radii.card, marginTop: spacing.sm, overflow: 'hidden', width: '100%' },
});
