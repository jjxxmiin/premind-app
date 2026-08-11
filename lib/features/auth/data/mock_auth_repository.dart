import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AuthMethod { google, apple, email, development }

/// The minimal authenticated identity kept by the MVP.
class AuthSession {
  const AuthSession({
    required this.userId,
    required this.displayName,
    required this.email,
    required this.method,
    required this.signedInAt,
  });

  final String userId;
  final String displayName;
  final String email;
  final AuthMethod method;
  final DateTime signedInAt;

  Map<String, Object> toJson() => <String, Object>{
    'userId': userId,
    'displayName': displayName,
    'email': email,
    'method': method.name,
    'signedInAt': signedInAt.toUtc().toIso8601String(),
  };

  factory AuthSession.fromJson(Map<String, Object?> json) {
    final userId = json['userId'];
    final displayName = json['displayName'];
    final email = json['email'];
    final methodName = json['method'];
    final signedInAtValue = json['signedInAt'];

    if (userId is! String ||
        displayName is! String ||
        email is! String ||
        methodName is! String ||
        signedInAtValue is! String) {
      throw const FormatException('Invalid stored authentication session.');
    }

    return AuthSession(
      userId: userId,
      displayName: displayName,
      email: email,
      method: AuthMethod.values.firstWhere(
        (method) => method.name == methodName,
        orElse: () => AuthMethod.development,
      ),
      signedInAt: DateTime.parse(signedInAtValue).toLocal(),
    );
  }
}

abstract interface class AuthRepository {
  Future<AuthSession?> restoreSession();

  Future<AuthSession> signInWithDevelopmentAccount();

  Future<void> signOut();
}

/// Local deterministic authentication used until production OAuth is wired.
class MockAuthRepository implements AuthRepository {
  MockAuthRepository({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  static const _sessionKey = 'premind.auth.session.v1';

  final SharedPreferencesAsync _preferences;

  @override
  Future<AuthSession?> restoreSession() async {
    final encoded = await _preferences.getString(_sessionKey);
    if (encoded == null || encoded.isEmpty) {
      return null;
    }

    try {
      final decoded = jsonDecode(encoded);
      if (decoded is! Map<String, Object?>) {
        throw const FormatException('Stored session is not an object.');
      }
      return AuthSession.fromJson(decoded);
    } on FormatException {
      await _preferences.remove(_sessionKey);
      return null;
    }
  }

  @override
  Future<AuthSession> signInWithDevelopmentAccount() async {
    final session = AuthSession(
      userId: 'premind-development-user',
      displayName: 'PREMIND 사용자',
      email: 'developer@premind.local',
      method: AuthMethod.development,
      signedInAt: DateTime.now(),
    );
    await _preferences.setString(_sessionKey, jsonEncode(session.toJson()));
    return session;
  }

  @override
  Future<void> signOut() => _preferences.remove(_sessionKey);
}

/// Concrete provider exposed for tests that need the mock implementation.
final mockAuthRepositoryProvider = Provider<MockAuthRepository>((ref) {
  return MockAuthRepository();
});

/// Override this provider when the production authentication repository lands.
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return ref.watch(mockAuthRepositoryProvider);
});
