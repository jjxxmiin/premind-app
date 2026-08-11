import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:premind/core/constants/app_sizes.dart';
import 'package:premind/core/constants/app_strings.dart';
import 'package:premind/core/widgets/app_button.dart';
import 'package:premind/core/widgets/app_wordmark.dart';
import 'package:premind/features/auth/presentation/auth_controller.dart';

/// Authentication entry point. Production providers are intentionally passed
/// in as callbacks so this screen remains independent from routing and OAuth.
class LoginScreen extends ConsumerWidget {
  const LoginScreen({
    required this.onLoginSuccess,
    this.onGooglePressed,
    this.onApplePressed,
    this.onEmailPressed,
    this.showDevelopmentLogin = kDebugMode,
    super.key,
  });

  final VoidCallback onLoginSuccess;
  final VoidCallback? onGooglePressed;
  final VoidCallback? onApplePressed;
  final VoidCallback? onEmailPressed;
  final bool showDevelopmentLogin;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState.isLoading;

    void showPendingMessage() {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text(AppStrings.authenticationComingSoon)),
        );
    }

    Future<void> developmentLogin() async {
      try {
        await ref
            .read(authControllerProvider.notifier)
            .signInWithDevelopmentAccount();
        if (context.mounted) {
          onLoginSuccess();
        }
      } on Object {
        if (!context.mounted) {
          return;
        }
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            const SnackBar(content: Text('로그인하지 못했어요. 다시 시도해 주세요.')),
          );
      }
    }

    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                AppSizes.pagePadding,
                AppSizes.space20,
                AppSizes.pagePadding,
                AppSizes.space24,
              ),
              child: Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: 416,
                    minHeight:
                        constraints.maxHeight -
                        AppSizes.space20 -
                        AppSizes.space24,
                  ),
                  child: IntrinsicHeight(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Align(
                          alignment: Alignment.centerLeft,
                          child: AppWordmark(height: 24),
                        ),
                        const SizedBox(height: AppSizes.space32),
                        const _LoginHero(),
                        const SizedBox(height: AppSizes.space16),
                        Material(
                          color: colorScheme.surface,
                          surfaceTintColor: Colors.transparent,
                          clipBehavior: Clip.antiAlias,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(
                              AppSizes.radiusLarge,
                            ),
                            side: BorderSide(color: colorScheme.outlineVariant),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(16, 18, 16, 4),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  '로그인하고 시작하세요',
                                  style: theme.textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: -0.3,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  '기록한 강의는 계정에 안전하게 연결돼요.',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: colorScheme.onSurfaceVariant,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                _AuthMethodAction(
                                  label: AppStrings.continueWithGoogle,
                                  leading: const _GoogleMark(),
                                  onPressed: isLoading
                                      ? null
                                      : onGooglePressed ?? showPendingMessage,
                                ),
                                const Divider(height: 1),
                                _AuthMethodAction(
                                  label: AppStrings.continueWithApple,
                                  leading: const Icon(Icons.apple, size: 22),
                                  onPressed: isLoading
                                      ? null
                                      : onApplePressed ?? showPendingMessage,
                                ),
                                const Divider(height: 1),
                                _AuthMethodAction(
                                  label: AppStrings.continueWithEmail,
                                  leading: const Icon(
                                    Icons.mail_outline_rounded,
                                    size: 20,
                                  ),
                                  onPressed: isLoading
                                      ? null
                                      : onEmailPressed ?? showPendingMessage,
                                ),
                              ],
                            ),
                          ),
                        ),
                        if (showDevelopmentLogin) ...[
                          const SizedBox(height: AppSizes.space24),
                          Text(
                            '개발 환경에서 먼저 둘러보세요.',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(height: AppSizes.space8),
                          AppButton(
                            label: AppStrings.developmentLogin,
                            isLoading: isLoading,
                            onPressed: developmentLogin,
                          ),
                        ],
                        const Spacer(),
                        const SizedBox(height: AppSizes.space32),
                        Text(
                          '계속하면 PREMIND의 이용약관 및 개인정보 처리방침에 동의하게 됩니다.',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _LoginHero extends StatelessWidget {
  const _LoginHero();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.fromLTRB(24, 26, 24, 28),
      decoration: BoxDecoration(
        color: colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(AppSizes.radiusXLarge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            AppStrings.appTagline,
            style: theme.textTheme.headlineMedium?.copyWith(
              color: colorScheme.onPrimaryContainer,
              fontSize: 29,
              fontWeight: FontWeight.w800,
              height: 1.28,
              letterSpacing: -0.8,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '수업의 흐름을 놓치지 않고 다시 꺼내보세요.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: colorScheme.onPrimaryContainer.withValues(alpha: 0.72),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _GoogleMark extends StatelessWidget {
  const _GoogleMark();

  @override
  Widget build(BuildContext context) {
    return Text(
      'G',
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
        color: const Color(0xFF4285F4),
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _AuthMethodAction extends StatelessWidget {
  const _AuthMethodAction({
    required this.label,
    required this.leading,
    required this.onPressed,
  });

  final String label;
  final Widget leading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isEnabled = onPressed != null;

    return Semantics(
      button: true,
      enabled: isEnabled,
      label: label,
      child: ExcludeSemantics(
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(AppSizes.radiusSmall),
            child: SizedBox(
              height: 54,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: SizedBox(
                      width: 28,
                      child: Center(
                        child: IconTheme(
                          data: IconThemeData(
                            color: isEnabled
                                ? theme.colorScheme.onSurface
                                : theme.disabledColor,
                          ),
                          child: leading,
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 40),
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: isEnabled
                            ? theme.colorScheme.onSurface
                            : theme.disabledColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
