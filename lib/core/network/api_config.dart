import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Resolves the PREMIND API origin used by [ApiClient] consumers.
///
/// Production builds must pass the real origin at build time, e.g.
/// `flutter build apk --dart-define=API_BASE_URL=https://api.premind.app`.
/// When no value is provided the config falls back to the local development
/// server: `http://10.0.2.2:8000` on Android emulators (the host loopback as
/// seen from the emulator) and `http://127.0.0.1:8000` everywhere else.
class ApiConfig {
  ApiConfig({String? baseUrl})
    : baseUrl = _normalize(baseUrl ?? _resolveBaseUrl());

  /// The API origin without a trailing slash, e.g. `https://api.premind.app`.
  final String baseUrl;

  static const _definedBaseUrl = String.fromEnvironment('API_BASE_URL');

  static String _resolveBaseUrl() {
    if (_definedBaseUrl.isNotEmpty) {
      return _definedBaseUrl;
    }
    if (!kIsWeb && Platform.isAndroid) {
      return 'http://10.0.2.2:8000';
    }
    return 'http://127.0.0.1:8000';
  }

  static String _normalize(String baseUrl) {
    var normalized = baseUrl.trim();
    while (normalized.endsWith('/')) {
      normalized = normalized.substring(0, normalized.length - 1);
    }
    return normalized;
  }
}

final apiConfigProvider = Provider<ApiConfig>((ref) {
  return ApiConfig();
});
