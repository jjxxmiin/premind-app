import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import {
  SocialSignInCancelled,
  useAvailableProviders,
  useGoogleSignIn,
  useKakaoSignIn,
} from '@/features/auth/use-social-sign-in';
import type { AuthProvider } from '@/services/api/client';
import { decorative } from '@/lib/a11y';
import { colors, radii, spacing } from '@/theme/tokens';

const googleLogo = require('../../assets/social/google-g.png');
const kakaoLoginButton = require('../../assets/social/kakao-login-medium-wide.png');

const presentation: Record<AuthProvider, { label: string; background: string; border: string; text: string }> = {
  kakao: {
    label: '카카오로 계속하기',
    background: '#FEE500',
    border: '#FEE500',
    text: '#191600',
  },
  google: {
    label: '구글로 계속하기',
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
 * The surface colours and image assets are the official provider treatments:
 * Kakao's supplied full-width button and Google's supplied G mark on white.
 */
export function SocialSignInButtons({
  disabled = false,
  onBusyChange,
  onError,
}: SocialSignInButtonsProps) {
  const available = useAvailableProviders();
  if (available.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <AppText tone="faint" variant="badge">
          간편 로그인
        </AppText>
        <View style={styles.line} />
      </View>

      {disabled ? (
        <AppText align="center" tone="muted" variant="meta">
          필수 약관에 동의하면 간편 가입을 사용할 수 있어요.
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
  const [busy, setBusy] = useState(false);
  const look = presentation[provider];

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

  if (provider === 'kakao') {
    return (
      <Pressable
        accessibilityLabel={look.label}
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: busy || disabled }}
        disabled={busy || disabled}
        onPress={() => void start()}
        style={({ pressed }) => [
          styles.kakaoButton,
          pressed ? styles.pressed : null,
          busy ? styles.busy : null,
          disabled ? styles.busy : null,
        ]}
      >
        <Image
          {...decorative}
          contentFit="contain"
          source={kakaoLoginButton}
          style={styles.kakaoImage}
        />
        {busy ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#191600" size="small" />
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <Button
      fullWidth
      leftIcon={
        <Image
          {...decorative}
          contentFit="contain"
          source={googleLogo}
          style={styles.googleLogo}
        />
      }
      loading={busy}
      disabled={disabled || busy}
      onPress={() => void start()}
      style={[
        styles.socialButton,
        { backgroundColor: look.background, borderColor: look.border },
      ]}
      textStyle={{ color: look.text }}
      variant="secondary"
    >
      {look.label}
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
  googleLogo: {
    height: 18,
    width: 18,
  },
  kakaoButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FEE500',
    borderRadius: 12,
    height: 45,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  kakaoImage: {
    height: 45,
    maxWidth: 300,
    width: '100%',
  },
  loadingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(254, 229, 0, 0.82)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.995 }],
  },
  busy: {
    opacity: 0.72,
  },
});
