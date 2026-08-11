import 'package:flutter_test/flutter_test.dart';
import 'package:premind/features/auth/data/mock_auth_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';
// The package intentionally exposes no async testing backend, so this test
// installs its platform-interface in-memory implementation directly.
// ignore: depend_on_referenced_packages
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
// ignore: depend_on_referenced_packages
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

void main() {
  group('MockAuthRepository', () {
    setUp(() {
      SharedPreferencesAsyncPlatform.instance =
          InMemorySharedPreferencesAsync.empty();
    });

    test('persists development login and clears it on logout', () async {
      final firstRepository = MockAuthRepository(
        preferences: SharedPreferencesAsync(),
      );

      final signedIn = await firstRepository.signInWithDevelopmentAccount();
      expect(signedIn.userId, 'premind-development-user');
      expect(signedIn.method, AuthMethod.development);

      final recreatedRepository = MockAuthRepository(
        preferences: SharedPreferencesAsync(),
      );
      final restored = await recreatedRepository.restoreSession();
      expect(restored?.userId, signedIn.userId);
      expect(restored?.displayName, signedIn.displayName);
      expect(restored?.email, signedIn.email);
      expect(restored?.method, AuthMethod.development);
      expect(restored?.signedInAt.toUtc(), signedIn.signedInAt.toUtc());

      await recreatedRepository.signOut();

      final afterLogout = MockAuthRepository(
        preferences: SharedPreferencesAsync(),
      );
      expect(await afterLogout.restoreSession(), isNull);
    });
  });
}
