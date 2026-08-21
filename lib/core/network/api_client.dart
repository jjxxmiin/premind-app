import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:premind/core/network/api_config.dart';

/// Raised when an API request fails, either because the server rejected it
/// ([statusCode] is set) or because it never reached the server
/// ([isNetworkError] is true).
class ApiException implements Exception {
  const ApiException({
    required this.message,
    this.statusCode,
    this.isNetworkError = false,
  });

  /// The HTTP status code, or null when the request failed before a response.
  final int? statusCode;

  /// The FastAPI `detail` string when the server provided one, otherwise a
  /// generic description of the failure.
  final String message;

  /// True when the failure was a connectivity problem (socket or TLS error,
  /// timeout, or client-level transport error) rather than a server response.
  final bool isNetworkError;

  @override
  String toString() =>
      'ApiException(statusCode: $statusCode, '
      'isNetworkError: $isNetworkError, message: $message)';
}

/// A thin JSON HTTP client for the PREMIND API.
///
/// The underlying [http.Client] is injectable so tests can drive requests
/// against a hand-written fake without opening sockets.
class ApiClient {
  ApiClient({required ApiConfig config, http.Client? httpClient})
    : _config = config,
      _httpClient = httpClient ?? http.Client();

  static const _timeout = Duration(seconds: 15);

  /// Chunk uploads move real bytes over slow lecture-hall networks, so they get
  /// their own budget instead of the interactive [_timeout].
  static const _uploadTimeout = Duration(minutes: 2);

  final ApiConfig _config;
  final http.Client _httpClient;

  Future<Map<String, Object?>> postJson(
    String path,
    Map<String, Object?> body, {
    Map<String, String>? headers,
  }) {
    return _perform(
      () => _httpClient.post(
        _resolve(path),
        headers: _mergeHeaders(headers, includeContentType: true),
        body: jsonEncode(body),
        encoding: utf8,
      ),
    );
  }

  Future<Map<String, Object?>> getJson(
    String path, {
    Map<String, String>? headers,
  }) {
    return _perform(
      () => _httpClient.get(_resolve(path), headers: _mergeHeaders(headers)),
    );
  }

  Future<Map<String, Object?>> deleteJson(
    String path, {
    Map<String, String>? headers,
  }) {
    return _perform(
      () => _httpClient.delete(_resolve(path), headers: _mergeHeaders(headers)),
    );
  }

  /// Sends raw [bytes] as the body of a PUT — used for resumable upload chunks.
  ///
  /// Uses [_uploadTimeout] rather than the interactive timeout, since a chunk
  /// on a weak network legitimately takes far longer than an API call.
  Future<Map<String, Object?>> putBytes(
    String path,
    List<int> bytes, {
    Map<String, String>? headers,
    String contentType = 'application/octet-stream',
  }) {
    return _perform(
      () => _httpClient.put(
        _resolve(path),
        headers: <String, String>{
          ..._mergeHeaders(headers),
          'Content-Type': contentType,
        },
        body: bytes,
      ),
      timeout: _uploadTimeout,
    );
  }

  void close() => _httpClient.close();

  Uri _resolve(String path) => Uri.parse('${_config.baseUrl}$path');

  Map<String, String> _mergeHeaders(
    Map<String, String>? headers, {
    bool includeContentType = false,
  }) {
    return <String, String>{
      'Accept': 'application/json',
      if (includeContentType) 'Content-Type': 'application/json; charset=utf-8',
      ...?headers,
    };
  }

  Future<Map<String, Object?>> _perform(
    Future<http.Response> Function() request, {
    Duration timeout = _timeout,
  }) async {
    final http.Response response;
    try {
      response = await request().timeout(timeout);
    } on SocketException catch (error) {
      throw ApiException(
        message: 'Could not reach the server: ${error.message}',
        isNetworkError: true,
      );
    } on TimeoutException {
      throw const ApiException(
        message: 'The server did not respond in time.',
        isNetworkError: true,
      );
    } on http.ClientException catch (error) {
      throw ApiException(
        message: 'Could not reach the server: ${error.message}',
        isNetworkError: true,
      );
    } on IOException catch (error) {
      // TLS failures (HandshakeException, CertificateException) and other
      // I/O errors are not wrapped by the http package, so map them here to
      // keep the "network failures become ApiException" contract.
      throw ApiException(
        message: 'Could not reach the server: $error',
        isNetworkError: true,
      );
    }
    return _decode(response);
  }

  Map<String, Object?> _decode(http.Response response) {
    final statusCode = response.statusCode;
    final body = response.bodyBytes.isEmpty
        ? ''
        : utf8.decode(response.bodyBytes, allowMalformed: true);

    if (statusCode >= 200 && statusCode < 300) {
      if (body.isEmpty) {
        return const <String, Object?>{};
      }
      final decoded = _tryDecodeJson(body);
      if (decoded is Map<String, Object?>) {
        return decoded;
      }
      throw ApiException(
        statusCode: statusCode,
        message: 'The server returned an unexpected response.',
      );
    }

    throw ApiException(
      statusCode: statusCode,
      message: _detailFrom(body) ?? 'Request failed with status $statusCode.',
    );
  }

  Object? _tryDecodeJson(String body) {
    try {
      return jsonDecode(body);
    } on FormatException {
      return null;
    }
  }

  /// Extracts the FastAPI `{"detail": "..."}` message when present.
  String? _detailFrom(String body) {
    if (body.isEmpty) {
      return null;
    }
    final decoded = _tryDecodeJson(body);
    if (decoded is Map<String, Object?>) {
      final detail = decoded['detail'];
      if (detail is String && detail.isNotEmpty) {
        return detail;
      }
    }
    return null;
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(config: ref.watch(apiConfigProvider));
  ref.onDispose(client.close);
  return client;
});
