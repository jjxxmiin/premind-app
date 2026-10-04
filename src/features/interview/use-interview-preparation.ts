import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { getCompanyPack } from './company-packs';
import { DEFAULT_ANSWER_DURATION_SEC, DEFAULT_PREP_DURATION_SEC, MAX_CUSTOM_QUESTIONS, UNTITLED_SET_TITLE } from './custom';
import { GUIDED_INPUT_LIMITS, validateGuidedExpansion, type GuidedClaim } from './guided';
import { cancelUsage, commitUsage, interviewServerAvailable, isPlanLimit, requestGuidedExpansion, requestGuidedQuestions, reserveUsage, type Reservation } from './interview-api';
import { getSession, newId } from './interview-storage';
import { aiAllowanceProblem } from './practice-charge';
import { buildDefaultInterviewQuestions, guidedQuestionsToPractice, interviewDraftTitle } from './preparation';
import { savePreparedPractice } from './save-prepared-practice';
import type { CustomInterviewQuestion, InterviewFeedbackMode } from './types';
import { setInterviewAllowance, useInterviewAccount } from './use-interview-account';
import { useLocale, useT } from '@/lib/i18n';

type From = 'resume' | 'packs' | 'custom';
export const MIN_RESUME_LENGTH = 100;
export function blankQuestion(): CustomInterviewQuestion {
  return { id: newId(), question: '', answerDurationSec: DEFAULT_ANSWER_DURATION_SEC, prepDurationSec: DEFAULT_PREP_DURATION_SEC, kind: 'common' };
}

