import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppText, AuthField, Button, Card, Dialog, Screen, SettingsRow, Toast, useToast } from '@/components/ui';
import { loginConnections } from '@/features/auth/login-connections';
import { SocialSignInCancelled, useAvailableProviders, useGoogleIdentity, useKakaoIdentity } from '@/features/auth/use-social-sign-in';
import { useT } from '@/lib/i18n';
import { goBackOrReplace } from '@/lib/navigation';
import type { LoginConnection, LoginMethod } from '@/services/api/client';
import { isDemoSession } from '@/services/api/session-manager';
import { useAppStore } from '@/state/app-store';
import { spacing } from '@/theme/tokens';

const names = { email: '이메일', google: 'Google', kakao: '카카오' };

export default function LoginAccountsScreen() {
  const t = useT();
  const { session } = useAppStore();
  const userId = session?.user.id ?? '';
  const demo = isDemoSession(session);
  const providers = useAvailableProviders();
  const [loaded, setLoaded] = useState<{ userId: string; methods: LoginConnection[] } | null>(null);
  const methods = loaded?.userId === userId ? loaded.methods : null;
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<LoginMethod | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const { message, show } = useToast();

  const load = useCallback(() => {
    if (!userId || demo) return Promise.resolve();
    return loginConnections.list(userId).then((next) => {
      setLoaded({ userId, methods: next });
      setError(null);
    }).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : '연결 상태를 불러오지 못했어요.');
    });
  }, [demo, userId]);
  useEffect(() => { void load(); }, [load]);

  const run = async (operation: () => Promise<LoginConnection[]>, success: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      setLoaded({ userId, methods: await operation() });
      setConfirm(null);
      setEmailOpen(false);
      setPassword(''); setPasswordAgain('');
      show(t(success));
    } catch (caught) {
      if (!(caught instanceof SocialSignInCancelled)) setError(caught instanceof Error ? caught.message : '연결 상태를 변경하지 못했어요.');
    } finally { inFlight.current = false; setBusy(false); }
  };

  return (
    <Screen scroll maxWidth={680}>
      <AppHeader title={t('로그인 계정 관리')} onBack={() => goBackOrReplace('/(tabs)/profile')} />
      <View style={styles.content}>
        <AppText tone="muted">{t('연결한 방법으로 같은 계정에 로그인해요. 강의, 노트, 구독은 그대로 유지돼요.')}</AppText>
        {demo ? <AppText>{t('실제 계정으로 로그인한 뒤 사용할 수 있어요.')}</AppText> : null}
        {!methods && !error && !demo ? <AppText>{t('연결 상태를 불러오고 있어요.')}</AppText> : null}
        {methods?.map((method) => {
          const rowProps = { method, disabled: busy,
            unlink: () => setConfirm(method.provider) };
          if (!method.connected && method.provider === 'google' && providers.includes('google')) {
            return <GoogleConnection key="google" {...rowProps} connect={(authenticate) => void run(async () => {
              const credential = await authenticate();
              if (!credential) throw new SocialSignInCancelled();
              return loginConnections.link(userId, 'google', credential);
            }, '로그인 계정을 연결했어요.')} />;
          }
          if (!method.connected && method.provider === 'kakao' && providers.includes('kakao')) {
            return <KakaoConnection key="kakao" {...rowProps} connect={(authenticate) => void run(async () => {
              const credential = await authenticate();
              return loginConnections.link(userId, 'kakao', credential.code, credential);
            }, '로그인 계정을 연결했어요.')} />;
          }
          return <ConnectionRow key={method.provider} {...rowProps}
            connect={method.provider === 'email' ? () => { setError(null); setEmailOpen(true); } : undefined} />;
        })}
        <AppText tone="muted" variant="meta">{t('로그인 수단은 최소 하나 남겨야 해요. 다른 회원 계정에 연결된 소셜 계정은 연결할 수 없어요.')}</AppText>
        {error ? <AppText accessibilityRole="alert" tone="negative">{t(error)}</AppText> : null}
        {!methods && error ? <Button onPress={() => void load()}>{t('다시 시도')}</Button> : null}
      </View>
      <Dialog visible={confirm !== null} title={t('연결을 해제할까요?')}
        description={t('이 방법으로는 로그인할 수 없게 돼요. 자료와 구독은 삭제되지 않아요.')}
        onRequestClose={() => { if (!busy) setConfirm(null); }}
        cancel={{ label: t('취소'), disabled: busy, onPress: () => setConfirm(null) }}
        confirm={{ label: t('연결 해제'), loading: busy, onPress: () => {
          if (confirm) void run(() => loginConnections.unlink(userId, confirm), '로그인 계정 연결을 해제했어요.');
        } }}>
        {confirm ? <AppText>{t(names[confirm])}</AppText> : null}
        {error ? <AppText accessibilityRole="alert" tone="negative">{t(error)}</AppText> : null}
      </Dialog>
      <Dialog visible={emailOpen} title={t('이메일 로그인 연결')} description={session?.user.email}
        onRequestClose={() => { if (!busy) { setEmailOpen(false); setPassword(''); setPasswordAgain(''); } }}
        cancel={{ label: t('취소'), disabled: busy, onPress: () => { setEmailOpen(false); setPassword(''); setPasswordAgain(''); } }}
        confirm={{ label: t('연결하기'), loading: busy,
          disabled: !/^(?=.*[A-Za-z])(?=.*\d).{8,256}$/.test(password) || password !== passwordAgain,
          onPress: () => void run(() => loginConnections.addEmail(userId, password), '로그인 계정을 연결했어요.') }}>
        <View style={styles.fields}>
          <AuthField label={t('새 비밀번호')} hint={t('영문과 숫자를 포함해 8자 이상 입력해 주세요.')} secureTextEntry
            autoCapitalize="none" autoComplete="new-password" editable={!busy} value={password} onChangeText={setPassword} />
          <AuthField label={t('비밀번호 확인')} secureTextEntry autoCapitalize="none" autoComplete="new-password"
            editable={!busy} value={passwordAgain} onChangeText={setPasswordAgain} />
          {error ? <AppText accessibilityRole="alert" tone="negative">{t(error)}</AppText> : null}
        </View>
      </Dialog>
      <Toast message={message} />
    </Screen>
  );
}

