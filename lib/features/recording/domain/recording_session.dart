enum RecordingSessionStatus { recording, paused, completed, failed }

enum UploadStatus { pending, uploading, completed, failed }

const Object _unsetRecordingValue = Object();

class RecordingMarker {
  const RecordingMarker({required this.timestamp, required this.createdAt});

  final Duration timestamp;
  final DateTime createdAt;

  RecordingMarker copyWith({Duration? timestamp, DateTime? createdAt}) {
    return RecordingMarker(
      timestamp: timestamp ?? this.timestamp,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  Map<String, Object?> toJson() => <String, Object?>{
    'timestampMs': timestamp.inMilliseconds,
    'createdAt': createdAt.toIso8601String(),
  };

  factory RecordingMarker.fromJson(Map<String, Object?> json) {
    return RecordingMarker(
      timestamp: _readRecordingDuration(
        json,
        'timestampMs',
        fallbackKeys: const ['timestamp'],
      ),
      createdAt: _readRecordingDateTime(json, 'createdAt'),
    );
  }
}

class RecordingSession {
  const RecordingSession({
    required this.id,
    required this.lectureId,
    required this.startedAt,
    required this.localFilePath,
    required this.duration,
    required this.status,
    required this.uploadStatus,
    this.endedAt,
    this.markers = const <RecordingMarker>[],
  });

  final String id;
  final String lectureId;
  final DateTime startedAt;
  final DateTime? endedAt;
  final String localFilePath;
  final Duration duration;
  final RecordingSessionStatus status;
  final UploadStatus uploadStatus;
  final List<RecordingMarker> markers;

  RecordingSession copyWith({
    String? id,
    String? lectureId,
    DateTime? startedAt,
    Object? endedAt = _unsetRecordingValue,
    String? localFilePath,
    Duration? duration,
    RecordingSessionStatus? status,
    UploadStatus? uploadStatus,
    List<RecordingMarker>? markers,
  }) {
    assert(
      identical(endedAt, _unsetRecordingValue) ||
          endedAt == null ||
          endedAt is DateTime,
      'endedAt must be a DateTime or null.',
    );

    return RecordingSession(
      id: id ?? this.id,
      lectureId: lectureId ?? this.lectureId,
      startedAt: startedAt ?? this.startedAt,
      endedAt: identical(endedAt, _unsetRecordingValue)
          ? this.endedAt
          : endedAt as DateTime?,
      localFilePath: localFilePath ?? this.localFilePath,
      duration: duration ?? this.duration,
      status: status ?? this.status,
      uploadStatus: uploadStatus ?? this.uploadStatus,
      markers: markers ?? this.markers,
    );
  }

  Map<String, Object?> toJson() => <String, Object?>{
    'id': id,
    'lectureId': lectureId,
    'startedAt': startedAt.toIso8601String(),
    'endedAt': endedAt?.toIso8601String(),
    'localFilePath': localFilePath,
    'durationMs': duration.inMilliseconds,
    'status': status.name,
    'uploadStatus': uploadStatus.name,
    'markers': markers.map((marker) => marker.toJson()).toList(),
  };

  factory RecordingSession.fromJson(Map<String, Object?> json) {
    return RecordingSession(
      id: _readRecordingString(json, 'id'),
      lectureId: _readRecordingString(json, 'lectureId'),
      startedAt: _readRecordingDateTime(json, 'startedAt'),
      endedAt: _readNullableRecordingDateTime(json, 'endedAt'),
      localFilePath: _readRecordingString(json, 'localFilePath'),
      duration: _readRecordingDuration(
        json,
        'durationMs',
        fallbackKeys: const ['duration'],
      ),
      status: _readRecordingStatus(json['status']),
      uploadStatus: _readUploadStatus(json['uploadStatus']),
      markers: _readRecordingMarkers(json['markers']),
    );
  }
}

String _readRecordingString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is String && value.isNotEmpty) {
    return value;
  }
  throw FormatException('Expected a non-empty string for "$key".');
}

DateTime _readRecordingDateTime(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is String) {
    final result = DateTime.tryParse(value);
    if (result != null) {
      return result;
    }
  }
  throw FormatException('Expected an ISO-8601 date for "$key".');
}

DateTime? _readNullableRecordingDateTime(
  Map<String, Object?> json,
  String key,
) {
  final value = json[key];
  if (value == null) {
    return null;
  }
  if (value is String) {
    return DateTime.tryParse(value);
  }
  return null;
}

Duration _readRecordingDuration(
  Map<String, Object?> json,
  String key, {
  List<String> fallbackKeys = const <String>[],
}) {
  for (final candidate in <String>[key, ...fallbackKeys]) {
    final value = json[candidate];
    if (value is num) {
      return Duration(milliseconds: value.round());
    }
    if (value is String) {
      final milliseconds = int.tryParse(value);
      if (milliseconds != null) {
        return Duration(milliseconds: milliseconds);
      }
    }
  }
  throw FormatException('Expected a duration in milliseconds for "$key".');
}

RecordingSessionStatus _readRecordingStatus(Object? value) {
  return RecordingSessionStatus.values.firstWhere(
    (status) => status.name == value,
    orElse: () => throw FormatException('Unknown recording status: $value'),
  );
}

UploadStatus _readUploadStatus(Object? value) {
  return UploadStatus.values.firstWhere(
    (status) => status.name == value,
    orElse: () => throw FormatException('Unknown upload status: $value'),
  );
}

List<RecordingMarker> _readRecordingMarkers(Object? value) {
  if (value is! List<Object?>) {
    return const <RecordingMarker>[];
  }

  final result = <RecordingMarker>[];
  for (final item in value) {
    if (item is! Map) {
      continue;
    }
    try {
      result.add(RecordingMarker.fromJson(Map<String, Object?>.from(item)));
    } on FormatException {
      // Keep valid markers even when a persisted marker is malformed.
    } on TypeError {
      // Keep valid markers even when a persisted marker is malformed.
    }
  }
  return List<RecordingMarker>.unmodifiable(result);
}
