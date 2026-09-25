import type { CompanyPack, CompanyTrait, InterviewQuestion } from "./types";

/**
 * 회사 팩 (1차 프로토타입 더미 데이터).
 *
 * 인재상 문구(description)는 각 사가 공개한 채용 페이지의 표현을 그대로 옮겼고,
 * sourceUrl 과 verifiedAt 으로 출처와 확인일을 남긴다. 질문은 공개 정보를 참고해
 * 만든 연습용 문항이며 실제 기출이 아니다 — 지어낸 기출을 사실처럼 보이게 두면
 * 안 되므로 화면에서는 항상 INTERVIEW_DISCLAIMER 와 함께 보여준다.
 */

/** 준비 시간과 답변 시간의 기본값. 질문마다 개별로 들고 있는다(서버 계약 그대로). */
export const DEFAULT_PREP_DURATION_MS = 10_000;
export const DEFAULT_MAX_DURATION_MS = 120_000;

export const INTERVIEW_DISCLAIMER =
  "공개된 채용 정보를 참고해 만든 PREMIND 연습용 구성입니다.\n실제 면접 문항이나 합격 기준이 아니며, 전형은 공고와 직무, 시점에 따라 달라질 수 있어요.\n지원 전 공식 공고를 확인해 주세요.";

type QuestionSeed = {
  id: string;
  text: string;
  traitIds?: string[];
};

function buildQuestions(seeds: QuestionSeed[]): InterviewQuestion[] {
  return seeds.map((seed, index) => ({
    id: seed.id,
    order: index + 1,
    text: seed.text,
    traitIds: seed.traitIds ?? [],
    maxDurationMs: DEFAULT_MAX_DURATION_MS,
    prepDurationMs: DEFAULT_PREP_DURATION_MS,
  }));
}

// 삼성전자 인재상 — 출처: 삼성전자 DX부문 채용 사이트(2026-07-31 확인).
// label 은 표시용 짧은 이름이고, description 이 공개 문구 원문이다.
// 원문 표기는 "인간미/도덕성" 이지만 UI 문구 규칙(가운뎃점 금지)에 맞춰 라벨은
// "인간미와 도덕성" 으로 적는다. 설명 문장은 손대지 않는다.
const SAMSUNG_TRAITS: CompanyTrait[] = [
  {
    id: "passion",
    label: "열정",
    description: "끊임없는 열정으로 미래에 도전하는 인재",
  },
  {
    id: "creativity",
    label: "창의혁신",
    description: "창의와 혁신으로 세상을 변화시키는 인재",
  },
  {
    id: "integrity",
    label: "인간미와 도덕성",
    description: "정직과 바른행동으로 역할과 책임을 다하는 인재",
  },
];

// LG전자 인재상 — 출처: LG전자 인재채용 인재상 페이지(2026-07-31 확인).
// 네 문장이 곧 공개 원문이고, label 은 그 문장에서 뽑은 표시용 이름이다.
const LG_TRAITS: CompanyTrait[] = [
  {
    id: "challenge",
    label: "꿈과 열정",
    description: "꿈과 열정을 가지고 세계 최고에 도전하는 사람",
  },
  {
    id: "customer",
    label: "고객 최우선",
    description: "고객을 최우선으로 생각하고 끊임없이 혁신하는 사람",
  },
  {
    id: "teamwork",
    label: "팀워크",
    description: "팀워크를 이루며 자율적이고 창의적으로 일하는 사람",
  },
  {
    id: "fairness",
    label: "정정당당",
    description: "꾸준히 실력을 배양하여 정정당당하게 경쟁하는 사람",
  },
];