interface RowProps { method: LoginConnection; disabled: boolean; unlink: () => void; connect?: () => void }
function ConnectionRow({ method, disabled, unlink, connect }: RowProps) {
  const t = useT();
  return <Card>
    <SettingsRow title={t(names[method.provider])} value={t(method.connected ? '연결됨' : '연결 안 됨')} description={method.email ?? undefined} />
    {method.connected ? <Button disabled={disabled || !method.canUnlink} onPress={unlink}
      accessibilityLabel={`${t(names[method.provider])} ${t('연결 해제')}`}>{t('연결 해제')}</Button>
      : connect ? <Button disabled={disabled} onPress={connect}
        accessibilityLabel={`${t(names[method.provider])} ${t('연결하기')}`}>{t('연결하기')}</Button>
        : <AppText tone="muted" variant="meta">{t('이 환경에서는 연결을 지원하지 않아요.')}</AppText>}
    {method.connected && !method.canUnlink ? <AppText tone="muted" variant="meta">{t('유일한 로그인 수단이에요. 다른 방법을 먼저 연결해 주세요.')}</AppText> : null}
  </Card>;
}
function GoogleConnection({ connect, ...props }: Omit<RowProps, 'connect'> & { connect: (authenticate: ReturnType<typeof useGoogleIdentity>) => void }) {
  const authenticate = useGoogleIdentity();
  return <ConnectionRow {...props} connect={() => connect(authenticate)} />;
}
function KakaoConnection({ connect, ...props }: Omit<RowProps, 'connect'> & { connect: (authenticate: ReturnType<typeof useKakaoIdentity>) => void }) {
  const authenticate = useKakaoIdentity();
  return <ConnectionRow {...props} connect={() => connect(authenticate)} />;
}
const styles = StyleSheet.create({ content: { gap: spacing.lg, paddingVertical: spacing.lg }, fields: { gap: spacing.md } });
