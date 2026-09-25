import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Building2, Ticket } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppText, AuthField, Button, Card, Checkbox, Screen } from '@/components/ui';
import { hasConfiguredApi } from '@/services/api/client';
import { isDemoSession } from '@/services/api/session-manager';
import { joinOrg, lookupInvite, type InviteInfo } from '@/features/interview/interview-api';
import { rememberPendingJoinCode } from '@/features/interview/pending-join';
import { refreshInterviewAccount, useInterviewAccount } from '@/features/interview/use-interview-account';
import { decorative } from '@/lib/a11y';
import { useLayout } from '@/lib/layout';
import { useAppStore } from '@/state/app-store';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

function seatCopy(invite: InviteInfo): string {
  if (!invite.licenseUntil || invite.licenseUntil <= Date.now()) return '기관의 참여 현황에 함께 기록돼요.';
  const until = new Date(invite.licenseUntil);
  return `${until.getFullYear()}년 ${until.getMonth() + 1}월 ${until.getDate()}일까지 스탠다드로 연습할 수 있어요(AI 피드백 연습 매달 10회).`;
}

/**
 * 기관(대학 센터, 고등학교)이 나눠 준 초대 코드로 참여한다. 수동 승인 없음.
 * 로그인 전에도 코드를 확인할 수 있고, 참여는 로그인한 계정으로 한다(join-form.tsx).
 */
export default function InterviewJoinScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { session } = useAppStore();
  const account = useInterviewAccount();
  const { gutter } = useLayout();
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [age14, setAge14] = useState(false);
  const [consent, setConsent] = useState(false);
  const [joining, setJoining] = useState(false);
  const checkedInitial = useRef(false);
  const signedIn = Boolean(session);
  const demo = !hasConfiguredApi() || isDemoSession(session);

  async function check(value: string) {
    const next = value.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,12}$/.test(next)) {
      setError('초대 코드는 영문과 숫자 6~12자예요.');
      return;
    }
    if (demo) {
      setError('데모에서는 초대 코드를 확인할 수 없어요. PREMIND 계정으로 로그인해 주세요.');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      setInvite(await lookupInvite(next));
      setCode(next);
    } catch (reason) {
      setInvite(null);
      setError(reason instanceof Error && reason.message ? reason.message : '초대 코드를 확인하지 못했어요.');
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (checkedInitial.current || !params.code) return;
    checkedInitial.current = true;
    void check(params.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  async function join() {
    if (joining || !invite) return;
    if (!age14 || !consent) {
      setError('필수 항목에 동의해 주세요.');
      return;
    }
    setJoining(true);
    setError(null);
    try {
      await joinOrg(code);
      await refreshInterviewAccount();
      router.replace('/interview');
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : '참여하지 못했어요.');
    } finally {
      setJoining(false);
    }
  }

  const name = account.status === 'ready' ? account.user.displayName : session?.user.name ?? '';

  return (
    <Screen maxWidth={520} padded={false}>
      <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace(signedIn ? '/interview' : '/login'))} title="초대 코드" />
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
        <View style={[styles.content, { paddingHorizontal: gutter }]}>
          {!invite ? (
            <>
              <View style={styles.heading}>
                <AppText variant="pageTitle">초대 코드를 입력해 주세요.</AppText>
                <AppText tone="muted" variant="body">
                  학교나 취업센터에서 받은 코드로 참여하고 연습할 수 있어요.
                </AppText>
              </View>
              <AuthField
                autoCapitalize="characters"
                autoCorrect={false}
                error={error}
                label="초대 코드"
                maxLength={12}
                onChangeText={(value) => setCode(value.toUpperCase())}
                onSubmitEditing={() => void check(code)}
                placeholder="예: AB12CD34"
                trailing={<Ticket {...decorative} color={colors.textFaint} size={iconSizes.inline} />}
                value={code}
              />
              <Button variant="primary" fullWidth loading={checking} onPress={() => void check(code)} rightIcon={<ArrowRight color={colors.textInverse} size={iconSizes.inline} />} size="large">
                코드 확인하기
              </Button>
              <AppText tone="muted" variant="meta">
                코드가 없다면 담당 선생님이나 센터에 문의해 주세요. 개인으로도 바로 연습할 수 있어요.
              </AppText>
            </>
          ) : (
            <>
              <View style={styles.org}>
                <Building2 {...decorative} color={colors.brandText} size={iconSizes.inline} />
                <AppText style={styles.flex} tone="brand" variant="bodyStrong">{`${invite.orgName} / ${invite.groupName}`}</AppText>
              </View>
              {!signedIn ? (
                <>
                  <AppText variant="pageTitle">먼저 로그인해 주세요.</AppText>
                  <AppText tone="muted" variant="body">{`PREMIND 계정으로 로그인하거나 가입한 뒤, 이 화면으로 돌아와 참여해 주세요. ${seatCopy(invite)}`}</AppText>
                  <Button variant="primary"
                    fullWidth
                    onPress={() => {
                      void rememberPendingJoinCode(code).then(() => router.replace('/login'));
                    }}
                    size="large"
                  >
                    로그인하고 참여하기
                  </Button>
                </>
              ) : (
                <>
                  <AppText variant="pageTitle">{`${name}님, 참여할까요?`}</AppText>
                  <AppText tone="muted" variant="body">{`참여하면 ${seatCopy(invite)} 계정: ${session?.user.email ?? ''}`}</AppText>
                  <Card style={styles.consents}>
                    <Checkbox checked={age14} label="만 14세 이상이에요." onChange={setAge14} />
                    <Checkbox
                      checked={consent}
                      label={`[필수] 참여 현황(이름, 계정 이메일, 소속 그룹, 참여일, 연습 횟수, 마지막 활동일)을 ${invite.orgName} 담당자에게 제공하는 데 동의해요. 제공 목적은 취업 지원 프로그램 운영이며 계정 삭제 시까지 제공돼요. 답변 내용, 녹음, 자기소개서는 제공되지 않아요. 동의하지 않으면 기관에 참여할 수 없고, 개인으로는 계속 이용할 수 있어요.`}
                      onChange={setConsent}
                    />
                  </Card>
                  {error ? (
                    <AppText accessibilityRole="alert" tone="negative" variant="meta">
                      {error}
                    </AppText>
                  ) : null}
                  <Button variant="primary" disabled={!age14 || !consent} fullWidth loading={joining} onPress={() => void join()} size="large">
                    참여하고 시작하기
                  </Button>
                </>
              )}
              <Button
                onPress={() => {
                  setInvite(null);
                  setError(null);
                }}
                variant="ghost"
              >
                다른 코드 입력하기
              </Button>
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  heading: { gap: spacing.xs },
  org: { alignItems: 'center', backgroundColor: colors.brandSubtle, borderRadius: radii.tile, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  consents: { gap: spacing.md },
});