export const COMPANY_PACKS: CompanyPack[] = [
  {
    id: "samsung",
    name: "삼성전자",
    // 공개된 절차는 지원서 접수, GSAT, 면접 순으로 안내된다. 면접 안에서 나뉘는
    // 세부 단계 명칭은 공고마다 달라 일반 표기로 둔다.
    stage: "면접 전형",
    sourceUrl: "https://www.samsung-dxrecruit.com/company",
    verifiedAt: "2026-07-31",
    traits: SAMSUNG_TRAITS,
    questions: buildQuestions([
      {
        id: "samsung_intro",
        // 답변 시간은 면접관 대사가 maxDurationMs 를 읽어 붙인다. 질문 문구에 시간을
        // 적어 두면 둘이 어긋난다("1분 안에 소개해 주세요. 2분 안에 답변해 주세요.").
        text: "지원한 직무와 연결해 자신을 소개해 주세요.",
      },
      {
        id: "samsung_motivation",
        text: "이 회사와 직무에 지원한 이유를 구체적으로 말씀해 주세요.",
      },
      {
        id: "samsung_persistence",
        text: "쉽게 풀리지 않는 목표를 끝까지 붙잡고 해낸 경험을 말씀해 주세요.",
        traitIds: ["passion"],
      },
      {
        id: "samsung_new_approach",
        text: "익숙한 방식을 바꿔 더 나은 결과를 만든 경험을 말씀해 주세요.",
        traitIds: ["creativity"],
      },
      {
        id: "samsung_principle",
        text: "지켜야 할 원칙과 눈앞의 결과가 부딪혔을 때 어떻게 판단했는지 말씀해 주세요.",
        traitIds: ["integrity"],
      },
      {
        id: "samsung_collaboration",
        text: "의견이 다른 동료와 하나의 결론을 만든 과정을 말씀해 주세요.",
      },
      {
        id: "samsung_setback",
        text: "기대한 결과가 나오지 않았던 경험과 그 뒤에 바꾼 행동을 말씀해 주세요.",
        traitIds: ["passion", "creativity"],
      },
      {
        id: "samsung_plan",
        text: "입사 후 1년 동안 무엇을 해내고 싶은지 말씀해 주세요.",
      },
    ]),
  },
  {
    id: "lg",
    name: "LG전자",
    // LG 채용 페이지에서 전형 단계 세부 명칭까지는 확인하지 못했다. 공고마다
    // 달라지므로 일반 표기로 두고, 확인되면 이 값을 정확한 단계명으로 바꾼다.
    stage: "면접 전형",
    sourceUrl: "https://www.lge.co.kr/company/recruit/talent",
    verifiedAt: "2026-07-31",
    traits: LG_TRAITS,
    questions: buildQuestions([
      {
        id: "lg_intro",
        // 답변 시간은 면접관 대사가 maxDurationMs 를 읽어 붙인다. 질문 문구에 시간을
        // 적어 두면 둘이 어긋난다("1분 안에 소개해 주세요. 2분 안에 답변해 주세요.").
        text: "지원한 직무와 연결해 자신을 소개해 주세요.",
      },
      {
        id: "lg_motivation",
        text: "이 회사와 직무에 지원한 이유를 구체적으로 말씀해 주세요.",
      },
      {
        id: "lg_highest_bar",
        text: "높은 기준을 세우고 그 기준에 맞춰 끝까지 해낸 경험을 말씀해 주세요.",
        traitIds: ["challenge"],
      },
      {
        id: "lg_customer",
        text: "고객이나 사용자의 문제를 직접 확인하고 해결한 경험을 말씀해 주세요.",
        traitIds: ["customer"],
      },
      {
        id: "lg_teamwork",
        text: "팀에서 맡은 역할과 스스로 판단해 움직인 부분을 말씀해 주세요.",
        traitIds: ["teamwork"],
      },
      {
        id: "lg_growth",
        text: "부족한 실력을 채우기 위해 꾸준히 해 온 일을 말씀해 주세요.",
        traitIds: ["fairness"],
      },
      {
        id: "lg_problem",
        text: "가장 어려웠던 문제를 어떻게 정의하고 해결했는지 말씀해 주세요.",
      },
      {
        id: "lg_plan",
        text: "입사 후 1년 동안 무엇을 해내고 싶은지 말씀해 주세요.",
      },
    ]),
  },
];

