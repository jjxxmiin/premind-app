import { router } from "expo-router";
import {
  Building2,
  FileText,
  History,
  ListChecks,
  Mic,
  PenLine,
  Play,
  Plus,
  Ticket,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { AllowanceCard } from "@/components/interview/AllowanceCard";
import { InterviewSessionRow } from "@/components/interview/InterviewSessionRow";
import { SpeakColumns, SpeakFrame } from "@/components/speak/SpeakColumns";
import {
  SpeakTitle,
  Surface,
} from "@/components/speak/SpeakKit";
import {
  AnimatedReveal,
  AppText,
  BottomSheetModal,
  Button,
  IconButton,
  ListRow,
  Screen,
  Skeleton,
} from "@/components/ui";
import { installBackupSync } from "@/features/interview/backup-sync";
import { latestNextPractice } from "@/features/interview/practice-stats";
import { resolveSessionSource } from "@/features/interview/session-source";
import type { InterviewSession } from "@/features/interview/types";
import { useInterviewAccount } from "@/features/interview/use-interview-account";
import { useInterviewSessions } from "@/features/interview/use-interview-sessions";
import {
  answeredQuestionCount,
  lastActivity,
  relativeDay,
  sessionDestination,
} from "@/features/interview/view-model";
import { decorative } from "@/lib/a11y";
import { useLocale, useT } from "@/lib/i18n";
import { useLayout } from "@/lib/layout";
import { colors, iconSizes, spacing } from "@/theme/tokens";

type StartFrom = "resume" | "packs" | "custom";

// 연습을 시작하는 세 길. 주 버튼이 질문 세트면 나머지 둘이 작은 회색 버튼, 이어서 하기가 있으면
// "새 연습" 버튼 하나가 세 길을 시트로 연다.
const START_WAYS: readonly { from: StartFrom; label: string; icon: LucideIcon }[] = [
  { from: "packs", label: "질문 세트", icon: ListChecks },
  { from: "resume", label: "자소서로", icon: FileText },
  { from: "custom", label: "직접 만들기", icon: PenLine },
];

/**
 * 말하기 탭의 면접 쪽. 2026-09-26 덜어내기(플랜핏 결): 흰 카드 하나에 제목 한 줄, 화면 폭 주 버튼
 * 하나(이어서 하기, 없으면 연습 시작), 그 아래 작은 회색 보조 버튼들. 그다음 최근 연습 목록,
 * AI 피드백 남은 횟수 한 줄, 기관 한 줄. `switcher` 는 발표, 면접을 고르는 알약.
 */
export function InterviewHome({ switcher }: { switcher?: ReactNode }) {
  const t = useT();
  const locale = useLocale();
  const { breakpoint, gutter } = useLayout();
  const account = useInterviewAccount();
  const { sessions } = useInterviewSessions();
  const wide = breakpoint === "expanded";

  const [startSheet, setStartSheet] = useState(false);

  useEffect(() => installBackupSync(), []);

  const view = useMemo(() => {
    if (!sessions) return null;
    const sorted = [...sessions].sort((a, b) =>
      lastActivity(b).localeCompare(lastActivity(a)),
    );
    const inProgress = sorted.find(
      (session) =>
        session.status !== "completed" && resolveSessionSource(session),
    );
    return {
      next: latestNextPractice(sessions),
      inProgress,
      // 머리 카드에 크게 보인 이어서 하기는 목록에서 뺀다(같은 것을 두 번 보이지 않게).
      recent: sorted.filter((session) => session !== inProgress).slice(0, 3),
      firstTime: sessions.length === 0,
    };
  }, [sessions]);

  const user = account.status === "ready" ? account.user : null;
  const allowance = account.status === "ready" ? account.allowance : null;
  const demo = account.status === "ready" && account.demo;
  const open = (session: InterviewSession) =>
    router.push(sessionDestination(session));
  const start = (from: StartFrom) => {
    setStartSheet(false);
    router.push({ pathname: "/interview/prepare", params: { from } });
  };

  // 머리 카드: 이어서 하기가 있으면 그것, 없으면 질문 세트로 바로 시작.
  const resume = view?.inProgress ?? null;
  const resumeSource = resume ? resolveSessionSource(resume) : null;
  const heroTitle = resume
    ? t(resumeSource?.title ?? "면접 연습")
    : t(view?.firstTime ? "첫 질문부터 말해볼까요?" : "무엇을 연습할까요?");
  const heroMeta = resume
    ? t("{done} / {total}개 답변, {when}", {
        done: answeredQuestionCount(resume),
        total: resumeSource?.questions.length ?? 0,
        when: relativeDay(lastActivity(resume), new Date(), locale),
      })
    : view?.next
      ? view.next.text
      : null;
  const hero = (
    <Surface padding={spacing.xl} style={styles.hero} tone="raised">
      <View style={styles.heroCopy}>
        <AppText numberOfLines={2} variant="pageTitle">
          {heroTitle}
        </AppText>
        {heroMeta ? (
          <AppText numberOfLines={2} tone="muted" variant="meta">
            {heroMeta}
          </AppText>
        ) : null}
      </View>
      {resume ? (
        <Button
          fullWidth
          leftIcon={<Play color={colors.textInverse} size={iconSizes.inline} />}
          onPress={() => open(resume)}
          size="large"
          testID="interview-continue"
          variant="brand"
        >
          {t("이어서 하기")}
        </Button>
      ) : (
        <Button
          accessibilityHint={t(
            "공기업, 대기업, 고졸 채용 공통 질문이나 회사별 질문으로 바로 시작해요.",
          )}
          fullWidth
          leftIcon={<Mic color={colors.textInverse} size={iconSizes.inline} />}
          onPress={() => start("packs")}
          size="large"
          testID="interview-start"
          variant="brand"
        >
          {t("연습 시작")}
        </Button>
      )}
      <View style={styles.secondaryRow}>
        {resume ? (
          <Button
            leftIcon={<Plus color={colors.text} size={iconSizes.inline} />}
            onPress={() => setStartSheet(true)}
            size="small"
            style={styles.secondary}
            variant="secondary"
          >
            {t("새 연습")}
          </Button>
        ) : (
          START_WAYS.filter((way) => way.from !== "packs").map((way) => (
            <Button
              key={way.from}
              onPress={() => start(way.from)}
              size="small"
              style={styles.secondary}
              variant="secondary"
            >
              {t(way.label)}
            </Button>
          ))
        )}
      </View>
    </Surface>
  );

  const allowanceBlock =
    account.status === "loading" ? (
      <Skeleton height={72} />
    ) : (
      <AllowanceCard allowance={allowance} demo={demo} />
    );

  // 이어서 하기 하나뿐이면 목록은 비워 두지 않고 통째로 뺀다.
  const recentBlock = view && view.recent.length === 0 && resume ? null : (
    <View accessibilityLabel={t("최근 연습")} style={styles.section}>
      {!view ? (
        <Skeleton height={68} />
      ) : view.recent.length === 0 ? (
        <Surface style={styles.emptyRecent} tone="raised">
          <History
            {...decorative}
            color={colors.textFaint}
            size={iconSizes.section}
            strokeWidth={1.8}
          />
          <AppText style={styles.flex} tone="muted" variant="meta">
            {t("아직 연습 기록이 없어요.")}
          </AppText>
        </Surface>
      ) : (
        <Surface padding={0} style={styles.list} tone="raised">
          {view.recent.map((session, index) => (
            <InterviewSessionRow
              key={session.id}
              last={index === view.recent.length - 1}
              onPress={() => open(session)}
              session={session}
            />
          ))}
        </Surface>
      )}
    </View>
  );

  const orgBlock = (
    <Surface padding={0} style={styles.list} tone="raised">
      {user?.role === "manager" ? (
        <ListRow
          divider={false}
          leadingIcon={Building2}
          onPress={() => router.push("/interview/org")}
          showChevron
          title={t("기관 현황")}
        />
      ) : user?.role === "student" && user.orgName ? (
        <ListRow
          divider={false}
          leadingIcon={Building2}
          subtitle={
            user.groupName
              ? t("{group}에 참여하고 있어요", { group: user.groupName })
              : t("기관에 참여하고 있어요")
          }
          title={user.orgName}
        />
      ) : (
        <ListRow
          divider={false}
          leadingIcon={Ticket}
          onPress={() => router.push("/interview/join")}
          showChevron
          title={t("초대 코드 입력")}
        />
      )}
    </Surface>
  );

  const top = (
    <View style={styles.top}>
      <SpeakTitle title={t("연습")} />
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
              icon={History}
              label={t("연습 기록")}
              onPress={() => router.push("/interview/history")}
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
                  {recentBlock ? <AnimatedReveal delay={120}>{recentBlock}</AnimatedReveal> : null}
                </>
              }
              side={
                <>
                  <AnimatedReveal delay={120}>{allowanceBlock}</AnimatedReveal>
                  <AnimatedReveal delay={180}>{orgBlock}</AnimatedReveal>
                </>
              }
              sideWidth={340}
            />
          ) : (
            <>
              <AnimatedReveal delay={60}>{hero}</AnimatedReveal>
              {recentBlock ? <AnimatedReveal delay={120}>{recentBlock}</AnimatedReveal> : null}
              <AnimatedReveal delay={160}>{allowanceBlock}</AnimatedReveal>
              <AnimatedReveal delay={200}>{orgBlock}</AnimatedReveal>
            </>
          )}
        </View>
      </SpeakFrame>
      <BottomSheetModal
        onClose={() => setStartSheet(false)}
        title={t("새 연습")}
        visible={startSheet}
      >
        <Surface padding={0} style={styles.list} tone="raised">
          {START_WAYS.map((way, index) => (
            <ListRow
              divider={index < START_WAYS.length - 1}
              key={way.from}
              leadingIcon={way.icon}
              onPress={() => start(way.from)}
              showChevron
              title={t(way.label)}
            />
          ))}
        </Surface>
      </BottomSheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xs,
  },
  top: { gap: spacing.lg },
  section: { gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  hero: { borderRadius: 24, gap: spacing.lg },
  heroCopy: { gap: spacing.xs },
  secondaryRow: { flexDirection: "row", gap: spacing.sm },
  secondary: { flex: 1, paddingHorizontal: spacing.xs },
  emptyRecent: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  list: { overflow: "hidden" },
});
