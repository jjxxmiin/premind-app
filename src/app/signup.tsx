import { router, type Href } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import {
  AppText,
  AuthField,
  AuthForm,
  Button,
  Checkbox,
  IconButton,
  Screen,
  StatusBadge,
} from '@/components/ui';
import { SocialSignInButtons } from '@/components/SocialSignInButtons';
import { AuthSplit, useAuthSplit } from '@/components/account/AuthSplit';
import { ApiError, hasConfiguredApi } from '@/services/api/client';
import { useAppStore } from '@/state/app-store';
import { colors, radii, sizes, spacing } from '@/theme/tokens';
import { peekReturnTo, returnsToInterview } from '@/lib/return-to';
import { useT } from '@/lib/i18n';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TERMS_URL = 'https://premind.co.kr/terms';
const PRIVACY_URL = 'https://premind.co.kr/privacy';
const serverConfigured = hasConfiguredApi();

/**
 * The server's password rule, split into the parts it checks.
 *
 * Shown as it is typed rather than as one sentence after a failed submit: a
 * rule you can watch yourself satisfy is worth more than a rule you are told
 * you broke.
 */
const passwordRules = [
  { id: 'length', label: '8자 이상', test: (value: string) => value.length >= 8 },
  { id: 'letter', label: '영문', test: (value: string) => /[A-Za-z]/.test(value) },
  { id: 'digit', label: '숫자', test: (value: string) => /\d/.test(value) },
] as const;

type FieldName = 'name' | 'email' | 'password' | 'confirm';

/**
 * Sign up. A back-chevron header, one big line, labelled fields, the terms
 * block with a master checkbox, and a single filled CTA that only wakes up
 * once every field is valid and the required terms are agreed.
 */
