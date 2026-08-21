import 'package:premind/features/recording/domain/recording_session.dart';

/// Lifecycle of a queued recording upload.
///
/// [failed] covers both a transient failure that is waiting for its backoff
/// window and a permanent one. The two are told apart by [UploadJob.isTerminal]
/// rather than by a separate enum value, so a job that will never succeed can
/// stay visible in the queue without being retried forever.
enum UploadJobStatus { queued, uploading, completed, failed, cancelled }

const Object _unsetUploadValue = Object();

/// A recording waiting to be uploaded to the PREMIND API in resumable chunks.
///
/// [id] is the recording session id, which is also the `client_reference` sent
/// to the server. Re-initialising with the same reference returns the same
/// server-side session, so a job that lost its [uploadId] can always recover.
class UploadJob {
  const UploadJob({
    required this.id,
    required this.lectureId,
    required this.filePath,
    required this.title,
    required this.durationMs,
    required this.totalBytes,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.uploadId,
    this.chunkSize,
    this.uploadedChunks = const <int>[],
    this.attempts = 0,
    this.lastError,
    this.nextAttemptAt,
    this.videoId,
  });

  /// Builds a freshly queued job for a finished recording [session].
  factory UploadJob.forRecording({
    required RecordingSession session,
    required String title,
    required int totalBytes,
    DateTime? now,
  }) {
    final timestamp = now ?? DateTime.now();
    return UploadJob(
      id: session.id,
      lectureId: session.lectureId,
      filePath: session.localFilePath,
      title: title,
      durationMs: session.duration.inMilliseconds,
      totalBytes: totalBytes,
      status: UploadJobStatus.queued,
      createdAt: timestamp,
      updatedAt: timestamp,
    );
  }

  /// The recording session id, reused as the server-side `client_reference`.
  final String id;
  final String lectureId;
  final String filePath;
  final String title;
  final int durationMs;
  final int totalBytes;

  /// The server-assigned upload session id, null until the session is created.
  final String? uploadId;

  /// The chunk size chosen by the server. Never assume a client-side value:
  /// chunk indexes are meaningless without the server's size.
  final int? chunkSize;

  /// Zero-based indexes the server has confirmed, ascending and deduplicated.
  final List<int> uploadedChunks;
  final UploadJobStatus status;
  final int attempts;
  final String? lastError;

  /// When the next retry may start. Null on a [UploadJobStatus.failed] job
  /// means the failure is permanent — see [isTerminal].
  final DateTime? nextAttemptAt;
  final String? videoId;
  final DateTime createdAt;
  final DateTime updatedAt;

  /// Fraction of the file the server has confirmed, from 0.0 to 1.0.
  double get progress {
    if (status == UploadJobStatus.completed) {
      return 1;
    }
    final size = chunkSize;
    if (size == null || size <= 0 || totalBytes <= 0) {
      return 0;
    }
    final ratio = (uploadedChunks.length * size) / totalBytes;
    if (ratio.isNaN || ratio <= 0) {
      return 0;
    }
    return ratio > 1 ? 1 : ratio;
  }

  /// True when the job failed permanently and must not be retried, for example
  /// because the recording file is gone or the user must sign in again.
  bool get isTerminal =>
      status == UploadJobStatus.failed && nextAttemptAt == null;

  /// True while the job is waiting out its retry backoff.
  bool get isRetryPending =>
      status == UploadJobStatus.failed && nextAttemptAt != null;

  /// True when the queue runner may pick this job up at [now].
  bool isReadyAt(DateTime now) {
    if (status == UploadJobStatus.completed ||
        status == UploadJobStatus.cancelled ||
        isTerminal) {
      return false;
    }
    final next = nextAttemptAt;
    return next == null || !next.isAfter(now);
  }

