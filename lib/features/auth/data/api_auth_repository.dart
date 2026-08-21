import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:premind/core/network/api_client.dart';
import 'package:premind/features/auth/data/auth_token_store.dart';
import 'package:premind/features/auth/data/mock_auth_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Production authentication backed by the PREMIND API.
///
/// Session restoration is offline-first: the recorder must keep working
/// without connectivity, so [restoreSession] only reads local storage and
/// never touches the network. Token freshness is handled lazily through
/// [validAccessToken], the seam later phases use for authorized calls.
class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository({
    required ApiClient apiClient,
    SharedPreferencesAsync? preferences,
    AuthTokenStore? tokenStore,
    DateTime Function()? now,
  }) : _apiClient = apiClient,
       _preferences = preferences ?? SharedPreferencesAsync(),
       _tokenStore = tokenStore ?? AuthTokenStore(preferences: preferences),
       _now = now ?? DateTime.now;

  /// Same key and payload format as [MockAuthRepository], so sessions survive
  /// swapping between the mock and the API implementation.
  static const _sessionKey = 'premind.auth.session.v1';

  static const _deviceName = 'premind-app';

  /// Access tokens expiring within this window are refreshed proactively.
  static const _expiryLeeway = Duration(seconds: 60);

  final ApiClient _apiClient;
  final SharedPreferencesAsync _preferences;
  final AuthTokenStore _tokenStore;
  final DateTime Function() _now;

  /// The refresh currently in flight, shared by concurrent
  /// [validAccessToken] callers so a rotated refresh token is never replayed
  /// against the API.
  Future<String?>? _refreshInFlight;

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
  Future<AuthSession> signInWithEmail({
    required String email,
    required String password,
  }) async {
    final response = await _apiClient.postJson(
      '/api/auth/token',
      <String, Object?>{
        'email': email,
        'password': password,
        'device_name': _deviceName,
      },
    );

    final session = _sessionFrom(response);
    final tokens = _tokensFrom(response);
    await _tokenStore.save(tokens);
    await _persistSession(session);
    return session;
  }

  /// Local-only development shortcut, identical to the mock so it never
  /// requires a running server.
  @override
  Future<AuthSession> signInWithDevelopmentAccount() async {
    final session = AuthSession(
      userId: 'premind-development-user',
      displayName: 'PREMIND 사용자',
      email: 'developer@premind.local',
      method: AuthMethod.development,
      signedInAt: _now(),
    );
    await _persistSession(session);
    return session;
  }

  @override
  Future<void> signOut() async {
    final tokens = await _tokenStore.read();
    if (tokens != null) {
      try {
        await _apiClient.postJson('/api/auth/token/revoke', <String, Object?>{
          'refresh_token': tokens.refreshToken,
        });
      } on ApiException {
        // Best effort: the local session is cleared regardless, and refresh
        // tokens expire server-side even when revocation cannot be delivered.
      }
    }
    await _tokenStore.clear();
    await _preferences.remove(_sessionKey);
  }

  /// Returns an access token that is valid for at least another 60 seconds,
  /// refreshing (and rotating) the stored pair when needed. Concurrent calls
  /// share a single refresh request.
  ///
  /// Returns null when no tokens are stored or when the refresh token was
  /// rejected (401/403), in which case the stored tokens and session are
  /// cleared and the user must sign in again. Network failures are surfaced
  /// as [ApiException] so callers can retry.
  Future<String?> validAccessToken() async {
    final tokens = await _tokenStore.read();
    if (tokens == null) {
      return null;
    }

    if (tokens.accessTokenExpiresAt.isAfter(_now().add(_expiryLeeway))) {
      return tokens.accessToken;
    }

    return _refreshInFlight ??= _refreshTokens().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  /// Refreshes the stored pair, re-reading it first so a caller that raced a
  /// just-completed refresh reuses the rotated tokens instead of replaying
  /// the retired refresh token.
  Future<String?> _refreshTokens() async {
    final tokens = await _tokenStore.read();
    if (tokens == null) {
      return null;
    }

    if (tokens.accessTokenExpiresAt.isAfter(_now().add(_expiryLeeway))) {
      return tokens.accessToken;
    }

    final Map<String, Object?> response;
    try {
      response = await _apiClient.postJson(
        '/api/auth/token/refresh',
        <String, Object?>{'refresh_token': tokens.refreshToken},
      );
    } on ApiException catch (error) {
      if (error.statusCode == 401 || error.statusCode == 403) {
        // Only sign out when the rejected token is still the stored one; a
        // concurrent refresh may have rotated the pair in the meantime, and
        // that fresh pair must survive.
        final current = await _tokenStore.read();
        if (current?.refreshToken == tokens.refreshToken) {
          await _tokenStore.clear();
          await _preferences.remove(_sessionKey);
        }
        return null;
      }
      rethrow;
    }

    final rotated = _tokensFrom(response);
    await _tokenStore.save(rotated);
    return rotated.accessToken;
  }

  Future<void> _persistSession(AuthSession session) {
    return _preferences.setString(_sessionKey, jsonEncode(session.toJson()));
  }

  AuthSession _sessionFrom(Map<String, Object?> response) {
    final user = response['user'];
    if (user is! Map<String, Object?>) {
      throw const ApiException(
        message: 'The server returned an unexpected sign-in response.',
      );
    }

    final id = user['id'];
    final email = user['email'];
    final name = user['name'];
    if (id == null || email is! String || name is! String) {
      throw const ApiException(
        message: 'The server returned an unexpected user payload.',
      );
    }

    return AuthSession(
      userId: '$id',
      displayName: name,
      email: email,
      method: AuthMethod.email,
      signedInAt: _now(),
    );
  }

  AuthTokens _tokensFrom(Map<String, Object?> response) {
    final accessToken = response['access_token'];
    final refreshToken = response['refresh_token'];
    final expiresIn = response['expires_in'];
    if (accessToken is! String ||
        refreshToken is! String ||
        expiresIn is! num) {
      throw const ApiException(
        message: 'The server returned an unexpected token payload.',
      );
    }

    return AuthTokens(
      accessToken: accessToken,
      accessTokenExpiresAt: _now().add(Duration(seconds: expiresIn.toInt())),
      refreshToken: refreshToken,
    );
  }
}

final apiAuthRepositoryProvider = Provider<ApiAuthRepository>((ref) {
  return ApiAuthRepository(apiClient: ref.watch(apiClientProvider));
});
