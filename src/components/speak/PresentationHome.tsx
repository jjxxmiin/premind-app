import { router } from "expo-router";
import { Bell, Check, FolderOpen, Mic, Play } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { Carousel } from "@/components/app";
import {
  LatestReportCard,
  LensEvaluatingTile,
  LensReportTile,
  ScoreTrend,
  lensFailure,
  lensHome,
  type LensFailure,
} from "@/components/lens";
import { MediaArtwork } from "@/components/MediaArtwork";
import { SpeakColumns, SpeakFrame } from "@/components/speak/SpeakColumns";
import { RoundAction } from "@/components/speak/RoundAction";
import {
  SpeakSectionTitle,
  SpeakTitle,
  Surface,
} from "@/components/speak/SpeakKit";
import {
  AnimatedReveal,
  AppText,
  BottomSheetModal,
  Button,
  Card,
  Dialog,
  EmptyState,
  IconButton,
  Screen,
} from "@/components/ui";
import { decorative } from "@/lib/a11y";
import { formatMaterialLength, formatRelativeDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useLayout } from "@/lib/layout";
import { useAppStore } from "@/state/app-store";
import { colors, iconSizes, radii, spacing } from "@/theme/tokens";
import type { StudyMaterial } from "@/types";

/**
 * 말하기 탭의 발표 쪽(2026-09-26 앱다운 재설계). 큰 제목 → 알약 고르기 → 머리 카드 안의 큰 둥근
 * 녹음 버튼(스픽: 목소리가 먼저) → 최근 평가 한 장 → 지난 평가는 옆으로 넘기기 → 팁 세 타일.
 * `switcher` 는 발표, 면접을 고르는 알약.
 */
export function PresentationHome({ switcher }: { switcher?: ReactNode }) {
  const t = useT();
  const { evaluatingMaterialIds, materials, projects, requestLens } =
    useAppStore();
  const { breakpoint, gutter } = useLayout();
  const wide = breakpoint === "expanded";
  const compact = breakpoint === "compact";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [failure, setFailure] = useState<LensFailure | null>(null);

  const projectTitle = (material: StudyMaterial) =>
    projects.find((project) => project.id === material.projectId)?.title ??
    t("폴더 없음");

  const isEvaluating = (id: string) => evaluatingMaterialIds.includes(id);
  const { candidates, history, latest, rows } = lensHome(
    materials,
    evaluatingMaterialIds,
  );

  const openPicker = () => {
    setSelectedId(null);
    setPickerOpen(true);
  };
  const openRecorder = () => router.push("/record");
  const openReport = (material: StudyMaterial) =>
    router.push({ pathname: "/report/[id]", params: { id: material.id } });

  const startEvaluation = () => {
    if (!selectedId) return;
    const materialId = selectedId;
    setPickerOpen(false);
    setSelectedId(null);
    void requestLens(materialId)
      .then((material) => openReport(material))
      .catch((error: unknown) => setFailure(lensFailure(error)));
  };

  // 머리 카드(흰 면): 제목 한 줄 + 큰 둥근 녹음 버튼. 가진 자료로 평가는 작은 회색 버튼(시트).
  const hero = (
    <Surface padding={spacing.xl} style={styles.hero} tone="raised">
      <View style={[styles.heroRow, compact ? styles.heroRowCompact : null]}>
        <View style={styles.heroLeft}>
          <AppText variant={compact ? "pageTitle" : "heroTitle"}>
            {t(latest ? "한 번 더 말해 볼까요?" : "발표를 들려주세요")}
          </AppText>
          <Button
            leftIcon={
              <FolderOpen color={colors.text} size={iconSizes.inline} />
            }
            onPress={openPicker}
            size="small"
            style={styles.pick}
            variant="secondary"
          >
            {t("자료로 평가")}
          </Button>
        </View>
        <RoundAction
          accessibilityHint={t("녹음 화면을 열어요")}
          icon={Mic}
          label={t("녹음하기")}
          size={compact ? 64 : 88}
          onPress={openRecorder}
          testID="speak-record"
        />
      </View>
    </Surface>
  );

  const latestCard = latest?.lensReport ? (
    <LatestReportCard
      onPress={() => openReport(latest)}
      projectTitle={projectTitle(latest)}
      report={latest.lensReport}
      title={latest.title}
      updatedAt={latest.updatedAt}
    />
  ) : null;

  const trend = history.length >= 2 ? <ScoreTrend entries={history} /> : null;

  // 지난 평가: 위 카드에 크게 보인 최근 평가는 빼고, 쓰는 중인 것부터.
  const past = rows.filter(
    (material) => isEvaluating(material.id) || material.id !== latest?.id,
  );
  const pastRow =
    past.length > 0 ? (
      <View style={styles.section}>
        <SpeakSectionTitle title={t("지난 평가")} />
        <Carousel
          accessibilityLabel={t("지난 평가")}
          itemWidth={compact ? 220 : 240}
        >
          {past.map((material) =>
            isEvaluating(material.id) ? (
              <LensEvaluatingTile
                key={material.id}
                material={material}
                projectTitle={projectTitle(material)}
              />
            ) : (
              <LensReportTile
                key={material.id}
                material={material}
                onPress={() => openReport(material)}
                projectTitle={projectTitle(material)}
              />
            ),
          )}
        </Carousel>
      </View>
    ) : null;

  const top = (
    <View style={styles.top}>
      <SpeakTitle title={t("말하기")} />
      {switcher}
    </View>
  );

  return (
    <Screen
      background="soft"
      fullBleed
      padded={false}
      safeAreaEdges={["top", "left", "right"]}
      scroll
      scrollViewProps={{ showsVerticalScrollIndicator: false }}
    >
      <SpeakFrame>
        <AppHeader
          brand
          right={
            <IconButton
              icon={Bell}
              label={t("알림")}
              onPress={() => router.push("/notifications")}
            />
          }
        />

        <View style={[styles.content, { paddingHorizontal: gutter }]}>
          <AnimatedReveal>{top}</AnimatedReveal>
          {wide ? (
            <SpeakColumns
              main={
                <>
                  <AnimatedReveal delay={60}>{hero}</AnimatedReveal>
                  {latestCard ? (
                    <AnimatedReveal delay={120}>{latestCard}</AnimatedReveal>
                  ) : null}
                  {pastRow ? (
                    <AnimatedReveal delay={180}>{pastRow}</AnimatedReveal>
                  ) : null}
                </>
              }
              side={
                trend ? (
                  <AnimatedReveal delay={120}>{trend}</AnimatedReveal>
                ) : null
              }
              sideWidth={340}
            />
          ) : (
            <>
              <AnimatedReveal delay={60}>{hero}</AnimatedReveal>
              {latestCard ? (
                <AnimatedReveal delay={120}>{latestCard}</AnimatedReveal>
              ) : null}
              {pastRow ? (
                <AnimatedReveal delay={180}>{pastRow}</AnimatedReveal>
              ) : null}
              {trend ? (
                <AnimatedReveal delay={220}>{trend}</AnimatedReveal>
              ) : null}
            </>
          )}
        </View>
      </SpeakFrame>

      <BottomSheetModal
        description={t("말이 담긴 자료를 골라 주세요.")}
        footer={
          <View style={styles.sheetFooter}>
            <Button
              disabled={!selectedId}
              fullWidth
              leftIcon={
                <Play color={colors.textInverse} size={iconSizes.inline} />
              }
              onPress={startEvaluation}
              size="large"
              variant="primary"
            >
              {t("평가 시작")}
            </Button>
          </View>
        }
        onClose={() => setPickerOpen(false)}
        title={t("새 평가 시작")}
        visible={pickerOpen}
      >
        {candidates.length > 0 ? (
          <Card padding={false}>
            {candidates.map((material, index) => (
              <CandidateRow
                key={material.id}
                last={index === candidates.length - 1}
                material={material}
                onPress={() => setSelectedId(material.id)}
                projectTitle={projectTitle(material)}
                selected={selectedId === material.id}
              />
            ))}
          </Card>
        ) : (
          <EmptyState
            actionLabel={t("녹음 시작")}
            compact
            description={t("PDF와 PPTX는 말소리가 없어 평가할 수 없어요.")}
            icon={Mic}
            onAction={() => {
              setPickerOpen(false);
              openRecorder();
            }}
            title={t("평가할 자료가 없어요")}
          />
        )}
      </BottomSheetModal>

      <Dialog
        confirm={{ label: t("확인"), onPress: () => setFailure(null) }}
        description={failure ? t(failure.message) : undefined}
        onRequestClose={() => setFailure(null)}
        title={t(failure?.title ?? "평가를 시작하지 못했어요")}
        visible={failure !== null}
      />
    </Screen>
  );
}

