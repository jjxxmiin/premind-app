enum LectureStatus {
  recording,
  uploadPending,
  uploading,
  processing,
  completed,
  failed,
}

enum RecordingType { audio, video }

const Object _unsetLectureValue = Object();

class LectureChapter {
  const LectureChapter({required this.timestamp, required this.title});

  final Duration timestamp;
  final String title;

  LectureChapter copyWith({Duration? timestamp, String? title}) {
    return LectureChapter(
      timestamp: timestamp ?? this.timestamp,
      title: title ?? this.title,
    );
  }

  Map<String, Object?> toJson() => <String, Object?>{
    'timestampMs': timestamp.inMilliseconds,
    'title': title,
  };

  factory LectureChapter.fromJson(Map<String, Object?> json) {
    return LectureChapter(
      timestamp: _readDuration(
        json,
        'timestampMs',
        fallbackKeys: const ['startTimeMs', 'timestamp'],
      ),
      title: _readRequiredString(json, 'title'),
    );
  }
}

class TranscriptSegment {
  const TranscriptSegment({required this.timestamp, required this.text});

  final Duration timestamp;
  final String text;

  TranscriptSegment copyWith({Duration? timestamp, String? text}) {
    return TranscriptSegment(
      timestamp: timestamp ?? this.timestamp,
      text: text ?? this.text,
    );
  }

  Map<String, Object?> toJson() => <String, Object?>{
    'timestampMs': timestamp.inMilliseconds,
    'text': text,
  };

  factory TranscriptSegment.fromJson(Map<String, Object?> json) {
    return TranscriptSegment(
      timestamp: _readDuration(
        json,
        'timestampMs',
        fallbackKeys: const ['startTimeMs', 'timestamp'],
      ),
      text: _readRequiredString(json, 'text'),
    );
  }
}

class LectureMarker {
  const LectureMarker({required this.timestamp, required this.label});

  final Duration timestamp;
  final String label;

  LectureMarker copyWith({Duration? timestamp, String? label}) {
    return LectureMarker(
      timestamp: timestamp ?? this.timestamp,
      label: label ?? this.label,
    );
  }

  Map<String, Object?> toJson() => <String, Object?>{
    'timestampMs': timestamp.inMilliseconds,
    'label': label,
  };

  factory LectureMarker.fromJson(Map<String, Object?> json) {
    return LectureMarker(
      timestamp: _readDuration(
        json,
        'timestampMs',
        fallbackKeys: const ['timestamp'],
      ),
      label: _readRequiredString(json, 'label'),
    );
  }
}

class Lecture {
  const Lecture({
    required this.id,
    required this.title,
    required this.createdAt,
    required this.duration,
    required this.status,
    required this.recordingType,
    this.localAudioPath,
    this.summary,
    this.keyPoints = const <String>[],
    this.chapters = const <LectureChapter>[],
    this.transcript = const <TranscriptSegment>[],
    this.markers = const <LectureMarker>[],
    this.shareUrl,
  });

  final String id;
  final String title;
  final DateTime createdAt;
  final Duration duration;
  final LectureStatus status;
  final RecordingType recordingType;
  final String? localAudioPath;
  final String? summary;
  final List<String> keyPoints;
  final List<LectureChapter> chapters;
  final List<TranscriptSegment> transcript;
  final List<LectureMarker> markers;
  final String? shareUrl;

  Lecture copyWith({
    String? id,
    String? title,
    DateTime? createdAt,
    Duration? duration,
    LectureStatus? status,
    RecordingType? recordingType,
    Object? localAudioPath = _unsetLectureValue,
    Object? summary = _unsetLectureValue,
    List<String>? keyPoints,
    List<LectureChapter>? chapters,
    List<TranscriptSegment>? transcript,
    List<LectureMarker>? markers,
    Object? shareUrl = _unsetLectureValue,
  }) {
    assert(
      identical(localAudioPath, _unsetLectureValue) ||
          localAudioPath == null ||
          localAudioPath is String,
      'localAudioPath must be a String or null.',
    );
    assert(
      identical(summary, _unsetLectureValue) ||
          summary == null ||
          summary is String,
      'summary must be a String or null.',
    );
    assert(
      identical(shareUrl, _unsetLectureValue) ||
          shareUrl == null ||
          shareUrl is String,
      'shareUrl must be a String or null.',
    );

    return Lecture(
      id: id ?? this.id,
      title: title ?? this.title,
      createdAt: createdAt ?? this.createdAt,
      duration: duration ?? this.duration,
      status: status ?? this.status,
      recordingType: recordingType ?? this.recordingType,
      localAudioPath: identical(localAudioPath, _unsetLectureValue)
          ? this.localAudioPath
          : localAudioPath as String?,
      summary: identical(summary, _unsetLectureValue)
          ? this.summary
          : summary as String?,
      keyPoints: keyPoints ?? this.keyPoints,
      chapters: chapters ?? this.chapters,
      transcript: transcript ?? this.transcript,
      markers: markers ?? this.markers,
      shareUrl: identical(shareUrl, _unsetLectureValue)
          ? this.shareUrl
          : shareUrl as String?,
    );
  }

