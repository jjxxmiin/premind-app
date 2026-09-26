import NetInfo from '@react-native-community/netinfo';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AudioLines,
  Check,
  FileText,
  FileVideo2,
  FolderOpen,
  ShieldCheck,
  Upload,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { DeskCard } from '@/components/recording/DeskCard';
import { readWebMediaDurationMs } from '@/features/files/web-media-store';
import {
  AppText,
  AnimatedReveal,
  BottomSheetModal,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  ListRow,
  Screen,
  StatusBadge,
} from '@/components/ui';
import {
  connectionKindOf,
  meteredUploadWarning,
  type MeteredUploadWarning,
} from '@/features/import/metered-upload';
import {
  pickStudySource,
  type PickedStudySource,
  StudySourcePickerError,
} from '@/features/import/pick-study-source';
import { preservePickedStudySource } from '@/features/import/preserve-study-source';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { goBackOrReplace } from '@/lib/navigation';
import { useAppStore } from '@/state/app-store';
import { colors, iconSizes, radii, sizes, spacing } from '@/theme/tokens';
import type { Project } from '@/types';

/** The three kinds of file this screen takes, in the order the picker lists them. */
const FORMATS = [
  { icon: FileVideo2, name: '영상', extensions: 'MP4, MOV, WEBM, MKV, AVI 등' },
  { icon: AudioLines, name: '음성', extensions: 'M4A, MP3, WAV, AAC, OGG 등' },
  { icon: FileText, name: '문서', extensions: 'PDF, PPTX' },
] as const;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A file already copied into the app's own storage, waiting to be imported. */
interface PreservedSource {
  projectId: string;
  source: PickedStudySource;
  /** `null` for a PDF or a slide deck, which has nothing to play. */
  playableKind: 'audio' | 'video' | null;
}