export function useInterviewPreparation() {
  const t = useT();
  const locale = useLocale();
  const params = useLocalSearchParams<{ from?: string; company?: string; again?: string; mode?: string }>();
  const from: From = params.from === 'packs' || params.from === 'custom' ? params.from : 'resume';
  const account = useInterviewAccount();
  const allowance = account.status === 'ready' ? account.allowance : null;
  const demo = account.status === 'ready' && account.demo;

  const [step, setStep] = useState<'questions' | 'mode'>(params.company && getCompanyPack(params.company) ? 'mode' : 'questions');
  const [packId, setPackId] = useState<string | null>(getCompanyPack(params.company)?.id ?? null);
  const [form, setForm] = useState({ company: '', jobRole: '', jobDescription: '', resumeText: '' });
  const [questions, setQuestions] = useState<CustomInterviewQuestion[]>(() => (from === 'custom' ? [blankQuestion()] : []));
  const [customTitle, setCustomTitle] = useState('');
  const [claims, setClaims] = useState<GuidedClaim[]>([]);
  const [generationMode, setGenerationMode] = useState<'ai' | 'fallback'>('fallback');
  const [preparing, setPreparing] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 고른 방식. 고르기 전(null)에는 AI 를 쓸 수 있는 계정이면 AI 피드백 연습이 먼저 골라져 있다
  // (2026-09-26: 스탠다드 결제 뒤에도 늘 기본 연습이 골라져 있어 AI 없이 시작되던 것).
  const [chosenMode, setMode] = useState<InterviewFeedbackMode | null>(
    params.mode === 'ai' ? 'ai' : params.mode === 'basic' ? 'basic' : null,
  );
  const [video, setVideo] = useState(false);
  const [starting, setStarting] = useState(false);
  const againLoaded = useRef(false);

  // "처음부터 다시": 지난 연습의 질문 묶음을 그대로 물려받는다.
  useEffect(() => {
    if (!params.again || againLoaded.current) return;
    againLoaded.current = true;
    void getSession(params.again).then((previous) => {
      if (!previous) return;
      const set = previous.customSet;
      if (set) {
        setQuestions(set.questions.map((question) => ({ ...question })));
        setCustomTitle(set.title);
        if (set.guided) {
          const guided = set.guided;
          setForm((current) => ({ ...current, company: guided.company, jobRole: guided.jobRole }));
          setClaims(guided.claims);
          setGenerationMode(guided.generationMode);
        }
      } else if (getCompanyPack(previous.companyId)) {
        setPackId(previous.companyId);
      }
      setMode(previous.feedbackMode === 'ai' ? 'ai' : 'basic');
      setStep('mode');
    });
  }, [params.again]);

  const resumeText = form.resumeText.trim();
  const resumeReady = resumeText.length >= MIN_RESUME_LENGTH && resumeText.length <= GUIDED_INPUT_LIMITS.resumeText;
  const filled = questions.filter((question) => question.question.trim().length > 0);
  const pack = getCompanyPack(packId);
  const aiProblem = aiAllowanceProblem(allowance, locale);
  const mode: InterviewFeedbackMode = chosenMode ?? (allowance && !demo && !aiProblem ? 'ai' : 'basic');
  const server = interviewServerAvailable();
  const canRecordVideo = Platform.OS === 'web';

  const questionCount = pack ? pack.questions.length : filled.length;
  const title = pack
    ? pack.name
    : from === 'custom' || (params.again && !form.company && !form.jobRole && customTitle)
      ? customTitle.trim() || UNTITLED_SET_TITLE
      : interviewDraftTitle(form, locale);

  async function prepareFromResume() {
    if (preparing) return;
    setError(null);
    setNotice(null);
    if (!form.company.trim() && !form.jobRole.trim()) {
      setError(t('지원할 회사나 직무를 적어 주세요.'));
      return;
    }
    setPreparing(true);
    try {
      if (resumeReady && server) {
        try {
          const response = await requestGuidedQuestions({
            company: form.company.trim(),
            jobRole: form.jobRole.trim(),
            jobDescription: form.jobDescription.trim(),
            resumeText,
          });
          // Same shape check as the web (guided-setup.tsx): the server already validated the content.
          if (
            (response?.generationMode !== 'ai' && response?.generationMode !== 'fallback') ||
            !Array.isArray(response.claims) ||
            !Array.isArray(response.questions) ||
            response.questions.length === 0
          ) {
            throw new Error('invalid guided response');
          }
          setQuestions(guidedQuestionsToPractice(response));
          setClaims(response.claims);
          setGenerationMode(response.generationMode);
          return;
        } catch (reason) {
          setNotice(
            isPlanLimit(reason) || (reason instanceof Error && /한도|많아요/.test(reason.message))
              ? `${reason instanceof Error ? t(reason.message) : ''} ${t('기본 질문으로 먼저 준비했어요.')}`
              : t('자기소개서 질문을 만들지 못해 기본 질문으로 준비했어요. 입력한 내용은 그대로 있으니 잠시 후 아래에서 다시 만들 수 있어요.'),
          );
        }
      } else if (resumeText && !resumeReady) {
        setNotice(t('자기소개서는 {n}자 이상일 때 맞춤 질문을 만들어요. 기본 질문으로 먼저 준비했어요.', { n: MIN_RESUME_LENGTH }));
      } else if (resumeText && !server) {
        setNotice(t('데모에서는 자기소개서 질문을 만들지 않아요. 기본 질문으로 준비했어요.'));
      }
      setQuestions(buildDefaultInterviewQuestions(form, locale));
      setClaims([]);
      setGenerationMode('fallback');
    } finally {
      setPreparing(false);
    }
  }

  async function expandFromResume() {
    if (expanding || !resumeReady || !server) return;
    if (questions.length > MAX_CUSTOM_QUESTIONS - 2) {
      setError(t('질문은 {n}개까지 만들 수 있어요.', { n: MAX_CUSTOM_QUESTIONS }));
      return;
    }
    setExpanding(true);
    setError(null);
    let reservation: Reservation | undefined;
    let applied = false;
    try {
      const reserved = await reserveUsage(`questions:${newId()}`, 'questions');
      reservation = reserved.result;
      setInterviewAllowance(reserved.allowance);
      const existing = filled.map((question) => ({
        question: question.question.trim(),
        sourceQuote: question.sourceQuote && resumeText.includes(question.sourceQuote) ? question.sourceQuote : null,
      }));
      const response = await requestGuidedExpansion(
        { company: form.company.trim(), jobRole: form.jobRole.trim(), jobDescription: form.jobDescription.trim(), resumeText, existingQuestions: existing },
        reservation.id,
      );
      const { additions } = validateGuidedExpansion({ additions: response.additions }, { resumeText, existingQuestions: existing }, { lang: locale });
      const parentId = newId();
      const nextClaims = [...claims];
      const added: CustomInterviewQuestion[] = additions.map((addition, index) => {
        let claim = nextClaims.find((item) => item.sourceQuote === addition.sourceQuote);
        if (!claim) {
          claim = { id: newId(), text: addition.sourceQuote, sourceQuote: addition.sourceQuote };
          nextClaims.push(claim);
        }
        return {
          id: index === 0 ? parentId : newId(),
          question: addition.question,
          answerDurationSec: addition.kind === 'follow_up' ? 90 : 120,
          prepDurationSec: DEFAULT_PREP_DURATION_SEC,
          kind: addition.kind,
          claimId: claim.id,
          parentQuestionId: addition.kind === 'follow_up' ? parentId : null,
          sourceQuote: addition.sourceQuote,
        };
      });
      setInterviewAllowance(await commitUsage(reservation));
      applied = true;
      setQuestions((current) => [...current, ...added]);
      setClaims(nextClaims);
      setGenerationMode('ai');
      setNotice(t('자소서 질문과 꼬리질문을 하나씩 추가했어요.'));
    } catch (reason) {
      setError(
        t(
          isPlanLimit(reason) && reason.message
            ? reason.message
            : 'AI 질문을 추가하지 못했어요. 기존 질문과 이용 횟수는 그대로예요. 다시 시도해 주세요.',
        ),
      );
    } finally {
      if (reservation && !applied) {
        setInterviewAllowance(await cancelUsage(reservation).catch(() => undefined));
      }
      setExpanding(false);
    }
  }

  function toModeStep() {
    setError(null);
    if (from === 'packs') {
      if (!pack) {
        setError(t('연습할 질문 세트를 골라 주세요.'));
        return;
      }
    } else if (filled.length === 0) {
      setError(t('질문을 한 개 이상 적어 주세요.'));
      return;
    }
    setStep('mode');
  }

  async function start() {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const session = await savePreparedPractice({ from, company: form.company, jobRole: form.jobRole, title, questions: filled, claims, generationMode, pack, mode, video, canRecordVideo });
      router.replace({ pathname: '/interview/room/[id]', params: { id: session.id } });
    } catch (reason) {
      setError(t(reason instanceof Error ? reason.message : '연습을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      setStarting(false);
    }
  }

  return {
    params, from, account, allowance, demo, step, setStep, packId, setPackId, form, setForm,
    questions, setQuestions, customTitle, setCustomTitle, generationMode, preparing, expanding, notice, error,
    setMode, video, setVideo, starting, resumeText, resumeReady, filled, pack, aiProblem, mode, server,
    canRecordVideo, questionCount, title, prepareFromResume, expandFromResume, toModeStep, start,
  };
}
export type InterviewPreparation = ReturnType<typeof useInterviewPreparation>;