  Map<String, Object?> toJson() => <String, Object?>{
    'id': id,
    'title': title,
    'createdAt': createdAt.toIso8601String(),
    'durationMs': duration.inMilliseconds,
    'status': status.name,
    'recordingType': recordingType.name,
    'localAudioPath': localAudioPath,
    'summary': summary,
    'keyPoints': keyPoints,
    'chapters': chapters.map((chapter) => chapter.toJson()).toList(),
    'transcript': transcript.map((segment) => segment.toJson()).toList(),
    'markers': markers.map((marker) => marker.toJson()).toList(),
    'shareUrl': shareUrl,
  };

  factory Lecture.fromJson(Map<String, Object?> json) {
    return Lecture(
      id: _readRequiredString(json, 'id'),
      title: _readRequiredString(json, 'title'),
      createdAt: _readDateTime(json, 'createdAt'),
      duration: _readDuration(
        json,
        'durationMs',
        fallbackKeys: const ['duration'],
      ),
      status: _readLectureStatus(json['status']),
      recordingType: _readRecordingType(json['recordingType']),
      localAudioPath: _readNullableString(json, 'localAudioPath'),
      summary: _readNullableString(json, 'summary'),
      keyPoints: _readStringList(json['keyPoints']),
      chapters: _readObjectList(json['chapters'], LectureChapter.fromJson),
      transcript: _readObjectList(
        json['transcript'],
        TranscriptSegment.fromJson,
      ),
      markers: _readObjectList(json['markers'], LectureMarker.fromJson),
      shareUrl: _readNullableString(json, 'shareUrl'),
    );
  }
}

String _readRequiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is String && value.isNotEmpty) {
    return value;
  }
  throw FormatException('Expected a non-empty string for "$key".');
}

String? _readNullableString(Map<String, Object?> json, String key) {
  final value = json[key];
  return value is String ? value : null;
}

DateTime _readDateTime(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is String) {
    final result = DateTime.tryParse(value);
    if (result != null) {
      return result;
    }
  }
  throw FormatException('Expected an ISO-8601 date for "$key".');
}

Duration _readDuration(
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

LectureStatus _readLectureStatus(Object? value) {
  final normalized = value == 'upload_pending' ? 'uploadPending' : value;
  return LectureStatus.values.firstWhere(
    (status) => status.name == normalized,
    orElse: () => throw FormatException('Unknown lecture status: $value'),
  );
}

RecordingType _readRecordingType(Object? value) {
  return RecordingType.values.firstWhere(
    (type) => type.name == value,
    orElse: () => throw FormatException('Unknown recording type: $value'),
  );
}

List<String> _readStringList(Object? value) {
  if (value is! List<Object?>) {
    return const <String>[];
  }
  return List<String>.unmodifiable(value.whereType<String>());
}

List<T> _readObjectList<T>(
  Object? value,
  T Function(Map<String, Object?> json) fromJson,
) {
  if (value is! List<Object?>) {
    return List<T>.empty(growable: false);
  }

  final result = <T>[];
  for (final item in value) {
    if (item is! Map) {
      continue;
    }
    try {
      result.add(fromJson(Map<String, Object?>.from(item)));
    } on FormatException {
      // Keep the valid parts of a locally persisted lecture.
    } on TypeError {
      // A malformed nested value should not invalidate the entire lecture.
    }
  }
  return List<T>.unmodifiable(result);
}