export default function CaptureScreen() {
  const t = useT();
  const { isTablet } = useLayout();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    projectId?: string | string[];
  }>();
  const { activeProjectId, importMaterial, projects, selectProject } =
    useAppStore();
  const requestedProjectId = firstParam(params.projectId);
  const initialProjectId =
    (requestedProjectId &&
    projects.some((project) => project.id === requestedProjectId)
      ? requestedProjectId
      : undefined) ??
    (activeProjectId &&
    projects.some((project) => project.id === activeProjectId)
      ? activeProjectId
      : undefined) ??
    projects[0]?.id ??
    null;
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialProjectId,
  );
  const [isPicking, setIsPicking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [subjectSheetVisible, setSubjectSheetVisible] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{
    picked: PreservedSource;
    warning: MeteredUploadWarning;
  } | null>(null);
  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );

  const chooseProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    selectProject(projectId);
    setErrorMessage(null);
  };

  /**
   * Everything after the learner has agreed to send the bytes. Split out of
   * `pickFile` so the metered-data warning can sit between choosing a file
   * and importing it, with the file already preserved on the device either
   * way: cancelling the warning must not lose the pick.
   */
  const startImport = async (picked: PreservedSource) => {
    setPendingUpload(null);
    setIsPicking(true);
    setErrorMessage(null);
    try {
      const durationMs =
        Platform.OS === 'web' && picked.playableKind
          ? await readWebMediaDurationMs(picked.source.uri, picked.playableKind)
          : undefined;

      const material = await importMaterial({
        projectId: picked.projectId,
        uri: picked.source.uri,
        fileName: picked.source.name,
        mimeType: picked.source.mimeType,
        kind: picked.playableKind ?? 'document',
        sizeBytes: picked.source.sizeBytes,
        durationMs,
      });

      router.replace({
        pathname: '/processing/[id]',
        params: { id: material.id },
      });
    } catch (error) {
      setErrorMessage(importErrorMessage(error));
    } finally {
      setIsPicking(false);
    }
  };

  const pickFile = async () => {
    if (!selectedProjectId) {
      setErrorMessage('폴더를 먼저 골라 주세요.');
      return;
    }

    setIsPicking(true);
    setErrorMessage(null);
    setNotice(null);
    try {
      const result = await pickStudySource({
        allowedKinds: ['audio', 'video', 'pdf', 'pptx'],
      });
      if (result.canceled) {
        setNotice('파일 선택을 취소했어요.');
        setIsPicking(false);
        return;
      }

      const { source } = result;
      // A PDF or a slide deck is read page by page on the server rather than
      // transcribed, so it becomes a `document` material with no playback.
      const playableKind =
        source.kind === 'audio' || source.kind === 'video' ? source.kind : null;
      const preservedSource = await preservePickedStudySource(source);
      const picked: PreservedSource = {
        projectId: selectedProjectId,
        source: preservedSource,
        playableKind,
      };

      // Asked here, with the file chosen and its size known, rather than by a
      // switch set months ago in MY. NetInfo is only reachable on a device;
      // the web preview has no mobile data to spend.
      const warning =
        Platform.OS === 'web'
          ? null
          : meteredUploadWarning(
              connectionKindOf(await NetInfo.fetch()),
              preservedSource.sizeBytes,
            );
      if (warning) {
        setPendingUpload({ picked, warning });
        setIsPicking(false);
        return;
      }

      await startImport(picked);
    } catch (error) {
      setErrorMessage(importErrorMessage(error));
      setIsPicking(false);
    }
  };

  const openLibrary = () => {
    setSubjectSheetVisible(false);
    router.dismissTo({
      pathname: '/(tabs)/library',
      params: { newProject: Date.now().toString(36) },
    });
  };

  return (
    <Screen
      maxWidth={isTablet ? 720 : 640}
      padded={false}
      safeAreaEdges={['top', 'left', 'right', 'bottom']}
    >
      <AppHeader
        onBack={() => goBackOrReplace('/(tabs)/create')}
        title={t('파일 올리기')}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isTablet ? styles.contentWide : null,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
      >
        <DeskCard>
          <AnimatedReveal delay={30}>
            <View style={styles.intro}>
              <AppText variant="pageTitle">{t('영상, 음성, 문서를 골라요')}</AppText>
              <AppText tone="muted" variant="meta">
                {t('원본은 기기에 먼저 저장돼요')}
              </AppText>
            </View>
          </AnimatedReveal>

          <AnimatedReveal delay={90}>
            <Card padding={false}>
              <ListRow
                accessibilityHint={t('폴더를 골라요')}
                accessibilityLabel={t('폴더, {folder}', {
                  folder: selectedProject?.title ?? t('폴더 없음'),
                })}
                compact
                disabled={isPicking}
                divider={false}
                onPress={() => setSubjectSheetVisible(true)}
                testID="capture-subject-row"
                title={t.ctx('record', '폴더')}
                trailing={
                  <View style={styles.optionValue}>
                    <AppText numberOfLines={1} tone="muted" variant="body">
                      {selectedProject?.title ?? t('폴더 없음')}
                    </AppText>
                  </View>
                }
              />
            </Card>
          </AnimatedReveal>

          {isTablet ? (
            <AnimatedReveal delay={120}>
              <Pressable
                accessibilityHint={t('파일을 골라 올려요')}
                accessibilityLabel={t('파일 선택')}
                accessibilityRole="button"
                accessibilityState={{ busy: isPicking, disabled: isPicking }}
                disabled={isPicking}
                onPress={() => void pickFile()}
                style={({
                  hovered,
                  pressed,
                }: {
                  hovered?: boolean;
                  pressed: boolean;
                }) => [
                  styles.dropZone,
                  hovered ? styles.dropZoneHovered : null,
                  pressed ? styles.dropZonePressed : null,
                  isPicking ? styles.dropZoneBusy : null,
                ]}
                testID="capture-drop-zone"
              >
                <View {...decorative} style={styles.dropIcon}>
                  <Upload color={colors.brand} size={iconSizes.state} strokeWidth={1.9} />
                </View>
                <View style={styles.dropCopy}>
                  <AppText align="center" variant="itemTitle">
                    {t('여기를 눌러 파일을 골라요')}
                  </AppText>
                  <AppText align="center" tone="muted" variant="meta">
                    {t('영상, 음성, 문서 파일 한 개, 최대 4GB')}
                  </AppText>
                </View>
                {/* Drawn like the primary button, but the whole zone is the
                    button: a real one inside would be a button in a button to
                    a screen reader. */}
                <View {...decorative} style={styles.dropAction}>
                  {isPicking ? (
                    <ActivityIndicator color={colors.textInverse} size="small" />
                  ) : (
                    <AppText tone="inverse" variant="bodyStrong">
                      {t('파일 선택')}
                    </AppText>
                  )}
                </View>
              </Pressable>
            </AnimatedReveal>
          ) : null}

          {errorMessage ? (
            <ErrorState
              compact
              description={t(errorMessage)}
              onRetry={() => void pickFile()}
              retryLabel={t('다시 선택')}
              title={t('파일을 올리지 못했어요')}
            />
          ) : null}

          {notice ? (
            <View accessibilityLiveRegion="polite" style={styles.notice}>
              <AppText tone="muted" variant="meta">
                {t(notice)}
              </AppText>
            </View>
          ) : null}

          <AnimatedReveal delay={150}>
            <View style={styles.formatSection}>
              <View style={styles.formatHeading}>
                <AppText variant="itemTitle">{t('지원하는 파일')}</AppText>
                {isTablet ? null : <StatusBadge label={t('최대 4GB')} />}
              </View>
              <View style={isTablet ? styles.formatGrid : styles.formatList}>
                {FORMATS.map((format, index) => (
                  <View
                    key={format.name}
                    style={
                      isTablet
                        ? styles.formatTile
                        : [
                            styles.formatRow,
                            index < FORMATS.length - 1 ? styles.formatRowDivider : null,
                          ]
                    }
                  >
                    <View style={styles.formatIcon}>
                      <format.icon
                        {...decorative}
                        color={colors.text}
                        size={iconSizes.section}
                        strokeWidth={1.9}
                      />
                    </View>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">{t(format.name)}</AppText>
                      <AppText tone="muted" variant="meta">
                        {t(format.extensions)}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.formatNotes}>
                <AppText tone="muted" variant="meta">
                  {t(
                    '문서는 쪽 단위로 읽어요. 소리가 없으니 재생 대신 쪽 번호가 붙어요. 스캔한 이미지 PDF는 글자가 없어서 읽지 못해요.',
                  )}
                </AppText>
                <AppText tone="muted" variant="meta">
                  {t('일부 파일은 기기에 따라 재생이 안 될 수 있어요.')}
                </AppText>
              </View>
            </View>
          </AnimatedReveal>

          <View style={styles.localNote}>
            <ShieldCheck {...decorative} color={colors.textFaint} size={iconSizes.inline} strokeWidth={1.9} />
            <AppText style={styles.flex} tone="muted" variant="meta">
              {t('원본은 기기에 먼저 저장돼요. 중간에 멈춰도 원본은 남아 있어요.')}
            </AppText>
          </View>
        </DeskCard>
      </ScrollView>

      {isTablet ? null : (
        <View style={styles.bottomBar}>
          <Button
            fullWidth
            loading={isPicking}
            onPress={() => void pickFile()}
            size="large"
            variant="primary"
          >
            {t('파일 선택')}
          </Button>
        </View>
      )}

      <BottomSheetModal
        onClose={() => setSubjectSheetVisible(false)}
        scrollable={false}
        testID="capture-subject-sheet"
        title={t('폴더 선택')}
        visible={subjectSheetVisible}
      >
        {projects.length > 0 ? (
          <Card padding={false}>
            {projects.map((project, index) => (
              <ProjectRow
                disabled={isPicking}
                key={project.id}
                last={index === projects.length - 1}
                onPress={() => {
                  chooseProject(project.id);
                  setSubjectSheetVisible(false);
                }}
                project={project}
                selected={project.id === selectedProjectId}
              />
            ))}
          </Card>
        ) : (
          <EmptyState
            actionLabel={t('폴더 만들기')}
            description={t('자료를 담을 폴더가 필요해요')}
            icon={FolderOpen}
            onAction={openLibrary}
            title={t('폴더가 없어요')}
          />
        )}
      </BottomSheetModal>

      <Dialog
        cancel={{
          label: t('취소'),
          onPress: () => setPendingUpload(null),
        }}
        confirm={{
          label: t('그대로 올리기'),
          onPress: () => {
            const picked = pendingUpload?.picked;
            if (picked) void startImport(picked);
          },
        }}
        description={t(pendingUpload?.warning.description ?? '')}
        onRequestClose={() => setPendingUpload(null)}
        testID="capture-metered-warning"
        title={t(pendingUpload?.warning.title ?? '')}
        visible={pendingUpload !== null}
      />
    </Screen>
  );
}

function ProjectRow({
  disabled,
  last,
  onPress,
  project,
  selected,
}: {
  disabled: boolean;
  last: boolean;
  onPress: () => void;
  project: Project;
  selected: boolean;
}) {
  const t = useT();
  return (
    <Pressable
      aria-pressed={selected}
      accessibilityLabel={t('{title} 폴더', { title: project.title })}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.projectRow,
        !last ? styles.projectRowDivider : null,
        disabled ? styles.projectRowDisabled : null,
        pressed ? styles.projectRowPressed : null,
      ]}
    >
      <View
        {...decorative}
        style={[styles.projectDot, { backgroundColor: project.accentColor }]}
      />
      <View style={styles.flex}>
        <AppText numberOfLines={1} variant="itemTitle">
          {project.title}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="meta">
          {project.courseName}
        </AppText>
      </View>
      {selected ? (
        <View {...decorative} style={styles.selectedCheck}>
          <Check color={colors.textInverse} size={iconSizes.dense} strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}

function importErrorMessage(error: unknown): string {
  if (error instanceof StudySourcePickerError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return '파일 정보를 확인하지 못했어요. 다른 파일로 다시 시도해 주세요.';
}

const styles = StyleSheet.create({
  scroller: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  contentWide: {
    paddingTop: spacing.xl,
  },
  intro: {
    gap: spacing.xs,
  },
  optionValue: {
    maxWidth: 190,
  },
  projectRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  projectRowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  projectRowDisabled: {
    opacity: 0.45,
  },
  projectRowPressed: {
    backgroundColor: colors.backgroundSoft,
  },
  projectDot: {
    borderRadius: radii.full,
    height: spacing.sm,
    width: spacing.sm,
  },
  selectedCheck: {
    alignItems: 'center',
    backgroundColor: colors.action,
    borderRadius: radii.full,
    height: sizes.badge,
    justifyContent: 'center',
    width: sizes.badge,
  },
  flex: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  formatSection: {
    gap: spacing.md,
  },
  formatList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  formatGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  formatTile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.tile,
    borderWidth: 1,
    flex: 1,
    gap: spacing.md,
    minWidth: 0,
    padding: spacing.lg,
  },
  formatRowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  formatNotes: {
    gap: spacing.xs,
  },
  dropZone: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.borderStrong,
    borderRadius: radii.card,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  dropZoneHovered: {
    backgroundColor: colors.brandSubtle,
    borderColor: colors.brand,
  },
  dropZonePressed: {
    transform: [{ scale: 0.99 }],
  },
  dropZoneBusy: {
    opacity: 0.7,
  },
  dropIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.brandSoft,
    borderRadius: radii.full,
    borderWidth: 1,
    height: spacing.massive,
    justifyContent: 'center',
    width: spacing.massive,
  },
  dropAction: {
    alignItems: 'center',
    backgroundColor: colors.action,
    borderRadius: radii.button,
    height: sizes.button,
    justifyContent: 'center',
    minWidth: 136,
    paddingHorizontal: spacing.xl,
  },
  dropCopy: {
    gap: spacing.xs,
  },
  formatHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  formatRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  formatIcon: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.input,
    height: sizes.iconButton,
    justifyContent: 'center',
    width: sizes.iconButton,
  },
  notice: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.alert,
    padding: spacing.md,
  },
  localNote: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bottomBar: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.gutter,
  },
});
