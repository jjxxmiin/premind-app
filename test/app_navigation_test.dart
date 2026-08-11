import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:premind/app/app.dart';
import 'package:premind/features/auth/data/mock_auth_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('restores a session and navigates across the main shell', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues(<String, Object>{});

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(_AuthenticatedRepository()),
        ],
        child: const PremindApp(),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();

    expect(find.text('오늘 강의를\n기록해볼까요?'), findsOneWidget);
    expect(find.byType(NavigationBar), findsOneWidget);

    await tester.tap(find.text('강의'));
    await tester.pumpAndSettle();
    expect(find.text('내 강의'), findsOneWidget);

    await tester.tap(find.text('마이'));
    await tester.pumpAndSettle();
    expect(find.text('앱 설정'), findsOneWidget);
  });
}

class _AuthenticatedRepository implements AuthRepository {
  final AuthSession _session = AuthSession(
    userId: 'navigation-test-user',
    displayName: 'Navigation Test',
    email: 'navigation@example.com',
    method: AuthMethod.development,
    signedInAt: DateTime.utc(2026, 8, 8),
  );

  @override
  Future<AuthSession?> restoreSession() async => _session;

  @override
  Future<AuthSession> signInWithDevelopmentAccount() async => _session;

  @override
  Future<void> signOut() async {}
}
