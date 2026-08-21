import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:premind/features/auth/data/mock_auth_repository.dart';

final authControllerProvider =
    AsyncNotifierProvider<AuthController, AuthSession?>(AuthController.new);

/// Owns session restoration and authentication mutations for the application.
class AuthController extends AsyncNotifier<AuthSession?> {
  @override
  Future<AuthSession?> build() {
    return ref.watch(authRepositoryProvider).restoreSession();
  }

  Future<AuthSession> signInWithEmail({
    required String email,
    required String password,
  }) async {
    state = const AsyncLoading<AuthSession?>();
    try {
      final session = await ref
          .read(authRepositoryProvider)
          .signInWithEmail(email: email, password: password);
      state = AsyncData<AuthSession?>(session);
      return session;
    } on Object catch (error, stackTrace) {
      state = AsyncError<AuthSession?>(error, stackTrace);
      Error.throwWithStackTrace(error, stackTrace);
    }
  }

  Future<AuthSession> signInWithDevelopmentAccount() async {
    state = const AsyncLoading<AuthSession?>();
    try {
      final session = await ref
          .read(authRepositoryProvider)
          .signInWithDevelopmentAccount();
      state = AsyncData<AuthSession?>(session);
      return session;
    } on Object catch (error, stackTrace) {
      state = AsyncError<AuthSession?>(error, stackTrace);
      Error.throwWithStackTrace(error, stackTrace);
    }
  }

  Future<void> signOut() async {
    state = const AsyncLoading<AuthSession?>();
    try {
      await ref.read(authRepositoryProvider).signOut();
      state = const AsyncData<AuthSession?>(null);
    } on Object catch (error, stackTrace) {
      state = AsyncError<AuthSession?>(error, stackTrace);
      Error.throwWithStackTrace(error, stackTrace);
    }
  }

  Future<AuthSession?> restoreSession() async {
    state = const AsyncLoading<AuthSession?>();
    try {
      final session = await ref.read(authRepositoryProvider).restoreSession();
      state = AsyncData<AuthSession?>(session);
      return session;
    } on Object catch (error, stackTrace) {
      state = AsyncError<AuthSession?>(error, stackTrace);
      Error.throwWithStackTrace(error, stackTrace);
    }
  }
}
