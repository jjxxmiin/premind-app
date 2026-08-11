import 'dart:async';
import 'dart:convert';

import 'package:premind/features/lectures/data/lecture_repository.dart';
import 'package:premind/features/lectures/domain/lecture.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockLectureRepository implements LectureRepository {
  MockLectureRepository({
    Future<SharedPreferences> Function()? preferencesFactory,
  }) : _preferencesFactory =
           preferencesFactory ?? SharedPreferences.getInstance;

  static const _lecturesKey = 'premind.mock_lectures.v1';
  static const _seededKey = 'premind.mock_lectures_seeded.v1';

  // Shared across instances so multiple provider containers cannot overwrite
  // each other's read-modify-write operations in the same isolate.
  static Future<void> _operationTail = Future<void>.value();

  final Future<SharedPreferences> Function() _preferencesFactory;
  Future<SharedPreferences>? _preferences;

  Future<SharedPreferences> get _prefs =>
      _preferences ??= _preferencesFactory();

  @override
  Future<List<Lecture>> getLectures() {
    return _serialized(() async {
      final preferences = await _prefs;
      final lectures = await _loadWithInitialSeed(preferences);
      return _sortAndFreeze(lectures);
    });
  }

  @override
  Future<Lecture?> getLecture(String id) {
    return _serialized(() async {
      final preferences = await _prefs;
      final lectures = await _loadWithInitialSeed(preferences);
      for (final lecture in lectures) {
        if (lecture.id == id) {
          return lecture;
        }
      }
      return null;
    });
  }

  @override
  Future<Lecture> createLecture(Lecture lecture) {
    return _serialized(() async {
      final preferences = await _prefs;
      final lectures = await _loadWithInitialSeed(preferences);
      _upsert(lectures, lecture);
      await _persist(preferences, lectures);
      return lecture;
    });
  }

  @override
  Future<void> saveLecture(Lecture lecture) {
    return _serialized(() async {
      final preferences = await _prefs;
      final lectures = await _loadWithInitialSeed(preferences);
      _upsert(lectures, lecture);
      await _persist(preferences, lectures);
    });
  }

  Future<List<Lecture>> _loadWithInitialSeed(
    SharedPreferences preferences,
  ) async {
    final lectures = _decodeLectures(preferences.getString(_lecturesKey));
    final wasSeeded = preferences.getBool(_seededKey) ?? false;

    if (!wasSeeded) {
      final seed = _createSeedLecture();
      if (!lectures.any((lecture) => lecture.id == seed.id)) {
        lectures.add(seed);
      }

      // Data is written before the marker. A failure can therefore cause a
      // harmless retry, but never a marker that points at missing seed data.
      await _persist(preferences, lectures);
      final didSaveMarker = await preferences.setBool(_seededKey, true);
      if (!didSaveMarker) {
        throw StateError('Could not persist the lecture seed marker.');
      }
    }

    return lectures;
  }

  List<Lecture> _decodeLectures(String? encoded) {
    if (encoded == null || encoded.isEmpty) {
      return <Lecture>[];
    }

    Object? decoded;
    try {
      decoded = jsonDecode(encoded);
    } on FormatException {
      return <Lecture>[];
    }

    if (decoded is! List) {
      return <Lecture>[];
    }

    final lectures = <Lecture>[];
    for (final value in decoded) {
      if (value is! Map) {
        continue;
      }
      try {
        lectures.add(Lecture.fromJson(Map<String, Object?>.from(value)));
      } on FormatException {
        // Skip only the damaged record and keep the rest of the library.
      } on TypeError {
        // Skip only the damaged record and keep the rest of the library.
      }
    }
    return lectures;
  }

  Future<void> _persist(
    SharedPreferences preferences,
    List<Lecture> lectures,
  ) async {
    final encoded = jsonEncode(
      lectures.map((lecture) => lecture.toJson()).toList(),
    );
    final didSave = await preferences.setString(_lecturesKey, encoded);
    if (!didSave) {
      throw StateError('Could not persist lectures.');
    }
  }

  void _upsert(List<Lecture> lectures, Lecture lecture) {
    final index = lectures.indexWhere((item) => item.id == lecture.id);
    if (index == -1) {
      lectures.add(lecture);
    } else {
      lectures[index] = lecture;
    }
  }

  List<Lecture> _sortAndFreeze(List<Lecture> lectures) {
    lectures.sort((left, right) => right.createdAt.compareTo(left.createdAt));
    return List<Lecture>.unmodifiable(lectures);
  }

  Future<T> _serialized<T>(Future<T> Function() operation) {
    final completer = Completer<T>();
    _operationTail = _operationTail.then((_) async {
      try {
        completer.complete(await operation());
      } on Object catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });
    return completer.future;
  }

  Lecture _createSeedLecture() {
    return Lecture(
      id: 'mock-ai-introduction',
      title: '인공지능 개론',
      createdAt: DateTime.now().subtract(const Duration(days: 2)),
      duration: const Duration(minutes: 52, seconds: 14),
      status: LectureStatus.completed,
      recordingType: RecordingType.audio,
      summary: '오늘 강의에서는 머신러닝의 기본 개념과 지도학습 원리를 중심으로 설명했습니다.',
      keyPoints: const <String>['머신러닝의 정의', '지도학습과 비지도학습', '학습 데이터의 역할'],
      chapters: const <LectureChapter>[
        LectureChapter(
          timestamp: Duration(minutes: 12, seconds: 31),
          title: '지도학습 설명',
        ),
        LectureChapter(
          timestamp: Duration(minutes: 28, seconds: 14),
          title: '실제 활용 사례',
        ),
        LectureChapter(
          timestamp: Duration(minutes: 32, seconds: 18),
          title: '교수자 중요 표시',
        ),
      ],
      transcript: const <TranscriptSegment>[
        TranscriptSegment(
          timestamp: Duration(minutes: 1, seconds: 12),
          text: '오늘은 머신러닝의 기본 개념부터 알아보겠습니다.',
        ),
        TranscriptSegment(
          timestamp: Duration(minutes: 2, seconds: 51),
          text: '머신러닝은 데이터를 통해 패턴을 학습하는 기술입니다.',
        ),
      ],
      markers: const <LectureMarker>[
        LectureMarker(
          timestamp: Duration(minutes: 32, seconds: 18),
          label: '교수자 중요 표시',
        ),
      ],
    );
  }
}
