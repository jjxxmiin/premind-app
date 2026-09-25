import { router, type Href } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {
  AppText,
  AnimatedReveal,
  AuthField,
  AuthForm,
  Button,
  IconButton,
  Screen,
  Wordmark,
} from '@/components/ui';
import { SocialSignInButtons } from '@/components/SocialSignInButtons';
import { shouldOfferDemo } from '@/lib/demo-entry';
import { hasConfiguredApi } from '@/services/api/client';
import { useAppStore } from '@/state/app-store';
import { colors, radii, sizes, spacing } from '@/theme/tokens';
import { peekReturnTo, returnsToInterview } from '@/lib/return-to';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const serverConfigured = hasConfiguredApi();
const demoOffered = shouldOfferDemo({
  development: __DEV__,
  serverConfigured,
});

/**
 * Sign in. The page is one column: wordmark, a two-line promise, the
 * provider buttons that are actually configured, then email and password
 * and a single filled CTA. The demo entry sits below a divider so it never
 * competes with the real thing.
 */
export default function LoginScreen() {
  const { clearError, error, login, loginForDevelopment, session } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    'login' | 'demo' | 'social' | null
  >(null);
  const passwordInputRef = useRef<TextInput>(null);
  // Sent here from the interview landing: say where sign-in leads.
  const [toInterview] = useState(returnsToInterview);

  useEffect(() => {
    if (session) {
      router.replace((peekReturnTo() ?? '/(tabs)') as Href);
    }
  }, [session]);

  const handleLogin = async () => {
    clearError();
    if (!serverConfigured) {
      setFormError(
        '이 빌드에서는 로그인할 수 없어요. 데모로 둘러보거나 EXPO_PUBLIC_API_URL을 설정해 주세요.',
      );
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setFormError('올바른 이메일 주소를 입력해 주세요.');
      return;
    }
    if (!password) {
      setFormError('비밀번호를 입력해 주세요.');
      return;
    }

    Keyboard.dismiss();
    setFormError(null);
    setBusyAction('login');
    try {
      await login(normalizedEmail, password);
    } catch {
      // The store exposes a normalized, user-facing error message.
    } finally {
      setBusyAction(null);
    }
  };

  const handleDemoLogin = async () => {
    Keyboard.dismiss();
    clearError();
    setFormError(null);
    setBusyAction('demo');
    try {
      await loginForDevelopment();
    } catch {
      setFormError('데모를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusyAction(null);
    }
  };

  const displayedError = formError ?? error;
  const isBusy = busyAction !== null;
  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <Screen
      contentStyle={styles.screenContent}
      safeAreaEdges={['top', 'right', 'bottom', 'left']}
      scroll
      scrollViewProps={{ contentInsetAdjustmentBehavior: 'automatic' }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
        style={styles.keyboardArea}
      >
        <View style={styles.container}>
          <AnimatedReveal delay={20} style={styles.brand}>
            <Wordmark width={112} />
            <View style={styles.headline}>
              {toInterview ? (
                <>
                  <AppText align="center" variant="heroTitle">
                    면접 연습을{'\n'}이어서 시작해요
                  </AppText>
                  <AppText align="center" tone="muted" variant="body">
                    PREMIND 계정으로 로그인하면 면접 연습으로 바로 가요
                  </AppText>
                </>
              ) : (
                <>
                  <AppText align="center" variant="heroTitle">
                    강의를 담기만 하면{'\n'}복습이 준비돼요
                  </AppText>
                  <AppText align="center" tone="muted" variant="body">
                    녹음 한 번으로 대본, 요약, 마인드맵, 문제까지
                  </AppText>
                </>
              )}
            </View>
          </AnimatedReveal>

          <AnimatedReveal delay={80} style={styles.block}>
            <View
              accessibilityElementsHidden={isBusy}
              importantForAccessibility={isBusy ? 'no-hide-descendants' : 'auto'}
              pointerEvents={isBusy ? 'none' : 'auto'}
              style={isBusy ? styles.dimmed : null}
            >
              <SocialSignInButtons
                onBusyChange={(busy) => setBusyAction(busy ? 'social' : null)}
                onError={setFormError}
              />
            </View>

            <AuthForm accessibilityLabel="PREMIND 로그인" onSubmit={() => void handleLogin()}>
              <View style={styles.form}>
                {displayedError ? (
                  <View
                    accessibilityLiveRegion="polite"
                    accessibilityRole="alert"
                    style={styles.errorBox}
                  >
                    <AppText tone="negative" variant="meta">
                      {displayedError}
                    </AppText>
                  </View>
                ) : null}

                <AuthField
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isBusy}
                  keyboardType="email-address"
                  label="이메일"
                  onChangeText={(value) => {
                    setEmail(value);
                    setFormError(null);
                    clearError();
                  }}
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  placeholder="이메일을 입력해 주세요"
                  returnKeyType="next"
                  textContentType="emailAddress"
                  value={email}
                />

                <AuthField
                  autoCapitalize="none"
                  autoComplete="current-password"
                  editable={!isBusy}
                  inputRef={passwordInputRef}
                  label="비밀번호"
                  onChangeText={(value) => {
                    setPassword(value);
                    setFormError(null);
                    clearError();
                  }}
                  onSubmitEditing={
                    Platform.OS === 'web' ? undefined : () => void handleLogin()
                  }
                  placeholder="비밀번호를 입력해 주세요"
                  returnKeyType="done"
                  secureTextEntry={!passwordVisible}
                  textContentType="password"
                  trailing={
                    <IconButton
                      disabled={isBusy}
                      icon={passwordVisible ? EyeOff : Eye}
                      label={passwordVisible ? '비밀번호 숨기기' : '비밀번호 표시'}
                      onPress={() => setPasswordVisible((visible) => !visible)}
                    />
                  }
                  value={password}
                />

                <Button
                  disabled={isBusy || (!canSubmit && serverConfigured)}
                  fullWidth
                  loading={busyAction === 'login'}
                  onPress={() => void handleLogin()}
                  size="large"
                  style={styles.submit}
                  variant="primary"
                >
                  로그인
                </Button>
              </View>
            </AuthForm>

            <View style={styles.links}>
              <TextLink
                disabled={isBusy}
                label="회원가입"
                onPress={() => {
                  clearError();
                  router.push('/signup');
                }}
              />
              <View style={styles.linkDivider} />
              <TextLink
                disabled
                label="비밀번호 찾기"
                onPress={() => undefined}
              />
            </View>
          </AnimatedReveal>

          {demoOffered ? (
            <AnimatedReveal delay={140} style={styles.block}>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <AppText tone="faint" variant="badge">
                  또는
                </AppText>
                <View style={styles.dividerLine} />
              </View>

              <Button
                disabled={isBusy && busyAction !== 'demo'}
                fullWidth
                loading={busyAction === 'demo'}
                onPress={() => void handleDemoLogin()}
                size="large"
                variant="secondary"
              >
                데모로 둘러보기
              </Button>
              <AppText align="center" tone="faint" variant="badge">
                {serverConfigured
                  ? '예시 자료로 먼저 둘러볼 수 있어요'
                  : '이 빌드에서는 데모로만 둘러볼 수 있어요'}
              </AppText>
            </AnimatedReveal>
          ) : null}

          <AppText align="center" style={styles.legal} tone="faint" variant="badge">
            로그인하면 PREMIND 이용약관과 개인정보 처리방침에 동의한 것으로 봐요
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function TextLink({
  disabled = false,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed ? styles.linkPressed : null]}
    >
      <AppText tone={disabled ? 'faint' : 'soft'} variant="meta">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xl,
  },
  keyboardArea: {
    flexGrow: 1,
  },
  container: {
    alignSelf: 'center',
    gap: spacing.xxl,
    maxWidth: 420,
    width: '100%',
  },
  brand: {
    alignItems: 'center',
    gap: spacing.xl,
    paddingTop: spacing.lg,
  },
  headline: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  block: {
    alignSelf: 'stretch',
    gap: spacing.gutter,
  },
  dimmed: {
    opacity: 0.45,
  },
  form: {
    gap: spacing.gutter,
  },
  submit: {
    marginTop: spacing.xs,
  },
  errorBox: {
    backgroundColor: colors.negativeSoft,
    borderRadius: radii.alert,
    padding: spacing.md,
  },
  links: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: sizes.minimumTouchTarget,
  },
  link: {
    minHeight: 32,
    justifyContent: 'center',
  },
  linkPressed: {
    opacity: 0.6,
  },
  linkDivider: {
    backgroundColor: colors.borderStrong,
    height: spacing.md,
    width: 1,
  },
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  dividerLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  legal: {
    paddingHorizontal: spacing.lg,
  },
});
