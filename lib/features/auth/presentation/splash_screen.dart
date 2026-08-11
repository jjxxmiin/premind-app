import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:premind/core/constants/app_sizes.dart';
import 'package:premind/core/constants/app_strings.dart';
import 'package:premind/core/widgets/app_button.dart';
import 'package:premind/core/widgets/app_wordmark.dart';
import 'package:premind/features/auth/data/mock_auth_repository.dart';
import 'package:premind/features/auth/presentation/auth_controller.dart';

/// Restores the persisted session, then delegates navigation to the router.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({
    required this.onAuthenticated,
    required this.onUnauthenticated,
    this.minimumDisplayDuration = const Duration(milliseconds: 450),
    super.key,
  });

  final VoidCallback onAuthenticated;
  final VoidCallback onUnauthenticated;
  final Duration minimumDisplayDuration;

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  Object? _error;
  bool _isResolving = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _resolveSession());
  }

  Future<void> _resolveSession({bool refresh = false}) async {
    if (_isResolving) {
      return;
    }
    setState(() {
      _isResolving = true;
      _error = null;
    });

    try {
      final Future<AuthSession?> sessionFuture;
      if (refresh) {
        sessionFuture = ref
            .read(authControllerProvider.notifier)
            .restoreSession();
      } else {
        sessionFuture = ref.read(authControllerProvider.future);
      }
      final results = await Future.wait<Object?>([
        sessionFuture,
        Future<void>.delayed(widget.minimumDisplayDuration),
      ]);
      if (!mounted) {
        return;
      }
      final session = results.first as AuthSession?;
      if (session == null) {
        widget.onUnauthenticated();
      } else {
        widget.onAuthenticated();
      }
    } on Object catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error);
    } finally {
      if (mounted) {
        setState(() => _isResolving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.primaryContainer,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSizes.pagePadding),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: _error == null
                  ? const _SplashBrand(key: ValueKey('brand'))
                  : _SplashError(
                      key: const ValueKey('error'),
                      onRetry: () => _resolveSession(refresh: true),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SplashBrand extends StatelessWidget {
  const _SplashBrand({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Semantics(
      liveRegion: true,
      label: 'PREMIND, 로그인 상태 확인 중',
      child: ExcludeSemantics(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AppWordmark(height: 30),
            const SizedBox(height: AppSizes.space16),
            Container(
              width: 32,
              height: 3,
              decoration: BoxDecoration(
                color: theme.colorScheme.primary,
                borderRadius: BorderRadius.circular(99),
              ),
            ),
            const SizedBox(height: AppSizes.space16),
            Text(
              '강의를 기억하는 가장 간단한 방법',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SplashError extends StatelessWidget {
  const _SplashError({required this.onRetry, super.key});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 320),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_outlined, size: 40),
          const SizedBox(height: AppSizes.space16),
          Text(
            '로그인 상태를 확인하지 못했어요.',
            style: Theme.of(context).textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSizes.space8),
          Text(
            '잠시 후 다시 시도해 주세요.',
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSizes.space24),
          AppButton(label: AppStrings.retry, onPressed: onRetry),
        ],
      ),
    );
  }
}
