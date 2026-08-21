import 'package:premind/core/network/api_client.dart';
import 'package:premind/features/recording/domain/recording_session.dart';

/// Server-side lifecycle of an upload session.
enum UploadSessionStatus { pending, completed }

/// The state of a resumable upload session as the server reports it.
///
/// Returned by both `POST /api/uploads` and `GET /api/uploads/{id}`, which
/// share a payload shape.
class UploadSessionState {
  const UploadSessionState({
    required this.uploadId,
    required this.chunkSize,
    required this.totalBytes,
    required this.receivedChunks,
    required this.status,
    this.videoId,
  });

  final String uploadId;

  /// Decided by the server. The local file must be split with this value.
  final int chunkSize;
  final int totalBytes;

  /// Zero-based indexes the server already holds — the resume point.
  final List<int> receivedChunks;
  final UploadSessionStatus status;
  final String? videoId;

  bool get isCompleted => status == UploadSessionStatus.completed;
}

/// The server's acknowledgement of a single chunk.
class UploadChunkReceipt {
  const UploadChunkReceipt({
    required this.receivedChunks,
    required this.receivedBytes,
  });

  final List<int> receivedChunks;
  final int receivedBytes;
}

/// The result of finalising an upload session.
class UploadCompletion {
  const UploadCompletion({required this.uploadId, required this.videoId});

  final String uploadId;
  final String videoId;
}

/// The resumable upload endpoints, typed.
///
/// Implementations never resolve authentication themselves: the caller passes
/// an access token it has already refreshed, so token handling stays in one
/// place and this seam stays trivial to fake in tests.
abstract interface class UploadApi {
  /// Creates (or recovers) the upload session for [clientReference].
  ///
  /// The server is idempotent on [clientReference], so re-initialising after
  /// losing the upload id returns the same session and its received chunks.
  Future<UploadSessionState> createSession({
    required String accessToken,
    required String filename,
    required int totalBytes,
    required String contentType,
    required String title,
    required int durationMs,
    required String clientReference,
    required List<RecordingMarker> markers,
  });

  Future<UploadSessionState> getSession({
    required String accessToken,
    required String uploadId,
  });

  /// Uploads the chunk at [index]. Idempotent: re-sending overwrites.
  Future<UploadChunkReceipt> putChunk({
    required String accessToken,
    required String uploadId,
    required int index,
    required List<int> bytes,
  });

  /// Finalises the session. Idempotent: repeating returns the same video id.
  Future<UploadCompletion> completeSession({
    required String accessToken,
    required String uploadId,
  });

  Future<void> abandonSession({
    required String accessToken,
    required String uploadId,
  });
}

/// [UploadApi] over the PREMIND HTTP API.
class HttpUploadApi implements UploadApi {
  HttpUploadApi({required ApiClient apiClient}) : _apiClient = apiClient;

  static const _basePath = '/api/uploads';

  final ApiClient _apiClient;

  @override
  Future<UploadSessionState> createSession({
    required String accessToken,
    required String filename,
    required int totalBytes,
    required String contentType,
    required String title,
    required int durationMs,
    required String clientReference,
    required List<RecordingMarker> markers,
  }) async {
    final response = await _apiClient.postJson(_basePath, <String, Object?>{
      'filename': filename,
      'total_bytes': totalBytes,
      'content_type': contentType,
      'title': title,
      'duration_ms': durationMs,
      'client_reference': clientReference,
      'markers': markers
          .map(
            (marker) => <String, Object?>{
              'timestamp_ms': marker.timestamp.inMilliseconds,
              'created_at': marker.createdAt.toIso8601String(),
            },
          )
          .toList(growable: false),
    }, headers: _authHeaders(accessToken));
    return _sessionFrom(response);
  }

  @override
  Future<UploadSessionState> getSession({
    required String accessToken,
    required String uploadId,
  }) async {
    final response = await _apiClient.getJson(
      '$_basePath/${Uri.encodeComponent(uploadId)}',
      headers: _authHeaders(accessToken),
    );
    return _sessionFrom(response);
  }

  @override
  Future<UploadChunkReceipt> putChunk({
    required String accessToken,
    required String uploadId,
    required int index,
    required List<int> bytes,
  }) async {
    final response = await _apiClient.putBytes(
      '$_basePath/${Uri.encodeComponent(uploadId)}/chunks/$index',
      bytes,
      headers: _authHeaders(accessToken),
    );
    return UploadChunkReceipt(
      receivedChunks: _intList(response['received_chunks']),
      receivedBytes: _optionalInt(response['received_bytes']) ?? 0,
    );
  }

  @override
  Future<UploadCompletion> completeSession({
    required String accessToken,
    required String uploadId,
  }) async {
    final response = await _apiClient.postJson(
      '$_basePath/${Uri.encodeComponent(uploadId)}/complete',
      const <String, Object?>{},
      headers: _authHeaders(accessToken),
    );
    final videoId = response['video_id'];
    if (videoId == null) {
      throw const ApiException(
        message: 'The server completed the upload without a video id.',
      );
    }
    return UploadCompletion(
      uploadId: _optionalString(response['upload_id']) ?? uploadId,
      videoId: '$videoId',
    );
  }

  @override
  Future<void> abandonSession({
    required String accessToken,
    required String uploadId,
  }) {
    return _apiClient.deleteJson(
      '$_basePath/${Uri.encodeComponent(uploadId)}',
      headers: _authHeaders(accessToken),
    );
  }

  Map<String, String> _authHeaders(String accessToken) => <String, String>{
    'Authorization': 'Bearer $accessToken',
  };

  UploadSessionState _sessionFrom(Map<String, Object?> response) {
    final uploadId = _optionalString(response['upload_id']);
    final chunkSize = _optionalInt(response['chunk_size']);
    if (uploadId == null || chunkSize == null || chunkSize <= 0) {
      throw const ApiException(
        message: 'The server returned an unexpected upload session.',
      );
    }
    return UploadSessionState(
      uploadId: uploadId,
      chunkSize: chunkSize,
      totalBytes: _optionalInt(response['total_bytes']) ?? 0,
      receivedChunks: _intList(response['received_chunks']),
      status: response['status'] == 'completed'
          ? UploadSessionStatus.completed
          : UploadSessionStatus.pending,
      videoId: _optionalString(response['video_id']),
    );
  }

  String? _optionalString(Object? value) {
    if (value is String && value.isNotEmpty) {
      return value;
    }
    return null;
  }

  int? _optionalInt(Object? value) {
    if (value is num) {
      return value.round();
    }
    if (value is String) {
      return int.tryParse(value);
    }
    return null;
  }

  List<int> _intList(Object? value) {
    if (value is! List<Object?>) {
      return const <int>[];
    }
    final result = <int>[];
    for (final item in value) {
      final parsed = _optionalInt(item);
      if (parsed != null && parsed >= 0) {
        result.add(parsed);
      }
    }
    return result;
  }
}
