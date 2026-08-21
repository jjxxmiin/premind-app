import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:premind/core/network/api_client.dart';
import 'package:premind/core/network/api_config.dart';
import 'package:premind/features/auth/data/api_auth_repository.dart';
import 'package:premind/features/auth/data/auth_token_store.dart';
import 'package:premind/features/auth/data/mock_auth_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';
// The package intentionally exposes no async testing backend, so this test
// installs its platform-interface in-memory implementation directly.
// ignore: depend_on_referenced_packages
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
// ignore: depend_on_referenced_packages
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

void main() {
  group('ApiAuthRepository', () {
    setUp(() {
      SharedPreferencesAsyncPlatform.instance =
          InMemorySharedPreferencesAsync.empty();
    });

    Map<String, Object?> tokenResponse({
      String accessToken = 'access-1',
      String refreshToken = 'refresh-1',
    }) {
      return <String, Object?>{
        'access_token': accessToken,
        'token_type': 'bearer',
        'expires_in': 900,
        'refresh_token': refreshToken,
        'refresh_expires_in': 1209600,
        'user': <String, Object?>{
          'id': 'user-1',
          'email': 'student@example.com',
          'name': '홍길동',
          'role': 'student',
        },
      };
    }

    ApiAuthRepository buildRepository(_RecordingHttpClient httpClient) {
      return ApiAuthRepository(
        apiClient: ApiClient(
          config: ApiConfig(baseUrl: 'http://api.test'),
          httpClient: httpClient,
        ),
        preferences: SharedPreferencesAsync(),
      );
    }

    test('signInWithEmail persists the session and tokens', () async {
      final httpClient = _RecordingHttpClient(
        (request) async => _jsonResponse(200, tokenResponse()),
      );
      final repository = buildRepository(httpClient);

      final session = await repository.signInWithEmail(
        email: 'student@example.com',
        password: 'secret',
      );

      expect(session.userId, 'user-1');
      expect(session.displayName, '홍길동');
      expect(session.email, 'student@example.com');
      expect(session.method, AuthMethod.email);

      final request = httpClient.requests.single;
      expect(request.url.path, '/api/auth/token');
      final requestBody = jsonDecode(request.body) as Map<String, Object?>;
      expect(requestBody['email'], 'student@example.com');
      expect(requestBody['password'], 'secret');
      expect(requestBody['device_name'], 'premind-app');

      final restored = await buildRepository(httpClient).restoreSession();
      expect(restored?.userId, 'user-1');
      expect(restored?.method, AuthMethod.email);

      final tokens = await AuthTokenStore(
        preferences: SharedPreferencesAsync(),
      ).read();
      expect(tokens?.accessToken, 'access-1');
      expect(tokens?.refreshToken, 'refresh-1');
      expect(tokens?.accessTokenExpiresAt.isAfter(DateTime.now()), isTrue);
    });

    test('signInWithEmail surfaces a 401 as an ApiException', () async {
      final httpClient = _RecordingHttpClient(
        (request) async =>
            _jsonResponse(401, <String, Object?>{'detail': 'Bad credentials'}),
      );
      final repository = buildRepository(httpClient);

      await expectLater(
        repository.signInWithEmail(
          email: 'student@example.com',
          password: 'wrong',
        ),
        throwsA(
          isA<ApiException>()
              .having((error) => error.statusCode, 'statusCode', 401)
              .having((error) => error.message, 'message', 'Bad credentials')
              .having((error) => error.isNetworkError, 'isNetworkError', false),
        ),
      );
      expect(await repository.restoreSession(), isNull);
    });

    test('validAccessToken returns the cached token while fresh', () async {
      final store = AuthTokenStore(preferences: SharedPreferencesAsync());
      await store.save(
        AuthTokens(
          accessToken: 'cached-access',
          accessTokenExpiresAt: DateTime.now().add(const Duration(hours: 1)),
          refreshToken: 'cached-refresh',
        ),
      );
      final httpClient = _RecordingHttpClient(
        (request) async => fail('No network call expected for a fresh token.'),
      );
      final repository = buildRepository(httpClient);

      expect(await repository.validAccessToken(), 'cached-access');
      expect(httpClient.requests, isEmpty);
    });

    test('validAccessToken refreshes and rotates a stale pair', () async {
      final store = AuthTokenStore(preferences: SharedPreferencesAsync());
      await store.save(
        AuthTokens(
          accessToken: 'stale-access',
          accessTokenExpiresAt: DateTime.now().add(const Duration(seconds: 5)),
          refreshToken: 'stale-refresh',
        ),
      );
      final httpClient = _RecordingHttpClient(
        (request) async => _jsonResponse(
          200,
          tokenResponse(accessToken: 'access-2', refreshToken: 'refresh-2'),
        ),
      );
      final repository = buildRepository(httpClient);

      expect(await repository.validAccessToken(), 'access-2');

      final request = httpClient.requests.single;
      expect(request.url.path, '/api/auth/token/refresh');
      final requestBody = jsonDecode(request.body) as Map<String, Object?>;
      expect(requestBody['refresh_token'], 'stale-refresh');

      final rotated = await store.read();
      expect(rotated?.accessToken, 'access-2');
      expect(rotated?.refreshToken, 'refresh-2');
    });

    test('validAccessToken clears tokens and session when the refresh is '
        'rejected', () async {
      final store = AuthTokenStore(preferences: SharedPreferencesAsync());
      await store.save(
        AuthTokens(
          accessToken: 'stale-access',
          accessTokenExpiresAt: DateTime.now().subtract(
            const Duration(minutes: 5),
          ),
          refreshToken: 'revoked-refresh',
        ),
      );
      final httpClient = _RecordingHttpClient(
        (request) async =>
            _jsonResponse(401, <String, Object?>{'detail': 'Token revoked'}),
      );
      final repository = buildRepository(httpClient);
      await repository.signInWithDevelopmentAccount();

      expect(await repository.validAccessToken(), isNull);
      expect(await store.read(), isNull);
      expect(await repository.restoreSession(), isNull);
    });

    test('concurrent validAccessToken calls share a single refresh', () async {
      final store = AuthTokenStore(preferences: SharedPreferencesAsync());
      await store.save(
        AuthTokens(
          accessToken: 'stale-access',
          accessTokenExpiresAt: DateTime.now().subtract(
            const Duration(minutes: 5),
          ),
          refreshToken: 'stale-refresh',
        ),
      );
      final httpClient = _RecordingHttpClient(
        (request) async => _jsonResponse(
          200,
          tokenResponse(accessToken: 'access-2', refreshToken: 'refresh-2'),
        ),
      );
      final repository = buildRepository(httpClient);

      final results = await Future.wait([
        repository.validAccessToken(),
        repository.validAccessToken(),
      ]);

      expect(results, ['access-2', 'access-2']);
      expect(httpClient.requests, hasLength(1));
      expect((await store.read())?.refreshToken, 'refresh-2');
    });

    test('a rejected refresh does not clear tokens rotated by a concurrent '
        'client', () async {
      final store = AuthTokenStore(preferences: SharedPreferencesAsync());
      await store.save(
        AuthTokens(
          accessToken: 'stale-access',
          accessTokenExpiresAt: DateTime.now().subtract(
            const Duration(minutes: 5),
          ),
          refreshToken: 'stale-refresh',
        ),
      );

      final replayReachedServer = Completer<void>();
      final rotationCompleted = Completer<void>();
      final replayingClient = _RecordingHttpClient((request) async {
        replayReachedServer.complete();
        await rotationCompleted.future;
        return _jsonResponse(401, <String, Object?>{'detail': 'Token reused'});
      });
      final rotatingClient = _RecordingHttpClient(
        (request) async => _jsonResponse(
          200,
          tokenResponse(accessToken: 'access-2', refreshToken: 'refresh-2'),
        ),
      );

      // Two repository instances share the same stored pair, mimicking two
      // isolates (or app launches) racing the same rotation.
      final replayResult = buildRepository(replayingClient).validAccessToken();
      await replayReachedServer.future;
      expect(
        await buildRepository(rotatingClient).validAccessToken(),
        'access-2',
      );
      rotationCompleted.complete();

      expect(await replayResult, isNull);
      expect((await store.read())?.refreshToken, 'refresh-2');
    });

    test('signOut clears local state even when revocation fails', () async {
      final preferences = SharedPreferencesAsync();
      final store = AuthTokenStore(preferences: preferences);
      await store.save(
        AuthTokens(
          accessToken: 'access-1',
          accessTokenExpiresAt: DateTime.now().add(const Duration(hours: 1)),
          refreshToken: 'refresh-1',
        ),
      );
      final httpClient = _RecordingHttpClient(
        (request) async => throw const SocketException('Connection refused'),
      );
      final repository = buildRepository(httpClient);
      await repository.signInWithDevelopmentAccount();

      await repository.signOut();

      expect(httpClient.requests.single.url.path, '/api/auth/token/revoke');
      expect(await store.read(), isNull);
      expect(await repository.restoreSession(), isNull);
    });

    test(
      'signOut clears local state even when the TLS handshake fails',
      () async {
        final preferences = SharedPreferencesAsync();
        final store = AuthTokenStore(preferences: preferences);
        await store.save(
          AuthTokens(
            accessToken: 'access-1',
            accessTokenExpiresAt: DateTime.now().add(const Duration(hours: 1)),
            refreshToken: 'refresh-1',
          ),
        );
        final httpClient = _RecordingHttpClient(
          (request) async => throw const HandshakeException('Bad certificate'),
        );
        final repository = buildRepository(httpClient);
        await repository.signInWithDevelopmentAccount();

        await repository.signOut();

        expect(await store.read(), isNull);
        expect(await repository.restoreSession(), isNull);
      },
    );
  });
}

http.Response _jsonResponse(int statusCode, Map<String, Object?> body) {
  return http.Response.bytes(
    utf8.encode(jsonEncode(body)),
    statusCode,
    headers: const {'content-type': 'application/json'},
  );
}

class _RecordingHttpClient extends http.BaseClient {
  _RecordingHttpClient(this._handler);

  final Future<http.Response> Function(http.Request request) _handler;
  final requests = <http.Request>[];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final typedRequest = request as http.Request;
    requests.add(typedRequest);
    final response = await _handler(typedRequest);
    return http.StreamedResponse(
      Stream.value(response.bodyBytes),
      response.statusCode,
      headers: response.headers,
      request: request,
    );
  }
}
