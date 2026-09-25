import { getCompanyPack } from "./company-packs";
import { customSetQuestions } from "./custom";
import type {
  CompanyTrait,
  InterviewQuestion,
  InterviewSession,
} from "./types";

/**
 * 세션이 어디서 나온 면접인지 한 곳에서 풀어 준다.
 *
 * 실전 면접은 회사 팩에서, 자유 면접은 세션에 복사해 둔 질문 묶음에서 온다.
 * 면접실과 기록 화면과 허브가 각자 이 분기를 들고 있으면 한쪽만 고치는 사고가
 * 나므로 여기 모아 둔다.
 */
export type SessionSource = {
  kind: "company" | "custom" | "guided";
  /** 화면에 크게 쓰는 이름 — 회사명 또는 묶음 제목. */
  title: string;
  /** "실전 면접" 또는 "자유 면접". */
  kindLabel: string;
  /** 제목 아래 한 줄 — 전형 단계 또는 질문 구성 설명. */
  subtitle: string;
  questions: InterviewQuestion[];
  /** 인재상은 회사 팩에만 있다. 자유 면접은 빈 배열. */
  traits: CompanyTrait[];
  sourceUrl?: string;
  verifiedAt?: string;
};

/** 풀 수 없는 세션(사라진 회사 팩 등)은 null — 호출부는 이를 404 로 다룬다. */
export function resolveSessionSource(
  session: InterviewSession | null | undefined,
): SessionSource | null {
  if (!session) return null;

  if (session.customSet) {
    const set = session.customSet;
    if (set.kind === "guided" && set.guided) {
      const resumeUsed =
        set.guided.resumeUsed ??
        (set.guided.claims.length > 0 ||
          set.questions.some((question) => Boolean(question.sourceQuote)));
      const supportContext = [set.guided.company, set.guided.jobRole]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(" / ");
      return {
        kind: "guided",
        title: set.title,
        kindLabel: resumeUsed ? "자소서 기반 면접" : "면접 연습",
        subtitle:
          supportContext ||
          `${resumeUsed ? "자소서 기반" : "기본"} 질문 ${set.questions.length}개`,
        questions: customSetQuestions(set.questions),
        traits: [],
      };
    }
    return {
      kind: "custom",
      title: set.title,
      kindLabel: "자유 면접",
      subtitle: `직접 만든 질문 ${set.questions.length}개`,
      questions: customSetQuestions(set.questions),
      traits: [],
    };
  }

  const pack = getCompanyPack(session.companyId);
  if (!pack) return null;
  return {
    kind: "company",
    title: pack.name,
    kindLabel: "실전 면접",
    subtitle: pack.stage,
    questions: pack.questions,
    traits: pack.traits,
    sourceUrl: pack.sourceUrl,
    verifiedAt: pack.verifiedAt,
  };
}