/**
 * What the row is made of. The picker takes any ready 자료, so the row says
 * so out loud — otherwise a list of recordings reads as a rule that only
 * recordings can be scored.
 */
function sourceLabel(material: StudyMaterial): string {
  if (material.source.origin === "link") return "유튜브 링크";
  if (material.source.kind === "video") return "영상";
  if (material.source.kind === "document") return "문서";
  return material.source.origin === "recording" ? "녹음" : "음성";
}

function CandidateRow({
  last,
  material,
  onPress,
  projectTitle,
  selected,
}: {
  last: boolean;
  material: StudyMaterial;
  onPress: () => void;
  projectTitle: string;
  selected: boolean;
}) {
  const t = useT();
  const kind = t(sourceLabel(material));
  return (
    <Pressable
      accessibilityLabel={`${material.title}. ${projectTitle}`}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={({
        hovered,
        pressed,
      }: {
        hovered?: boolean;
        pressed: boolean;
      }) => [
        styles.row,
        !last ? styles.rowDivider : null,
        hovered && !selected ? styles.rowPressed : null,
        selected ? styles.rowSelected : null,
        pressed ? styles.rowPressed : null,
      ]}
    >
      <MediaArtwork
        compact
        kind={material.source.kind}
        status={material.status}
      />
      <View style={styles.flex}>
        <AppText numberOfLines={2} variant="itemTitle">
          {material.title}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="meta">
          {kind}
          {` / ${formatMaterialLength(material.source.kind, material.source.durationMs, material.transcript.length)}`}
          {" / "}
          {formatRelativeDate(material.updatedAt)}
        </AppText>
      </View>
      <View
        {...decorative}
        style={[styles.checkCircle, selected ? styles.checkCircleOn : null]}
      >
        {selected ? (
          <Check
            color={colors.textInverse}
            size={iconSizes.dense}
            strokeWidth={3}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xs,
  },
  top: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  hero: {
    borderRadius: 24,
  },
  heroRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xl,
  },
  heroRowCompact: {
    gap: spacing.md,
  },
  heroLeft: {
    flex: 1,
    gap: spacing.lg,
    minWidth: 0,
  },
  pick: {
    alignSelf: "flex-start",
  },
  flex: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  row: {
    alignItems: "center",
    cursor: "pointer",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    backgroundColor: colors.backgroundSoft,
  },
  rowSelected: {
    backgroundColor: colors.brandSubtle,
  },
  checkCircle: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: radii.full,
    borderWidth: 1.5,
    height: spacing.xl,
    justifyContent: "center",
    width: spacing.xl,
  },
  checkCircleOn: {
    backgroundColor: colors.action,
    borderColor: colors.action,
  },
  sheetFooter: {
    gap: spacing.md,
  },
});