export default function SignupScreen() {
  const t = useT();
  const split = useAuthSplit();
  const [toInterview] = useState(returnsToInterview);
  const { clearError, error: storeError, register, session } = useAppStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  // 이용약관 제5조, 개인정보처리방침 12: 만 14세 이상만 가입해요(2026-09-26 법무 검토).
  // 간편 가입(카카오, 구글)도 이 확인을 거쳐야 버튼이 켜져요.
  const [agedFourteen, setAgedFourteen] = useState(false);
  // A field's error appears once the user has left it (or tried to submit),
  // never while they are still halfway through typing it.
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [serverError, setServerError] = useState<{
    field?: FieldName;
    message: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (session) {
      router.replace((peekReturnTo() ?? '/(tabs)') as Href);
    }
  }, [session]);

  const errors = useMemo<Partial<Record<FieldName, string>>>(() => {
    const next: Partial<Record<FieldName, string>> = {};
    if (!name.trim()) {
      next.name = '이름을 입력해 주세요.';
    } else if (name.trim().length > 80) {
      next.name = '이름은 80자까지 쓸 수 있어요.';
    }
    if (!email.trim()) {
      next.email = '이메일을 입력해 주세요.';
    } else if (!EMAIL_PATTERN.test(email.trim().toLowerCase())) {
      next.email = '올바른 이메일 주소를 입력해 주세요.';
    }
    if (!passwordRules.every((rule) => rule.test(password))) {
      next.password = '아래 조건을 모두 만족해야 해요.';
    }
    if (!confirm) {
      next.confirm = '비밀번호를 한 번 더 입력해 주세요.';
    } else if (confirm !== password) {
      next.confirm = '비밀번호가 서로 달라요.';
    }
    return next;
  }, [confirm, email, name, password]);

  const agreed = agedFourteen && agreedTerms && agreedPrivacy;
  const formValid = agreed && Object.keys(errors).length === 0;
  const returnToLogin = () => {
    if (busy) return;
    clearError();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  };

  const shownError = (field: FieldName) => {
    const message =
      serverError?.field === field
        ? serverError.message
        : touched[field]
          ? errors[field]
          : undefined;
    return message === undefined ? undefined : t(message);
  };

  const setAllAgreed = (value: boolean) => {
    setAgedFourteen(value);
    setAgreedTerms(value);
    setAgreedPrivacy(value);
    setServerError(null);
    clearError();
  };

  const handleRegister = async () => {
    clearError();
    setTouched({ name: true, email: true, password: true, confirm: true });
    setServerError(null);
    if (!serverConfigured) {
      setServerError({
        message: '이 빌드에서는 가입할 수 없어요. EXPO_PUBLIC_API_URL이 설정된 빌드를 사용해 주세요.',
      });
      return;
    }
    const firstInvalid = (['name', 'email', 'password', 'confirm'] as const).find(
      (field) => errors[field],
    );
    if (firstInvalid) {
      const input = {
        name: nameInputRef,
        email: emailInputRef,
        password: passwordInputRef,
        confirm: confirmInputRef,
      }[firstInvalid];
      input?.current?.focus();
      return;
    }
    if (!agreed) {
      setServerError({ message: '필수 항목에 동의해 주세요.' });
      return;
    }

    Keyboard.dismiss();
    setBusy(true);
    try {
      await register(email.trim().toLowerCase(), name.trim(), password);
    } catch (error) {
      // A taken email is a fact about one field, so it is shown on that field
      // rather than as a banner the reader has to map back to an input.
      if (error instanceof ApiError && error.status === 409) {
        setServerError({ field: 'email', message: error.message });
        emailInputRef.current?.focus();
      } else if (error instanceof ApiError && error.status === 422) {
        setServerError({ field: 'password', message: error.message });
      } else {
        setServerError({
          message:
            error instanceof Error && error.message
              ? error.message
              : '가입하지 못했어요. 잠시 후 다시 시도해 주세요.',
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const formError = serverError?.field ? null : (serverError?.message ?? storeError);

  return (
    <Screen
      contentStyle={split ? null : styles.screenContent}
      fullBleed={split}
      maxWidth={480}
      padded={false}
      safeAreaEdges={['top', 'right', 'bottom', 'left']}
      scroll
      scrollViewProps={{ contentInsetAdjustmentBehavior: 'automatic' }}
    >
      <AuthSplit topic={toInterview ? 'interview' : 'study'}>
        <AppHeader onBack={returnToLogin} title={t('회원가입')} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'web' ? undefined : 'padding'}
          style={styles.keyboardArea}
        >
          <View style={[styles.container, split ? styles.containerSplit : null]}>
            <AppText accessibilityRole="header" variant="heroTitle">
              {t('가입 정보를\n입력해 주세요')}
            </AppText>

            <AuthForm
              accessibilityLabel={t('PREMIND 회원가입')}
              onSubmit={() => void handleRegister()}
              style={styles.formFlow}
            >
              <View style={styles.fields}>
                <AuthField
                  autoComplete="name"
                  editable={!busy}
                  error={shownError('name')}
                  inputRef={nameInputRef}
                  label={t('이름')}
                  onBlur={() => setTouched((state) => ({ ...state, name: true }))}
                  onChangeText={(value) => {
                    setName(value);
                    setServerError(null);
                    clearError();
                  }}
                  onSubmitEditing={() => emailInputRef.current?.focus()}
                  placeholder={t('이름을 입력해 주세요')}
                  returnKeyType="next"
                  textContentType="name"
                  value={name}
                />

                <AuthField
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  editable={!busy}
                  error={shownError('email')}
                  inputRef={emailInputRef}
                  keyboardType="email-address"
                  label={t('이메일')}
                  onBlur={() => setTouched((state) => ({ ...state, email: true }))}
                  onChangeText={(value) => {
                    setEmail(value);
                    setServerError(null);
                    clearError();
                  }}
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  placeholder="name@example.com"
                  returnKeyType="next"
                  textContentType="emailAddress"
                  value={email}
                />

                <View style={styles.passwordGroup}>
                  <AuthField
                    autoCapitalize="none"
                    autoComplete="new-password"
                    editable={!busy}
                    error={shownError('password')}
                    inputRef={passwordInputRef}
                    label={t('비밀번호')}
                    onBlur={() => setTouched((state) => ({ ...state, password: true }))}
                    onChangeText={(value) => {
                      setPassword(value);
                      setServerError(null);
                      clearError();
                    }}
                    onSubmitEditing={() => confirmInputRef.current?.focus()}
                    placeholder={t('비밀번호를 입력해 주세요')}
                    returnKeyType="next"
                    secureTextEntry={!passwordVisible}
                    textContentType="newPassword"
                    trailing={
                      <IconButton
                        disabled={busy}
                        icon={passwordVisible ? EyeOff : Eye}
                        label={t(passwordVisible ? '비밀번호 숨기기' : '비밀번호 표시')}
                        onPress={() => setPasswordVisible((visible) => !visible)}
                      />
                    }
                    value={password}
                  />

                  <View style={styles.rules}>
                    {passwordRules.map((rule) => (
                      <StatusBadge
                        key={rule.id}
                        label={t.ctx('password', rule.label)}
                        tone={rule.test(password) ? 'positive' : 'neutral'}
                      />
                    ))}
                  </View>
                </View>

                <AuthField
                  autoCapitalize="none"
                  autoComplete="new-password"
                  editable={!busy}
                  error={shownError('confirm')}
                  inputRef={confirmInputRef}
                  label={t('비밀번호 확인')}
                  onBlur={() => setTouched((state) => ({ ...state, confirm: true }))}
                  onChangeText={(value) => {
                    setConfirm(value);
                    setServerError(null);
                    clearError();
                  }}
                  onSubmitEditing={
                    Platform.OS === 'web' ? undefined : () => void handleRegister()
                  }
                  placeholder={t('한 번 더 입력해 주세요')}
                  returnKeyType="done"
                  secureTextEntry={!passwordVisible}
                  textContentType="newPassword"
                  value={confirm}
                />
              </View>

              <View
                accessibilityElementsHidden={busy}
                importantForAccessibility={busy ? 'no-hide-descendants' : 'auto'}
                pointerEvents={busy ? 'none' : 'auto'}
                style={busy ? styles.dimmed : null}
              >
                <SocialSignInButtons
                  disabled={!agreed || busy}
                  onBusyChange={setBusy}
                  onError={(message) => setServerError({ message })}
                />
              </View>

              <View style={styles.terms}>
                <Checkbox
                  checked={agreed}
                  disabled={busy}
                  label={t('모두 동의해요')}
                  onChange={setAllAgreed}
                />
                <View style={styles.hairline} />
                <Checkbox
                  checked={agedFourteen}
                  compact
                  disabled={busy}
                  label={t('[필수] 만 14세 이상이에요')}
                  onChange={(value) => {
                    setAgedFourteen(value);
                    setServerError(null);
                    clearError();
                  }}
                />
                <Checkbox
                  checked={agreedTerms}
                  compact
                  disabled={busy}
                  label={t('[필수] 이용약관')}
                  onChange={(value) => {
                    setAgreedTerms(value);
                    setServerError(null);
                    clearError();
                  }}
                  trailing={
                    <TermsLink
                      disabled={busy}
                      label={t('이용약관 보기')}
                      onPress={() => void Linking.openURL(TERMS_URL).catch(() => undefined)}
                    />
                  }
                />
                <Checkbox
                  checked={agreedPrivacy}
                  compact
                  disabled={busy}
                  label={t('[필수] 개인정보 처리방침')}
                  onChange={(value) => {
                    setAgreedPrivacy(value);
                    setServerError(null);
                    clearError();
                  }}
                  trailing={
                    <TermsLink
                      disabled={busy}
                      label={t('개인정보 처리방침 보기')}
                      onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => undefined)}
                    />
                  }
                />
              </View>

              {formError ? (
                <View
                  accessibilityLiveRegion="assertive"
                  accessibilityRole="alert"
                  style={styles.errorBox}
                >
                  <AppText tone="negative" variant="meta">
                    {t(formError)}
                  </AppText>
                </View>
              ) : null}

              <Button
                disabled={busy || !formValid}
                fullWidth
                loading={busy}
                onPress={() => void handleRegister()}
                size="large"
                variant="primary"
              >
                {t('가입 완료')}
              </Button>

              <View style={styles.loginRow}>
                <AppText tone="muted" variant="meta">
                  {t('이미 계정이 있나요?')}
                </AppText>
                <Button
                  disabled={busy}
                  onPress={returnToLogin}
                  size="small"
                  variant="ghost"
                >
                  {t('로그인')}
                </Button>
              </View>
            </AuthForm>
          </View>
        </KeyboardAvoidingView>
      </AuthSplit>
    </Screen>
  );
}

/** The quiet "보기" link at the end of a terms row. */
function TermsLink({
  disabled = false,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const t = useT();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="link"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.link,
        hovered && !disabled ? styles.linkHovered : null,
        pressed ? styles.linkPressed : null,
      ]}
    >
      <AppText style={styles.linkText} tone="muted" variant="meta">
        {t.ctx('terms', '보기')}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: spacing.xxl,
  },
  keyboardArea: {
    flexGrow: 1,
  },
  container: {
    gap: spacing.xl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  containerSplit: {
    paddingHorizontal: 0,
  },
  formFlow: {
    gap: spacing.xl,
  },
  fields: {
    gap: spacing.gutter,
  },
  passwordGroup: {
    gap: spacing.sm,
  },
  rules: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dimmed: {
    opacity: 0.45,
  },
  terms: {
    gap: spacing.xxs,
  },
  hairline: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
  },
  link: {
    borderRadius: radii.badge,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: spacing.xs,
  },
  linkHovered: {
    backgroundColor: colors.backgroundSoft,
  },
  linkPressed: {
    opacity: 0.6,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  errorBox: {
    backgroundColor: colors.negativeSoft,
    borderRadius: radii.alert,
    padding: spacing.md,
  },
  loginRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: sizes.minimumTouchTarget,
  },
});
