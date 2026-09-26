import { router, useLocalSearchParams } from 'expo-router';
import { Check, Mic, Sparkles, Video } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { QuestionListEditor } from '@/components/interview/QuestionListEditor';
import {
  AppText,
  AuthField,
  Button,
  Card,
  Screen,
  SectionHeader,
  StatusBadge,
  TextArea,
} from '@/components/ui';
import { COMMON_PACKS, COMPANY_PACKS, INTERVIEW_DISCLAIMER, getCompanyPack } from '@/features/interview/company-packs';
import {
  DEFAULT_ANSWER_DURATION_SEC,
  DEFAULT_PREP_DURATION_SEC,
  MAX_CUSTOM_QUESTIONS,
  UNTITLED_SET_TITLE,
  totalAnswerLabel,
} from '@/features/interview/custom';
import {
  GUIDED_INPUT_LIMITS,
  validateGuidedExpansion,
  type GuidedClaim,
} from '@/features/interview/guided';
import {
  cancelUsage,
  commitUsage,
  interviewServerAvailable,
  isPlanLimit,
  requestGuidedExpansion,
  requestGuidedQuestions,
  reserveUsage,
  type Reservation,
} from '@/features/interview/interview-api';
import { getSession, newId, putSession } from '@/features/interview/interview-storage';
import { aiAllowanceProblem, aiPriceLabel } from '@/features/interview/practice-charge';
import {
  buildDefaultInterviewQuestions,
  guidedQuestionsToPractice,
  interviewDraftTitle,
} from '@/features/interview/preparation';
import { PLAN } from '@/features/interview/pricing';
import { createSessionRecord } from '@/features/interview/session-machine';
import type { CustomInterviewQuestion, CustomInterviewSet, InterviewFeedbackMode } from '@/features/interview/types';
import { setInterviewAllowance, useInterviewAccount } from '@/features/interview/use-interview-account';
import { decorative } from '@/lib/a11y';
import { fmtNumber, useLocale, useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

type From = 'resume' | 'packs' | 'custom';
const MIN_RESUME_LENGTH = 100;

function blankQuestion(): CustomInterviewQuestion {
  return { id: newId(), question: '', answerDurationSec: DEFAULT_ANSWER_DURATION_SEC, prepDurationSec: DEFAULT_PREP_DURATION_SEC, kind: 'common' };
}

/**
 * 새 연습: 질문을 준비하고(질문 세트, 자기소개서, 직접 만들기) 연습 방식을
 * 고른다. 면접 웹의 setup-flow, interview-preparation 을 한 화면 두 단계로.
 */
export default function InterviewPrepareScreen() {
  const t = useT();
  const locale = useLocale();
  const params = useLocalSearchParams<{ from?: string; company?: string; again?: string; mode?: string }>();
  const from: From = params.from === 'packs' || params.from === 'custom' ? params.from : 'resume';
  const { breakpoint, gutter } = useLayout();
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
  const [mode, setMode] = useState<InterviewFeedbackMode>(params.mode === 'ai' ? 'ai' : 'basic');
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
      let customSet: CustomInterviewSet | undefined;
      if (!pack) {
        const kind = from === 'custom' && claims.length === 0 && !form.company && !form.jobRole ? 'custom' : 'guided';
        const now = new Date().toISOString();
        customSet = {
          id: newId(),
          title,
          questions: filled.map((question) => ({ ...question, question: question.question.trim() })),
          kind,
          ...(kind === 'guided'
            ? {
                guided: {
                  company: form.company.trim(),
                  jobRole: form.jobRole.trim(),
                  claims: claims.filter((claim) => filled.some((question) => question.claimId === claim.id)),
                  generationMode,
                  resumeUsed: filled.some((question) => Boolean(question.sourceQuote)),
                },
              }
            : {}),
          createdAt: now,
          updatedAt: now,
        };
      }
      const session = createSessionRecord(newId(), {
        companyId: pack?.id ?? '',
        ...(customSet
          ? { customSet: { id: customSet.id, title: customSet.title, questions: customSet.questions, kind: customSet.kind, ...(customSet.guided ? { guided: customSet.guided } : {}) } }
          : {}),
        feedbackMode: mode,
        capture: mode === 'ai' && video && canRecordVideo ? 'record' : 'off',
      });
      await putSession(session);
      router.replace({ pathname: '/interview/room/[id]', params: { id: session.id } });
    } catch (reason) {
      setError(t(reason instanceof Error ? reason.message : '연습을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      setStarting(false);
    }
  }

  const header = (
    <AppHeader
      onBack={() => (step === 'mode' && !params.company && !params.again ? setStep('questions') : router.back())}
      subtitle={t(step === 'questions' ? '1 / 2 단계' : '2 / 2 단계')}
      title={t(step === 'questions' ? (from === 'packs' ? '질문 세트' : from === 'custom' ? '질문 만들기' : '자기소개서로 연습') : '연습 방식')}
    />
  );

  const footer = (
    <View style={[styles.footer, { paddingHorizontal: gutter }]}>
      {error ? (
        <AppText accessibilityRole="alert" tone="negative" variant="meta">
          {error}
        </AppText>
      ) : null}
      {step === 'questions' ? (
        from === 'resume' && questions.length === 0 ? (
          <Button variant="primary" fullWidth loading={preparing} onPress={() => void prepareFromResume()} size="large">
            {t('질문 만들기')}
          </Button>
        ) : (
          <Button variant="primary" disabled={expanding} fullWidth onPress={toModeStep} size="large">
            {t('다음')}
          </Button>
        )
      ) : (
        <Button
          disabled={(mode === 'ai' && (Boolean(aiProblem) || demo)) || account.status === 'loading'}
          fullWidth
          leftIcon={mode === 'ai' ? <Sparkles color={colors.textInverse} size={iconSizes.inline} /> : <Mic color={colors.textInverse} size={iconSizes.inline} />}
          loading={starting}
          onPress={() => void start()}
          size="large"
          variant="brand"
        >
          {t(mode === 'ai' ? 'AI 피드백 연습 시작' : '기본 연습 시작')}
        </Button>
      )}
    </View>
  );

  return (
    <Screen padded={false} maxWidth={breakpoint === 'expanded' ? 820 : undefined}>
      {header}
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
        <View style={[styles.content, { paddingHorizontal: gutter }]}>
          {step === 'questions' ? (
            from === 'packs' ? (
              <PackPicker onPick={setPackId} selected={packId} />
            ) : from === 'resume' ? (
              <View style={styles.section}>
                <View style={[styles.fields, breakpoint !== 'compact' ? styles.fieldsRow : null]}>
                  <View style={styles.field}>
                    <AuthField label={t('지원 회사')} maxLength={GUIDED_INPUT_LIMITS.company} onChangeText={(company) => setForm((current) => ({ ...current, company }))} placeholder={t('예: 한빛전자')} value={form.company} />
                  </View>
                  <View style={styles.field}>
                    <AuthField label={t('직무')} maxLength={GUIDED_INPUT_LIMITS.jobRole} onChangeText={(jobRole) => setForm((current) => ({ ...current, jobRole }))} placeholder={t('예: 영업관리')} value={form.jobRole} />
                  </View>
                </View>
                <TextArea
                  label={t('채용 공고 (선택)')}
                  maxLength={GUIDED_INPUT_LIMITS.jobDescription}
                  minHeight={88}
                  onChangeText={(jobDescription) => setForm((current) => ({ ...current, jobDescription }))}
                  value={form.jobDescription}
                />
                <TextArea
                  hint={
                    locale === 'en'
                      ? t('{n}자 / 맞춤 질문은 {min}자 이상', { n: fmtNumber(resumeText.length, 'en'), min: MIN_RESUME_LENGTH })
                      : `${resumeText.length.toLocaleString('ko-KR')}자 / 맞춤 질문은 ${MIN_RESUME_LENGTH}자 이상`
                  }
                  label={t('자기소개서')}
                  maxLength={GUIDED_INPUT_LIMITS.resumeText}
                  minHeight={180}
                  onChangeText={(value) => setForm((current) => ({ ...current, resumeText: value }))}
                  placeholder={t('자기소개서 내용을 붙여 넣어 주세요.')}
                  value={form.resumeText}
                />
                <AppText tone="faint" variant="badge">
                  {t('자기소개서는 저장하지 않아요.')}
                </AppText>
                {questions.length > 0 ? (
                  <View style={styles.section}>
                    <SectionHeader
                      description={t(generationMode === 'ai' ? '자기소개서의 문장에서 만든 질문이에요. 고치거나 지워도 돼요.' : '기본 질문이에요. 고치거나 질문을 더해도 돼요.')}
                      title={t('질문 {n}개', { n: filled.length })}
                    />
                    {notice ? (
                      <Card variant="soft">
                        <AppText variant="meta">{notice}</AppText>
                      </Card>
                    ) : null}
                    <QuestionListEditor disabled={expanding} onAdd={() => setQuestions((current) => [...current, blankQuestion()])} onChange={setQuestions} questions={questions} />
                    {server && resumeReady ? (
                      <Button disabled={expanding} leftIcon={<Sparkles color={colors.text} size={iconSizes.inline} />} loading={expanding} onPress={() => void expandFromResume()} variant="outline">
                        {t('자소서 질문 더 만들기')}
                      </Button>
                    ) : null}
                    {server && resumeReady && allowance ? (
                      <AppText tone="muted" variant="meta">
                        {t('자소서 질문 만들기는 이번 달 {n}회 남았어요. 질문과 꼬리질문을 한 쌍씩 더해요.', {
                          n: Math.max(0, allowance.questions.limit - allowance.questions.used),
                        })}
                      </AppText>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.section}>
                <AuthField label={t('연습 이름 (선택)')} maxLength={60} onChangeText={setCustomTitle} placeholder={t(UNTITLED_SET_TITLE)} value={customTitle} />
                <QuestionListEditor onAdd={() => setQuestions((current) => [...current, blankQuestion()])} onChange={setQuestions} questions={questions} />
              </View>
            )
          ) : (
            <View style={styles.section}>
              <Card variant="soft" style={styles.summary}>
                <AppText variant="itemTitle">{t(title)}</AppText>
                <AppText tone="muted" variant="meta">
                  {t('질문 {count}개 / 최대 {time}', {
                    count: questionCount,
                    time: totalAnswerLabel(
                      pack ? pack.questions.map((question) => ({ answerDurationSec: question.maxDurationMs / 1000 })) : filled,
                      locale,
                    ),
                  })}
                </AppText>
              </Card>
              <SectionHeader title={t('어떻게 연습할까요?')} />
              <View accessibilityRole="radiogroup" style={[styles.modes, breakpoint !== 'compact' ? styles.modesRow : null]}>
                <ModeOption
                  body={t('녹음 없이 타이머로 연습해요.')}
                  onPress={() => setMode('basic')}
                  price={t('무료')}
                  selected={mode === 'basic'}
                  title={t('기본 연습')}
                />
                <ModeOption
                  body={t('답변을 녹음하고 피드백을 받아요.')}
                  onPress={() => setMode('ai')}
                  price={demo ? t('데모에서는 못 써요') : t(aiPriceLabel(allowance, locale))}
                  selected={mode === 'ai'}
                  title={t('AI 피드백 연습')}
                />
              </View>
              {mode === 'ai' ? (
                <Card style={styles.aiNotes}>
                  {demo ? (
                    <AppText tone="muted" variant="meta">
                      {t('데모에는 서버가 없어서 AI 피드백 연습을 할 수 없어요. 기본 연습으로 둘러봐 주세요.')}
                    </AppText>
                  ) : aiProblem ? (
                    <View style={styles.section}>
                      <AppText tone="negative" variant="meta">
                        {t(aiProblem)}
                      </AppText>
                      <Button onPress={() => router.push('/subscription')} variant="outline">
                        {t('요금제 보기')}
                      </Button>
                    </View>
                  ) : (
                    <AppText tone="muted" variant="meta">
                      {t('첫 답변을 시작할 때 한 번으로 세요. 스탠다드는 매달 {n}회예요. 녹음은 이 기기에만 두고, 글로 옮긴 뒤 바로 지워요.', { n: PLAN.aiStandardMonthly })}
                    </AppText>
                  )}
                  {canRecordVideo && !demo ? (
                    <View style={styles.toggle}>
                      <Video {...decorative} color={colors.textSoft} size={iconSizes.inline} />
                      <View style={styles.flex}>
                        <AppText variant="bodyStrong">{t('내 모습도 녹화하기')}</AppText>
                        <AppText tone="muted" variant="meta">
                          {t('이 브라우저에만 저장해요.')}
                        </AppText>
                      </View>
                      <Switch accessibilityLabel={t('내 모습도 녹화하기')} onValueChange={setVideo} thumbColor={colors.surface} trackColor={{ false: colors.borderStrong, true: colors.brand }} value={video} />
                    </View>
                  ) : null}
                </Card>
              ) : null}
              {pack ? (
                <AppText tone="faint" variant="badge">
                  {t(INTERVIEW_DISCLAIMER).replace(/\n/g, ' ')}
                </AppText>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
      {footer}
    </Screen>
  );
}

function ModeOption({ title, body, price, selected, onPress }: { title: string; body: string; price: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`${title}, ${price}. ${body}`}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [styles.mode, hovered && !selected ? styles.modeHover : null, selected ? styles.modeOn : null, pressed ? styles.pressed : null]}
    >
      <View style={styles.modeHead}>
        <AppText variant="heading">{title}</AppText>
        <View {...decorative} style={[styles.radio, selected ? styles.radioOn : null]}>
          {selected ? <Check color={colors.textInverse} size={iconSizes.dense} strokeWidth={3} /> : null}
        </View>
      </View>
      <StatusBadge label={price} tone={selected ? 'brand' : 'neutral'} />
      <AppText tone="muted" variant="body">
        {body}
      </AppText>
    </Pressable>
  );
}

function PackPicker({ selected, onPick }: { selected: string | null; onPick: (id: string) => void }) {
  const t = useT();
  const { breakpoint } = useLayout();
  const grid = breakpoint !== 'compact';
  const groups = useMemo(
    () => [
      { key: 'common', title: '공통 질문', packs: COMMON_PACKS },
      { key: 'company', title: '회사별 질문', packs: COMPANY_PACKS },
    ],
    [],
  );
  const renderPack = (pack: (typeof COMMON_PACKS)[number], index: number, count: number) => {
    const on = selected === pack.id;
    return (
      <Pressable
        accessibilityLabel={`${t(pack.name)}, ${t(pack.audience ?? pack.stage)}, ${t('질문 {n}개', { n: pack.questions.length })}`}
        accessibilityRole="radio"
        accessibilityState={{ selected: on, checked: on }}
        key={pack.id}
        onPress={() => onPick(pack.id)}
        style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
          styles.packRow,
          grid ? styles.packCard : index < count - 1 ? styles.divider : null,
          grid && hovered && !on ? styles.packCardHover : null,
          !grid && hovered && !on ? styles.packHover : null,
          on ? (grid ? styles.packCardOn : styles.packOn) : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={styles.flex}>
          <AppText numberOfLines={1} variant="itemTitle">
            {t(pack.name)}
          </AppText>
          <AppText numberOfLines={2} tone="muted" variant="meta">
            {t('{label} / 질문 {n}개', { label: t(pack.audience ?? pack.stage), n: pack.questions.length })}
          </AppText>
        </View>
        <View {...decorative} style={[styles.radio, on ? styles.radioOn : null]}>
          {on ? <Check color={colors.textInverse} size={iconSizes.dense} strokeWidth={3} /> : null}
        </View>
      </Pressable>
    );
  };
  return (
    <View style={styles.section}>
      {groups.map((group) => (
        <View key={group.key} style={styles.section}>
          <SectionHeader title={t.ctx('pack', group.title)} />
          {grid ? (
            // 태블릿, 데스크톱: 한 줄 목록이 화면을 가로지르지 않게 두 장씩 카드로.
            <View style={styles.packGrid}>
              {Array.from({ length: Math.ceil(group.packs.length / 2) }, (_, row) => (
                <View key={row} style={styles.packGridRow}>
                  {group.packs.slice(row * 2, row * 2 + 2).map((pack, index) => renderPack(pack, index, group.packs.length))}
                  {group.packs.length % 2 === 1 && row === Math.ceil(group.packs.length / 2) - 1 ? <View style={styles.packFiller} /> : null}
                </View>
              ))}
            </View>
          ) : (
            <Card padding={false}>{group.packs.map((pack, index) => renderPack(pack, index, group.packs.length))}</Card>
          )}
        </View>
      ))}
      <AppText tone="faint" variant="badge">
        {t(INTERVIEW_DISCLAIMER).replace(/\n/g, ' ')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  section: { gap: spacing.md },
  fields: { gap: spacing.md },
  fieldsRow: { flexDirection: 'row' },
  field: { flex: 1, minWidth: 0 },
  flex: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingBottom: spacing.gutter,
    paddingTop: spacing.md,
  },
  summary: { gap: spacing.xxs },
  modes: { gap: spacing.md },
  modesRow: { flexDirection: 'row' },
  mode: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.card,
    borderWidth: 1,
    cursor: 'pointer',
    flex: 1,
    gap: spacing.sm,
    padding: spacing.gutter,
  },
  modeOn: { backgroundColor: colors.brandSubtle, borderColor: colors.brand },
  modeHover: { borderColor: colors.textFaint },
  modeHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  aiNotes: { gap: spacing.md },
  toggle: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  pressed: { opacity: 0.7 },
  packRow: { alignItems: 'center', cursor: 'pointer', flexDirection: 'row', gap: spacing.md, minHeight: 68, paddingHorizontal: spacing.gutter, paddingVertical: spacing.md },
  packOn: { backgroundColor: colors.brandSubtle },
  packHover: { backgroundColor: colors.backgroundSoft },
  packGrid: { gap: spacing.md },
  packGridRow: { flexDirection: 'row', gap: spacing.md },
  packCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
  },
  packCardHover: { borderColor: colors.borderStrong },
  packCardOn: { backgroundColor: colors.brandSubtle, borderColor: colors.brand },
  packFiller: { borderColor: colors.transparent, borderWidth: 1, flex: 1, paddingHorizontal: spacing.gutter },
  divider: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  radio: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.full,
    borderWidth: 1.5,
    height: spacing.xl,
    justifyContent: 'center',
    width: spacing.xl,
  },
  radioOn: { backgroundColor: colors.action, borderColor: colors.action },
});