// ── 공통 질문 세트 ─────────────────────────────────────────────────
// 특정 회사의 공개 정보가 아니라 PREMIND가 직접 쓴 연습 문항이다. 대학
// 취업센터, 일자리플러스센터, 특성화고 수업에서 첫 연습으로 쓰도록 고객군별로
// 나눴다. 공기업 세트의 역량 이름은 국가직무능력표준(NCS) 직업기초능력의
// 공개 분류에서 가져왔다. 실제 기출이 아니므로 면책 고지와 함께 보여준다.
export const COMMON_PACKS: CompanyPack[] = [
  {
    id: "public-common",
    name: "공기업 공통",
    track: "common",
    audience: "공기업, 공공기관 신입 채용 준비",
    stage: "직업기초능력 기반 인성 면접",
    sourceUrl: "https://www.ncs.go.kr",
    verifiedAt: "2026-09-24",
    traits: [
      { id: "communication", label: "의사소통", description: "상대의 말을 이해하고 자신의 뜻을 정확히 전하는 능력" },
      { id: "problem", label: "문제해결", description: "문제를 파악하고 적절한 해결책을 찾는 능력" },
      { id: "ethics", label: "직업윤리", description: "원칙과 책임감을 가지고 일하는 태도" },
      { id: "interpersonal", label: "대인관계", description: "다른 사람과 협력하고 갈등을 조정하는 능력" },
    ],
    questions: buildQuestions([
      { id: "public_intro", text: "지원한 기관과 직무에 맞춰 자신을 소개해 주세요." },
      { id: "public_motivation", text: "많은 기관 중 이 기관에 지원한 이유를 말씀해 주세요." },
      { id: "public_public_value", text: "공공기관 직원에게 가장 필요한 자세가 무엇이라고 생각하는지, 경험과 함께 말씀해 주세요.", traitIds: ["ethics"] },
      { id: "public_rule", text: "규정과 효율이 부딪혔을 때 어떻게 판단했는지 경험을 들어 말씀해 주세요.", traitIds: ["ethics", "problem"] },
      { id: "public_conflict", text: "의견이 다른 사람을 설득하거나 조율한 경험을 말씀해 주세요.", traitIds: ["communication", "interpersonal"] },
      { id: "public_problem", text: "예상하지 못한 문제가 생겼을 때 원인을 찾아 해결한 경험을 말씀해 주세요.", traitIds: ["problem"] },
      { id: "public_complaint", text: "불만을 가진 사람을 응대한 경험이 있다면 어떻게 대처했는지 말씀해 주세요.", traitIds: ["communication"] },
      { id: "public_plan", text: "입사 후 이 직무에서 어떤 역할을 하고 싶은지 말씀해 주세요." },
    ]),
  },
  {
    id: "corporate-common",
    name: "대기업 공통 인성",
    track: "common",
    audience: "대기업, 중견기업 신입 공채 준비",
    stage: "인성, 경험 면접",
    sourceUrl: "",
    verifiedAt: "2026-09-25",
    traits: [
      { id: "ownership", label: "주도성", description: "맡은 일을 스스로 정의하고 끝까지 책임지는 태도" },
      { id: "collaboration", label: "협업", description: "다른 사람과 목표를 맞추고 함께 결과를 내는 능력" },
      { id: "growth", label: "성장", description: "실패와 피드백에서 배우고 바꾸는 태도" },
    ],
    questions: buildQuestions([
      { id: "corp_intro", text: "지원한 직무와 연결해 1분 동안 자신을 소개해 주세요." },
      { id: "corp_motivation", text: "여러 회사 중 이 회사에 지원한 이유를 구체적으로 말씀해 주세요." },
      { id: "corp_ownership", text: "누가 시키지 않았지만 스스로 나서서 해낸 일을 말씀해 주세요.", traitIds: ["ownership"] },
      { id: "corp_conflict", text: "팀에서 의견이 크게 갈렸을 때 어떻게 결론을 만들었는지 말씀해 주세요.", traitIds: ["collaboration"] },
      { id: "corp_failure", text: "가장 크게 실패한 경험과 그 뒤에 바꾼 행동을 말씀해 주세요.", traitIds: ["growth"] },
      { id: "corp_pressure", text: "마감이 겹쳐 시간이 부족했을 때 우선순위를 어떻게 정했는지 말씀해 주세요.", traitIds: ["ownership"] },
      { id: "corp_feedback", text: "받아들이기 어려운 피드백을 받았던 경험과 그 뒤의 변화를 말씀해 주세요.", traitIds: ["growth"] },
      { id: "corp_plan", text: "입사 후 3년 동안 이루고 싶은 목표를 말씀해 주세요." },
    ]),
  },
  {
    id: "highschool-office",
    name: "사무직, 서비스직",
    track: "common",
    audience: "사무, 서비스 직무 고졸 채용 준비",
    stage: "사무, 서비스 직무 면접",
    sourceUrl: "",
    verifiedAt: "2026-09-25",
    traits: [
      { id: "accuracy", label: "꼼꼼함", description: "숫자와 문서를 정확하게 다루는 태도" },
      { id: "service", label: "친절", description: "상대의 입장에서 듣고 돕는 태도" },
      { id: "sincerity", label: "성실", description: "맡은 일을 약속한 대로 해내는 태도" },
    ],
    questions: buildQuestions([
      { id: "office_intro", text: "지원한 직무와 연결해 자신을 짧게 소개해 주세요." },
      { id: "office_motivation", text: "사무직이나 서비스직을 선택한 이유를 말씀해 주세요." },
      { id: "office_accuracy", text: "실수 없이 꼼꼼하게 해내야 했던 일과 그때 쓴 방법을 말씀해 주세요.", traitIds: ["accuracy"] },
      { id: "office_customer", text: "화가 난 손님이나 친구를 대했던 경험이 있다면 어떻게 했는지 말씀해 주세요.", traitIds: ["service"] },
      { id: "office_tools", text: "문서 작성이나 컴퓨터 활용 중 자신 있는 것과 그것을 익힌 과정을 말씀해 주세요.", traitIds: ["accuracy"] },
      { id: "office_rule", text: "정해진 규칙을 지키는 것이 불편했던 경험과 그때의 선택을 말씀해 주세요.", traitIds: ["sincerity"] },
      { id: "office_team", text: "선배나 동료에게 도움을 요청해야 할 때 어떻게 말할지 말씀해 주세요.", traitIds: ["service"] },
      { id: "office_future", text: "입사 후 어떤 직원으로 기억되고 싶은지 말씀해 주세요.", traitIds: ["sincerity"] },
    ]),
  },
  {
    id: "highschool-common",
    name: "고졸 채용 공통",
    track: "common",
    audience: "특성화고, 마이스터고, 일반고 취업 준비",
    stage: "고졸 신입 채용 면접",
    sourceUrl: "",
    verifiedAt: "2026-09-24",
    traits: [
      { id: "sincerity", label: "성실", description: "맡은 일을 꾸준하고 책임 있게 해내는 태도" },
      { id: "cooperation", label: "협동", description: "친구, 동료와 힘을 모아 함께 해내는 태도" },
      { id: "learning", label: "배우려는 자세", description: "모르는 것을 묻고 익혀 나가는 태도" },
    ],
    questions: buildQuestions([
      { id: "hs_intro", text: "자신을 짧게 소개해 주세요." },
      { id: "hs_motivation", text: "이 회사에 지원한 이유를 말씀해 주세요." },
      { id: "hs_school", text: "학교에서 가장 열심히 한 일과 그 일에서 배운 점을 말씀해 주세요.", traitIds: ["sincerity"] },
      { id: "hs_certificate", text: "자격증이나 실습을 준비하며 어려웠던 점과 어떻게 이겨냈는지 말씀해 주세요.", traitIds: ["learning", "sincerity"] },
      { id: "hs_team", text: "친구들과 함께 무언가를 해낸 경험과 그때 맡은 역할을 말씀해 주세요.", traitIds: ["cooperation"] },
      { id: "hs_mistake", text: "실수를 했을 때 어떻게 대처했는지 경험을 말씀해 주세요.", traitIds: ["sincerity"] },
      { id: "hs_strength", text: "자신의 장점 하나와, 그 장점이 일에서 어떻게 도움이 될지 말씀해 주세요." },
      { id: "hs_future", text: "입사 후 어떤 사람이 되고 싶은지 말씀해 주세요.", traitIds: ["learning"] },
    ]),
  },
  {
    id: "highschool-technical",
    name: "생산직, 기술직",
    track: "common",
    audience: "제조, 기술 직무 고졸 채용 준비",
    stage: "생산, 기술 직무 면접",
    sourceUrl: "",
    verifiedAt: "2026-09-24",
    traits: [
      { id: "safety", label: "안전 의식", description: "정해진 절차와 안전 수칙을 지키는 태도" },
      { id: "sincerity", label: "성실", description: "반복되는 일도 꼼꼼하고 책임 있게 해내는 태도" },
      { id: "teamwork", label: "팀워크", description: "교대, 공정 동료와 호흡을 맞추는 태도" },
    ],
    questions: buildQuestions([
      { id: "tech_intro", text: "지원한 직무와 연결해 자신을 소개해 주세요." },
      { id: "tech_motivation", text: "이 직무를 선택한 이유를 말씀해 주세요." },
      { id: "tech_practice", text: "실습이나 현장 실습에서 가장 기억에 남는 작업과 배운 점을 말씀해 주세요.", traitIds: ["sincerity"] },
      { id: "tech_safety", text: "안전 수칙을 지키는 것이 왜 중요한지, 직접 겪은 일과 함께 말씀해 주세요.", traitIds: ["safety"] },
      { id: "tech_shift", text: "교대 근무나 반복되는 작업을 할 때 집중력을 어떻게 유지할지 말씀해 주세요.", traitIds: ["sincerity"] },
      { id: "tech_report", text: "작업 중 이상한 점을 발견하면 어떻게 행동할지 말씀해 주세요.", traitIds: ["safety", "teamwork"] },
      { id: "tech_team", text: "선배나 동료와 의견이 다를 때 어떻게 할지 말씀해 주세요.", traitIds: ["teamwork"] },
      { id: "tech_future", text: "이 일에서 5년 뒤 어떤 기술자가 되어 있고 싶은지 말씀해 주세요." },
    ]),
  },
];

/** 알 수 없는 회사 id 는 null. 호출부는 이를 404 로 다룬다. */
export function getCompanyPack(id: string | null | undefined): CompanyPack | null {
  if (!id) return null;
  return COMPANY_PACKS.find((pack) => pack.id === id) ?? COMMON_PACKS.find((pack) => pack.id === id) ?? null;
}

export function getTrait(
  pack: CompanyPack,
  traitId: string,
): CompanyTrait | undefined {
  return pack.traits.find((trait) => trait.id === traitId);
}
