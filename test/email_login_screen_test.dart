import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:premind/app/theme.dart';
import 'package:premind/core/constants/app_strings.dart';
import 'package:premind/core/network/api_client.dart';
import 'package:premind/features/auth/data/mock_auth_repository.dart';
import 'package:premind/features/auth/presentation/email_login_screen.dart';

void main() {
  Future<_EmailAuthRepository> pumpScreen(
    WidgetTester tester, {
    required VoidCallback onLoginSuccess,
  }) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repository = _EmailAuthRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(repository)],
        child: MaterialApp(
          theme: appTheme,
          home: EmailLoginScreen(onLoginSuccess: onLoginSuccess),
        ),
      ),
    );
    await tester.pumpAndSettle();
    return repository;
  }

  testWidgets('renders the email login form', (tester) async {
    await pumpScreen(tester, onLoginSuccess: () {});

    expect(find.text(AppStrings.emailLoginTitle), findsOneWidget);
    expect(find.text(AppStrings.emailFieldLabel), findsOneWidget);
    expect(find.text(AppStrings.passwordFieldLabel), findsOneWidget);
    expect(find.text(AppStrings.login), findsOneWidget);
  });

  testWidgets('validation blocks an empty submit', (tester) async {
    var didLogin = false;
    final repository = await pumpScreen(
      tester,
      onLoginSuccess: () => didLogin = true,
    );

    await tester.tap(find.text(AppStrings.login));
    await tester.pumpAndSettle();

    expect(find.text(AppStrings.emailInvalidError), findsOneWidget);
    expect(find.text(AppStrings.passwordEmptyError), findsOneWidget);
    expect(repository.signInWithEmailCalls, isZero);
    expect(didLogin, isFalse);
  });

  testWidgets('successful submit signs in and fires onLoginSuccess', (
    tester,
  ) async {
    var didLogin = false;
    final repository = await pumpScreen(
      tester,
      onLoginSuccess: () => didLogin = true,
    );

    await tester.enterText(
      find.byType(TextFormField).at(0),
      'student@example.com',
    );
    await tester.enterText(find.byType(TextFormField).at(1), 'secret');
    await tester.tap(find.text(AppStrings.login));
    await tester.pumpAndSettle();

    expect(repository.signInWithEmailCalls, 1);
    expect(repository.session?.email, 'student@example.com');
    expect(repository.session?.method, AuthMethod.email);
    expect(didLogin, isTrue);
  });

  Future<void> expectLoginFailureMessage(
    WidgetTester tester, {
    required Object error,
    required String message,
  }) async {
    var didLogin = false;
    final repository = await pumpScreen(
      tester,
      onLoginSuccess: () => didLogin = true,
    );
    repository.signInError = error;

    await tester.enterText(
      find.byType(TextFormField).at(0),
      'student@example.com',
    );
    await tester.enterText(find.byType(TextFormField).at(1), 'secret');
    await tester.tap(find.text(AppStrings.login));
    await tester.pumpAndSettle();

    expect(repository.signInWithEmailCalls, 1);
    expect(didLogin, isFalse);
    expect(find.widgetWithText(SnackBar, message), findsOneWidget);

    // Let the SnackBar's auto-dismiss timer fire so the test ends cleanly.
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
  }

  testWidgets('a 401 rejection shows the credentials message', (tester) async {
    await expectLoginFailureMessage(
      tester,
      error: const ApiException(statusCode: 401, message: 'Bad credentials'),
      message: AppStrings.loginFailedCredentials,
    );
  });

  testWidgets('a 429 rejection shows the rate-limit message', (tester) async {
    await expectLoginFailureMessage(
      tester,
      error: const ApiException(statusCode: 429, message: 'Too many attempts'),
      message: AppStrings.loginFailedRateLimited,
    );
  });

  testWidgets('a network failure shows the network message', (tester) async {
    await expectLoginFailureMessage(
      tester,
      error: const ApiException(message: 'Offline', isNetworkError: true),
      message: AppStrings.loginFailedNetwork,
    );
  });

  testWidgets('an unexpected error shows the generic message', (tester) async {
    await expectLoginFailureMessage(
      tester,
      error: StateError('boom'),
      message: AppStrings.loginFailedUnknown,
    );
  });
}

class _EmailAuthRepository implements AuthRepository {
  AuthSession? session;
  Object? signInError;
  int signInWithEmailCalls = 0;

  @override
  Future<AuthSession?> restoreSession() async => session;

  @override
  Future<AuthSession> signInWithEmail({
    required String email,
    required String password,
  }) async {
    signInWithEmailCalls += 1;
    final error = signInError;
    if (error != null) {
      throw error;
    }
    return session = AuthSession(
      userId: 'email-test-user',
      displayName: 'Email Test',
      email: email,
      method: AuthMethod.email,
      signedInAt: DateTime.utc(2026, 8, 20),
    );
  }

  @override
  Future<AuthSession> signInWithDevelopmentAccount() async {
    throw UnimplementedError();
  }

  @override
  Future<void> signOut() async => session = null;
}
