import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Clock3,
  FlaskConical,
  Link2,
  ShieldCheck,
  WifiOff,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { MediaArtwork } from '@/components/MediaArtwork';
import {
  AnimatedReveal,
  AppText,
  Button,
  Card,
  ErrorState,
  PipelineSteps,
  ProgressBar,
  Screen,
  SkeletonLines,
  StatusBadge,
} from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { formatBytes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { goBackOrReplace } from '@/lib/navigation';
import { youtubeThumbnailUrl } from '@/lib/youtube';
import { useAppStore } from '@/state/app-store';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';
import type { StudyMaterial } from '@/types';

/**
 * Steps are keyed to the material's status, not to a percentage.
 *
 * The two pipelines report progress differently — the server one spends its
 * first half uploading and cannot see inside the AI pass, the offline demo runs
 * to a script — so a shared percentage threshold would tick "대본 완료" while a
 * recording was still being uploaded. Status is the thing both actually agree on.
 */
function currentStepIndex(
  material: StudyMaterial,
  isDemo: boolean,
  isLink = false,
): number {
  if (material.status === 'ready') return 3;
  // A link pipeline has no upload half: transcribing is its own middle step.
  if (isLink && material.status === 'transcribing') return 1;
  if (
    material.status === 'generating' ||
    (!isDemo && material.status === 'transcribing')
  ) {
    return 2;
  }
  if (material.status === 'failed') return material.progress > 0.5 ? 2 : 1;
  return 1;
}

function isConnectionError(message: string | null): boolean {
  return Boolean(message && /wi-?fi|네트워크|연결|network/i.test(message));
}

export default function ProcessingScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { materials, processMaterial, processingMaterialIds, session } = useAppStore();
  const material = materials.find((item) => item.id === id);
  const isDemo = session?.user.role === 'development';
  const launched = useRef(false);
  const retryingRef = useRef(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (
      !material ||
      material.status === 'ready' ||
      material.status === 'failed' ||
      processingMaterialIds.includes(material.id) ||
      launched.current
    ) {
      return;
    }
    launched.current = true;
    setLocalError(null);
    void processMaterial(material.id).catch((error: unknown) => {
      setLocalError(
        error instanceof Error ? error.message : '마인드팩을 만들지 못했어요. 다시 시도해 주세요.',
      );
    });
  }, [material, processMaterial, processingMaterialIds]);

  if (!material) {
    return (
      <Screen maxWidth={560} padded={false}>
        <AppHeader onBack={() => goBackOrReplace('/(tabs)/library')} title={t('만드는 중')} />
        <ErrorState
          description={t('이 기기에서 자료를 찾을 수 없어요. 홈에서 다시 열어 주세요.')}
          onRetry={() => router.dismissTo('/(tabs)/library')}
          retryLabel={t('홈으로')}
          title={t('자료가 없어요')}
        />
      </Screen>
    );
  }

  const retry = () => {
    if (retryingRef.current || processingMaterialIds.includes(material.id)) {
      return;
    }
    retryingRef.current = true;
    launched.current = true;
    setLocalError(null);
    setIsRetrying(true);
    void processMaterial(material.id)
      .catch((error: unknown) => {
        setLocalError(
          error instanceof Error ? error.message : '마인드팩을 만들지 못했어요. 다시 시도해 주세요.',
        );
      })
      .finally(() => {
        retryingRef.current = false;
        setIsRetrying(false);
      });
  };

  const failureMessage =
    localError ??
    (material.status === 'failed'
      ? material.lastError ?? '만들다가 멈췄어요. 다시 시도해 주세요.'
      : null);
  const connectionBlocked = isConnectionError(failureMessage);
  // The server's 402: retrying cannot help until the plan or the month changes.
  const planLimited = failureMessage?.includes('처리 분량') ?? false;
  const isReady = material.status === 'ready';
  const isBlocked = failureMessage !== null;
  const isActive = !isReady && !isBlocked;
  const isLink = material.source.origin === 'link';
  const youtubeId = isLink ? material.source.youtubeId : undefined;
  const stageIndex = currentStepIndex(material, isDemo, isLink);
  /**
   * Stage names, not sentences. The rail has three columns and a phone is
   * 320dp wide, so "요약 → 마인드맵 → 문제" under a node wrapped to four
   * lines. What the machine is doing right now is spelled out once, in the
   * progress label under the rail, where there is a full line for it.
   */
  const pipelineSteps = isLink
    ? [t('영상 읽기'), t('대본'), t('마인드팩')]
    : [t('원본 저장'), t('대본'), t('마인드팩')];
  const readyResultLabels = [
    material.transcript.length ? '대본' : null,
    material.note ? '요약' : null,
    material.quiz.length ? '문제' : null,
  ].filter((label): label is string => Boolean(label));
  const progressValue = isReady ? 100 : Math.max(0, material.progress ?? 0) * 100;

  const presentation = isReady
    ? {
        badge: t('준비 완료'),
        badgeTone: 'positive' as const,
        description: readyResultLabels.length
          ? t('{items}까지 준비됐어요. 지금 열어 보세요.', {
              items: readyResultLabels.map((label) => t(label)).join(' / '),
            })
          : t('마인드팩이 준비됐어요. 지금 열어 보세요.'),
        heading: t('마인드팩이 준비됐어요'),
      }
    : isBlocked
      ? {
          badge: t(planLimited ? '분량 초과' : connectionBlocked ? '연결 대기' : '확인 필요'),
          badgeTone: connectionBlocked ? ('warning' as const) : ('negative' as const),
          description: t(
            planLimited
              ? '이번 달 처리 분량을 다 썼어요. 원본은 그대로 있으니 스탠다드로 늘리거나 다음 달에 이어가요.'
              : isLink
              ? connectionBlocked
                ? '연결이 끊겨 멈췄어요. Wi-Fi를 확인하고 다시 시도해 주세요.'
                : '만들다가 멈췄어요. 링크는 그대로 남아 있어요.'
              : connectionBlocked
                ? '연결이 끊겨 멈췄어요. 원본은 기기에 있으니 Wi-Fi를 확인하고 이어가 주세요.'
                : '만들다가 멈췄어요. 원본은 기기에 그대로 있어요.',
          ),
          heading: t(
            planLimited
              ? '이번 달 분량을 다 썼어요'
              : connectionBlocked
                ? '연결을 확인해 주세요'
                : '잠시 멈췄어요',
          ),
        }
      : {
          badge: t.ctx(
            'processing',
            material.status === 'generating'
              ? '생성 중'
              : material.status === 'transcribing'
                ? '대본 생성'
                : isLink
                  ? '영상 읽기'
                  : material.progressLabel.includes('올리고')
                    ? '올리는 중'
                    : '준비 중',
          ),
          badgeTone: 'brand' as const,
          description: t(
            isDemo
              ? '데모라서 예시 대본과 문제로 만들어요.'
              : isLink
                ? '대본 → 요약 → 마인드맵 → 문제 순서로 만들어요. 영상 길이에 따라 시간이 달라요.'
                : '대본 → 요약 → 마인드맵 → 문제 순서로 만들어요. 원본 길이에 따라 시간이 달라요.',
          ),
          heading: t('마인드팩을 만들고 있어요'),
        };

  return (
    <Screen maxWidth={560} padded={false} >
      <AppHeader
        onBack={() => router.dismissTo('/(tabs)/library')}
        title={isReady ? t('준비 완료') : t('만드는 중')}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <AnimatedReveal>
          <View style={styles.heading}>
            <StatusBadge
              label={presentation.badge}
              showDot
              tone={presentation.badgeTone}
            />
            <AppText accessibilityLiveRegion="polite" variant="pageTitle">
              {presentation.heading}
            </AppText>
            <AppText tone="muted" variant="body">
              {presentation.description}
            </AppText>
          </View>
        </AnimatedReveal>

        {isDemo ? (
          <AnimatedReveal delay={45}>
            <Card style={styles.noticeCard} variant="soft">
              <FlaskConical
                {...decorative}
                color={colors.textMuted}
                size={iconSizes.section}
                strokeWidth={1.9}
              />
              <View style={styles.flex}>
                <AppText variant="itemTitle">{t('데모로 둘러보는 중이에요')}</AppText>
                <AppText tone="muted" variant="meta">
                  {isLink
                    ? t('대본, 요약, 마인드맵, 문제는 예시예요.')
                    : t('파일은 기기에 남지만 대본, 요약, 마인드맵, 문제는 예시예요.')}
                </AppText>
              </View>
            </Card>
          </AnimatedReveal>
        ) : null}

        <AnimatedReveal delay={90}>
          <Card padding={false}>
            <View style={styles.fileRow}>
              {youtubeId ? (
                <Image
                  accessibilityLabel={t('유튜브 영상 썸네일')}
                  contentFit="cover"
                  source={{ uri: youtubeThumbnailUrl(youtubeId) }}
                  style={styles.thumbnail}
                />
              ) : (
                <MediaArtwork compact kind={material.source.kind} status={material.status} />
              )}
              <View style={styles.flex}>
                <AppText numberOfLines={1} variant="itemTitle">
                  {material.title}
                </AppText>
                <AppText numberOfLines={1} tone="muted" variant="meta">
                  {isLink
                    ? t('유튜브 링크')
                    : `${material.source.fileName}, ${formatBytes(material.source.sizeBytes)}`}
                </AppText>
              </View>
              <StatusBadge
                label={isLink ? t('유튜브') : t('원본 저장')}
                tone={isLink ? 'neutral' : 'positive'}
              />
            </View>
          </Card>
        </AnimatedReveal>

        {isLink && !isBlocked ? (
          <AnimatedReveal delay={110}>
            <Card style={styles.noticeCard} variant="soft">
              <Link2
                {...decorative}
                color={colors.textMuted}
                size={iconSizes.section}
                strokeWidth={1.9}
              />
              <AppText style={styles.flex} tone="muted" variant="meta">
                {t('영상은 내려받지 않고 유튜브에서 바로 재생해요.')}
              </AppText>
            </Card>
          </AnimatedReveal>
        ) : null}

        {isBlocked ? (
          <ErrorState
            compact
            description={t(failureMessage ?? '')}
            onRetry={planLimited ? () => router.push('/subscription') : retry}
            retryLabel={t(planLimited ? '구독 보기' : connectionBlocked ? '다시 시도' : '다시 만들기')}
            retryDisabled={!planLimited && isRetrying}
            retryLoading={!planLimited && isRetrying}
            retryVariant="primary"
            title={t(
              planLimited
                ? '이번 달 분량을 다 썼어요'
                : connectionBlocked
                  ? '연결을 확인해 주세요'
                  : '이어갈 수 있어요',
            )}
          />
        ) : (
          <AnimatedReveal delay={135}>
            <Card style={styles.stepsCard} variant="soft">
              <PipelineSteps
                active={isActive}
                label={t('마인드팩 만드는 단계')}
                progress={material.progress ?? 0}
                stageIndex={stageIndex}
                steps={pipelineSteps}
              />

              <ProgressBar
                label={t(material.progressLabel)}
                showValue
                tone="ink"
                value={progressValue}
              />

              <View style={styles.caption}>
                <Clock3
                  {...decorative}
                  color={colors.textMuted}
                  size={iconSizes.dense}
                  strokeWidth={2}
                />
                <AppText style={styles.flex} tone="muted" variant="meta">
                  {isReady
                    ? t('모든 단계가 끝났어요. 바로 열 수 있어요.')
                    : t('이 화면을 나가도 앱이 열려 있으면 계속 만들어요.')}
                </AppText>
              </View>
            </Card>
          </AnimatedReveal>
        )}

        {isActive ? (
          <AnimatedReveal delay={180}>
            <Card style={styles.previewCard}>
              <View style={styles.previewHead}>
                <AppText variant="itemTitle">{t('요약')}</AppText>
                <StatusBadge label={t.ctx('processing', '준비 중')} tone="neutral" />
              </View>
              <SkeletonLines lines={5} />
            </Card>
          </AnimatedReveal>
        ) : null}

        {isBlocked ? (
          <Card style={styles.noticeCard} variant="soft">
            {isLink ? (
              <Link2
                {...decorative}
                color={colors.textMuted}
                size={iconSizes.section}
                strokeWidth={1.9}
              />
            ) : connectionBlocked ? (
              <WifiOff
                {...decorative}
                color={colors.warningStrong}
                size={iconSizes.section}
                strokeWidth={1.9}
              />
            ) : (
              <ShieldCheck
                {...decorative}
                color={colors.positiveStrong}
                size={iconSizes.section}
                strokeWidth={1.9}
              />
            )}
            <AppText style={styles.flex} tone="muted" variant="meta">
              {t(
                isLink
                  ? '다시 시도하면 같은 링크로 이어서 만들어요.'
                  : connectionBlocked
                    ? material.serverRecordingId
                      ? '원본은 이미 올라갔어요. 연결되면 이어서 확인해요.'
                      : '끊긴 지점부터 이어서 올려요. 자료가 중복되지 않아요.'
                    : '다시 시도해도 기기의 원본은 지워지지 않아요.',
              )}
            </AppText>
          </Card>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        {isReady ? (
          <Button fullWidth onPress={() => router.replace({ pathname: '/material/[id]', params: { id: material.id } })} size="large" variant="primary">
            {t('마인드팩 열기')}
          </Button>
        ) : (
          <Button fullWidth onPress={() => router.dismissTo('/(tabs)')} size="large" variant="secondary">
            {t('홈으로')}
          </Button>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  heading: { gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  noticeCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  fileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.md,
  },
  thumbnail: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.input,
    height: 56,
    width: 84,
  },
  stepsCard: { gap: spacing.gutter },
  caption: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  previewCard: { gap: spacing.md },
  previewHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomBar: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.gutter,
  },
});
