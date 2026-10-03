import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import {
  SocialSignInCancelled,
  useAvailableProviders,
  useGoogleSignIn,
  useKakaoSignIn,
} from '@/features/auth/use-social-sign-in';
import type { AuthProvider } from '@/services/api/client';
import { decorative } from '@/lib/a11y';
import { useT } from '@/lib/i18n';
import { colors, radii, spacing } from '@/theme/tokens';

/** Vector paths supplied by Google's HTML sign-in button configurator. */
function GoogleSymbol() {
  return (
    <Svg {...decorative} height={18} width={18} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

/** Unmodified symbol path from Kakao's official login-complete-ko.svg. */
function KakaoSymbol() {
  return (
    <Svg {...decorative} height={18} width={18} viewBox="61.5225 16.5225 12.9555 12.9555">
      <Path
        fill="#000000"
        d="M68.001 16.5225C64.4222 16.5225 61.5225 19.0037 61.5225 22.0641C61.5225 24.0312 62.7219 25.7596 64.5292 26.7423L63.9181 29.2113C63.8954 29.285 63.9132 29.364 63.9619 29.4184C63.9975 29.457 64.0461 29.478 64.0931 29.478C64.1337 29.478 64.1742 29.464 64.2082 29.4341L66.834 27.5144C67.2117 27.5723 67.6007 27.6039 67.9994 27.6039C71.5767 27.6039 74.478 25.1226 74.478 22.0623C74.478 19.002 71.5783 16.5225 68.001 16.5225Z"
      />
    </Svg>
  );
}

const presentation: Record<AuthProvider, { label: string; background: string; border: string; text: string }> = {
  kakao: {
    label: '카카오 로그인',
    background: '#FEE500',
    border: '#FEE500',
    text: 'rgba(0, 0, 0, 0.85)',
  },
  google: {
    label: '구글 로그인',
    background: colors.surface,
    border: colors.borderStrong,
    text: colors.text,
  },
};

export interface SocialSignInButtonsProps {
  disabled?: boolean;
  onError: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
}

/**
 * Renders nothing unless a provider can actually complete a sign-in — this
 * build has its key and the server it talks to has one too. A social button
 * that fails on press is worse than no button.
 *
 * Kakao is listed first: this is a Korean product, and it is the account most
 * of its users already have.
 *
 * Both providers use the shared Button, native labels and vector marks.
 */
export function SocialSignInButtons({
  disabled = false,
  onBusyChange,
  onError,
}: SocialSignInButtonsProps) {
  const t = useT();
  const available = useAvailableProviders();
  if (available.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <AppText tone="faint" variant="badge">
          {t('간편 로그인')}
        </AppText>
        <View style={styles.line} />
      </View>

      {disabled ? (
        <AppText align="center" tone="muted" variant="meta">
          {t('필수 항목에 동의하면 간편 가입을 사용할 수 있어요.')}
        </AppText>
      ) : null}

      {available.includes('kakao') ? (
        <KakaoButton disabled={disabled} onBusyChange={onBusyChange} onError={onError} />
      ) : null}
      {available.includes('google') ? (
        <GoogleButton disabled={disabled} onBusyChange={onBusyChange} onError={onError} />
      ) : null}
    </View>
  );
}

/**
 * One button per provider, each owning its own flow hook.
 *
 * Split by component rather than by branch inside one hook because
 * `Google.useAuthRequest` throws when its platform's client id is missing — it
 * has to not be called at all, and a hook cannot be called conditionally.
 */
function GoogleButton({ disabled, onBusyChange, onError }: SocialSignInButtonsProps) {
  const signIn = useGoogleSignIn();
  return (
    <ProviderButton
      disabled={disabled}
      onBusyChange={onBusyChange}
      onError={onError}
      provider="google"
      signIn={signIn}
    />
  );
}

function KakaoButton({ disabled, onBusyChange, onError }: SocialSignInButtonsProps) {
  const signIn = useKakaoSignIn();
  return (
    <ProviderButton
      disabled={disabled}
      onBusyChange={onBusyChange}
      onError={onError}
      provider="kakao"
      signIn={signIn}
    />
  );
}

function ProviderButton({
  disabled = false,
  onBusyChange,
  onError,
  provider,
  signIn,
}: SocialSignInButtonsProps & {
  provider: AuthProvider;
  signIn: () => Promise<void>;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const look = presentation[provider];
  const label = t(look.label);

  const start = async () => {
    if (disabled || busy) return;
    onBusyChange?.(true);
    setBusy(true);
    try {
      await signIn();
    } catch (error) {
      // Backing out of the provider's sheet is a decision, not a failure.
      if (!(error instanceof SocialSignInCancelled)) {
        onError(
          error instanceof Error && error.message
            ? error.message
            : '소셜 로그인에 실패했어요.',
        );
      }
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  return (
    <Button
      fullWidth
      leftIcon={
        provider === 'kakao' ? <KakaoSymbol /> : <GoogleSymbol />
      }
      loading={busy}
      disabled={disabled || busy}
      onPress={() => void start()}
      style={[
        styles.socialButton,
        { backgroundColor: look.background, borderColor: look.border },
      ]}
      textStyle={{ color: look.text }}
      interactionStyle={{ backgroundColor: look.background, borderColor: look.border }}
      variant="secondary"
    >
      {label}
    </Button>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  line: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  socialButton: {
    borderRadius: radii.button,
    borderWidth: 1,
  },
});
