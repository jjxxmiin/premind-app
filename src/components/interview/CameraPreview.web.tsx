import { createElement, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/lib/i18n';
import { colors, radii } from '@/theme/tokens';

/**
 * The learner's own camera, mirrored, while the answer is recorded. The
 * recording stays in this browser; this is only a mirror.
 */
export function CameraPreview({ stream }: { stream: MediaStream | null }) {
  const t = useT();
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => undefined);
  }, [stream]);
  if (!stream) return null;
  return (
    <View accessibilityLabel={t('내 카메라 화면')} style={styles.frame}>
      {createElement('video', {
        ref,
        autoPlay: true,
        muted: true,
        playsInline: true,
        style: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 4 / 3,
    backgroundColor: colors.stageRaised,
    borderRadius: radii.card,
    overflow: 'hidden',
    width: '100%',
  },
});
