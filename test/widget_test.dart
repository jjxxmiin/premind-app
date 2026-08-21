import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:premind/app/theme.dart';
import 'package:premind/core/constants/app_colors.dart';
import 'package:premind/core/constants/app_strings.dart';
import 'package:premind/core/widgets/app_wordmark.dart';
import 'package:premind/features/auth/data/mock_auth_repository.dart';
import 'package:premind/features/auth/presentation/login_screen.dart';

void main() {
  testWidgets('login screen renders with the PREMIND theme and signs in', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final semantics = tester.ensureSemantics();
    final repository = _InMemoryAuthRepository();
    var didLogin = false;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(repository)],
        child: MaterialApp(
          theme: appTheme,
          home: LoginScreen(
            showDevelopmentLogin: true,
            onLoginSuccess: () => didLogin = true,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(AppWordmark), findsOneWidget);
    expect(find.bySemanticsLabel('PREMIND 로고'), findsOneWidget);
    semantics.dispose();
    expect(find.text(AppStrings.continueWithGoogle), findsOneWidget);
    expect(find.text(AppStrings.continueWithApple), findsOneWidget);
    expect(find.text(AppStrings.continueWithEmail), findsOneWidget);
    expect(find.text(AppStrings.developmentLogin), findsOneWidget);

    final context = tester.element(find.byType(LoginScreen));
    final theme = Theme.of(context);
    expect(theme.colorScheme.primary, const Color(0xFFD25417));
    expect(theme.colorScheme.primaryContainer, const Color(0xFFFBE8D7));
    expect(theme.colorScheme.onSurface, const Color(0xFF1F1813));
    expect(theme.scaffoldBackgroundColor, const Color(0xFFF5F0E7));
    expect(theme.textTheme.bodyMedium?.fontFamily, 'Pretendard');
    expect(AppColors.brand, const Color(0xFFD25417));

    await tester.ensureVisible(find.text(AppStrings.developmentLogin));
    await tester.tap(find.text(AppStrings.developmentLogin));
    await tester.pumpAndSettle();

    expect(didLogin, isTrue);
    expect(repository.session, isNotNull);
    expect(repository.session?.method, AuthMethod.development);
  });
}

class _InMemoryAuthRepository implements AuthRepository {
  AuthSession? session;

  @override
  Future<AuthSession?> restoreSession() async => session;

  @override
  Future<AuthSession> signInWithEmail({
    required String email,
    required String password,
  }) async {
    return session = AuthSession(
      userId: 'widget-test-user',
      displayName: 'Widget Test',
      email: email,
      method: AuthMethod.email,
      signedInAt: DateTime.utc(2026, 8, 8),
    );
  }

  @override
  Future<AuthSession> signInWithDevelopmentAccount() async {
    return session = AuthSession(
      userId: 'widget-test-user',
      displayName: 'Widget Test',
      email: 'widget@example.com',
      method: AuthMethod.development,
      signedInAt: DateTime.utc(2026, 8, 8),
    );
  }

  @override
  Future<void> signOut() async => session = null;
}