  UploadJob copyWith({
    String? id,
    String? lectureId,
    String? filePath,
    String? title,
    int? durationMs,
    int? totalBytes,
    Object? uploadId = _unsetUploadValue,
    Object? chunkSize = _unsetUploadValue,
    List<int>? uploadedChunks,
    UploadJobStatus? status,
    int? attempts,
    Object? lastError = _unsetUploadValue,
    Object? nextAttemptAt = _unsetUploadValue,
    Object? videoId = _unsetUploadValue,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    assert(
      identical(uploadId, _unsetUploadValue) ||
          uploadId == null ||
          uploadId is String,
      'uploadId must be a String or null.',
    );
    assert(
      identical(chunkSize, _unsetUploadValue) ||
          chunkSize == null ||
          chunkSize is int,
      'chunkSize must be an int or null.',
    );
    assert(
      identical(lastError, _unsetUploadValue) ||
          lastError == null ||
          lastError is String,
      'lastError must be a String or null.',
    );
    assert(
      identical(nextAttemptAt, _unsetUploadValue) ||
          nextAttemptAt == null ||
          nextAttemptAt is DateTime,
      'nextAttemptAt must be a DateTime or null.',
    );
    assert(
      identical(videoId, _unsetUploadValue) ||
          videoId == null ||
          videoId is String,
      'videoId must be a String or null.',
    );

    return UploadJob(
      id: id ?? this.id,
      lectureId: lectureId ?? this.lectureId,
      filePath: filePath ?? this.filePath,
      title: title ?? this.title,
      durationMs: durationMs ?? this.durationMs,
      totalBytes: totalBytes ?? this.totalBytes,
      uploadId: identical(uploadId, _unsetUploadValue)
          ? this.uploadId
          : uploadId as String?,
      chunkSize: identical(chunkSize, _unsetUploadValue)
          ? this.chunkSize
          : chunkSize as int?,
      uploadedChunks: uploadedChunks == null
          ? this.uploadedChunks
          : normalizeChunks(uploadedChunks),
      status: status ?? this.status,
      attempts: attempts ?? this.attempts,
      lastError: identical(lastError, _unsetUploadValue)
          ? this.lastError
          : lastError as String?,
      nextAttemptAt: identical(nextAttemptAt, _unsetUploadValue)
          ? this.nextAttemptAt
          : nextAttemptAt as DateTime?,
      videoId: identical(videoId, _unsetUploadValue)
          ? this.videoId
          : videoId as String?,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, Object?> toJson() => <String, Object?>{
    'id': id,
    'lectureId': lectureId,
    'filePath': filePath,
    'title': title,
    'durationMs': durationMs,
    'totalBytes': totalBytes,
    'uploadId': uploadId,
    'chunkSize': chunkSize,
    'uploadedChunks': uploadedChunks,
    'status': status.name,
    'attempts': attempts,
    'lastError': lastError,
    'nextAttemptAt': nextAttemptAt?.toIso8601String(),
    'videoId': videoId,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };

  factory UploadJob.fromJson(Map<String, Object?> json) {
    final createdAt = _readUploadDateTime(json, 'createdAt');
    return UploadJob(
      id: _readUploadString(json, 'id'),
      lectureId: _readUploadString(json, 'lectureId'),
      filePath: _readUploadString(json, 'filePath'),
      title: _readUploadString(json, 'title'),
      durationMs: _readUploadInt(json, 'durationMs'),
      totalBytes: _readUploadInt(json, 'totalBytes'),
      uploadId: _readNullableUploadString(json, 'uploadId'),
      chunkSize: _readNullableUploadInt(json, 'chunkSize'),
      uploadedChunks: normalizeChunks(
        _readUploadIntList(json['uploadedChunks']),
      ),
      status: _readUploadJobStatus(json['status']),
      attempts: _readNullableUploadInt(json, 'attempts') ?? 0,
      lastError: _readNullableUploadString(json, 'lastError'),
      nextAttemptAt: _readNullableUploadDateTime(json, 'nextAttemptAt'),
      videoId: _readNullableUploadString(json, 'videoId'),
      createdAt: createdAt,
      updatedAt: _readNullableUploadDateTime(json, 'updatedAt') ?? createdAt,
    );
  }

  /// Returns [chunks] ascending and without duplicates or negative indexes.
  static List<int> normalizeChunks(Iterable<int> chunks) {
    final unique = chunks.where((index) => index >= 0).toSet().toList()..sort();
    return List<int>.unmodifiable(unique);
  }
}

String _readUploadString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is String && value.isNotEmpty) {
    return value;
  }
  throw FormatException('Expected a non-empty string for "$key".');
}

String? _readNullableUploadString(Map<String, Object?> json, String key) {
  final value = json[key];
  return value is String && value.isNotEmpty ? value : null;
}

int _readUploadInt(Map<String, Object?> json, String key) {
  final value = _readNullableUploadInt(json, key);
  if (value == null) {
    throw FormatException('Expected an integer for "$key".');
  }
  return value;
}

int? _readNullableUploadInt(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is num) {
    return value.round();
  }
  if (value is String) {
    return int.tryParse(value);
  }
  return null;
}

DateTime _readUploadDateTime(Map<String, Object?> json, String key) {
  final value = _readNullableUploadDateTime(json, key);
  if (value == null) {
    throw FormatException('Expected an ISO-8601 date for "$key".');
  }
  return value;
}

DateTime? _readNullableUploadDateTime(Map<String, Object?> json, String key) {
  final value = json[key];
  return value is String ? DateTime.tryParse(value) : null;
}

List<int> _readUploadIntList(Object? value) {
  if (value is! List<Object?>) {
    return const <int>[];
  }
  final result = <int>[];
  for (final item in value) {
    if (item is num) {
      result.add(item.round());
    } else if (item is String) {
      final parsed = int.tryParse(item);
      if (parsed != null) {
        result.add(parsed);
      }
    }
  }
  return result;
}

UploadJobStatus _readUploadJobStatus(Object? value) {
  return UploadJobStatus.values.firstWhere(
    (status) => status.name == value,
    orElse: () => throw FormatException('Unknown upload job status: $value'),
  );
}
