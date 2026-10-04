import { newId, putSession } from './interview-storage';
import { createSessionRecord } from './session-machine';
import type { GuidedClaim } from './guided';
import type { CompanyPack, CustomInterviewQuestion, CustomInterviewSet, InterviewFeedbackMode } from './types';

type PreparedPractice = {
  readonly from: 'resume' | 'packs' | 'custom';
  readonly company: string;
  readonly jobRole: string;
  readonly title: string;
  readonly questions: CustomInterviewQuestion[];
  readonly claims: GuidedClaim[];
  readonly generationMode: 'ai' | 'fallback';
  readonly pack: CompanyPack | null;
  readonly mode: InterviewFeedbackMode;
  readonly video: boolean;
  readonly canRecordVideo: boolean;
};

export async function savePreparedPractice(draft: PreparedPractice) {
  let customSet: CustomInterviewSet | undefined;
  if (!draft.pack) {
    const kind = draft.from === 'custom' && draft.claims.length === 0 && !draft.company && !draft.jobRole ? 'custom' : 'guided';
    const now = new Date().toISOString();
    customSet = {
      id: newId(),
      title: draft.title,
      questions: draft.questions.map((question) => ({ ...question, question: question.question.trim() })),
      kind,
      ...(kind === 'guided'
        ? {
            guided: {
              company: draft.company.trim(),
              jobRole: draft.jobRole.trim(),
              claims: draft.claims.filter((claim) => draft.questions.some((question) => question.claimId === claim.id)),
              generationMode: draft.generationMode,
              resumeUsed: draft.questions.some((question) => Boolean(question.sourceQuote)),
            },
          }
        : {}),
      createdAt: now,
      updatedAt: now,
    };
  }
  const session = createSessionRecord(newId(), {
    companyId: draft.pack?.id ?? '',
    ...(customSet
      ? { customSet: { id: customSet.id, title: customSet.title, questions: customSet.questions, kind: customSet.kind, ...(customSet.guided ? { guided: customSet.guided } : {}) } }
      : {}),
    feedbackMode: draft.mode,
    capture: draft.mode === 'ai' && draft.video && draft.canRecordVideo ? 'record' : 'off',
  });
  await putSession(session);
  return session;
}
