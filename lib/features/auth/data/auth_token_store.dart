import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// The access/refresh token pair issued by the PREMIND API.
class AuthTokens {
  const AuthTokens({
    required this.accessToken,
    required this.accessTokenExpiresAt,
    required this.refreshToken,
  });

  final String accessToken;
  final DateTime accessTokenExpiresAt;
  final String refreshToken;

  Map<String, Object> toJson() => <String, Object>{
    'accessToken': accessToken,
    'accessTokenExpiresAt': accessTokenExpiresAt.toUtc().toIso8601String(),
    'refreshToken': refreshToken,
  };

  factory AuthTokens.fromJson(Map<String, Object?> json) {
    final accessToken = json['accessToken'];
    final accessTokenExpiresAt = json['accessTokenExpiresAt'];
    final refreshToken = json['refreshToken'];

    if (accessToken is! String ||
        accessTokenExpiresAt is! String ||
        refreshToken is! String) {
      throw const FormatException('Invalid stored authentication tokens.');
    }

    return AuthTokens(
      accessToken: accessToken,
      accessTokenExpiresAt: DateTime.parse(accessTokenExpiresAt),
      refreshToken: refreshToken,
    );
  }
}

/// Persists the API token pair as a single JSON document.
///
/// MVP storage: tokens live in [SharedPreferencesAsync], which is unencrypted
/// on device. The upgrade path is `flutter_secure_storage` (Keychain /
/// EncryptedSharedPreferences) behind this same interface.
class AuthTokenStore {
  AuthTokenStore({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  static const _tokensKey = 'premind.auth.tokens.v1';

  final SharedPreferencesAsync _preferences;

  Future<void> save(AuthTokens tokens) {
    return _preferences.setString(_tokensKey, jsonEncode(tokens.toJson()));
  }

  Future<AuthTokens?> read() async {
    final encoded = await _preferences.getString(_tokensKey);
    if (encoded == null || encoded.isEmpty) {
      return null;
    }

    try {
      final decoded = jsonDecode(encoded);
      if (decoded is! Map<String, Object?>) {
        throw const FormatException('Stored tokens are not an object.');
      }
      return AuthTokens.fromJson(decoded);
    } on FormatException {
      await _preferences.remove(_tokensKey);
      return null;
    }
  }

  Future<void> clear() => _preferences.remove(_tokensKey);
}
