import 'package:flutter_test/flutter_test.dart';
import 'package:premind/features/lectures/data/mock_lecture_repository.dart';
import 'package:premind/features/lectures/domain/lecture.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('MockLectureRepository', () {
    setUp(() {
      SharedPreferences.setMockInitialValues(<String, Object>{});
    });

    test('seeds the sample lecture once and persists it', () async {
      final firstRepository = MockLectureRepository();

      final firstLoad = await firstRepository.getLectures();
      expect(firstLoad, hasLength(1));
      expect(firstLoad.single.id, 'mock-ai-introduction');
      expect(firstLoad.single.status, LectureStatus.completed);

      final secondLoad = await firstRepository.getLectures();
      expect(secondLoad.map((lecture) => lecture.id), ['mock-ai-introduction']);

      final recreatedRepository = MockLectureRepository();
      final restored = await recreatedRepository.getLectures();
      expect(restored.map((lecture) => lecture.id), ['mock-ai-introduction']);
    });

    test('creates, reads, updates, and restores a lecture', () async {
      final repository = MockLectureRepository();
      final lecture = _lecture(title: '운영체제');

      final created = await repository.createLecture(lecture);
      expect(created.id, lecture.id);
      expect((await repository.getLecture(lecture.id))?.title, '운영체제');

      await repository.saveLecture(
        lecture.copyWith(
          title: '운영체제 - 수정',
          status: LectureStatus.processing,
          summary: null,
        ),
      );

      final updated = await repository.getLecture(lecture.id);
      expect(updated?.title, '운영체제 - 수정');
      expect(updated?.status, LectureStatus.processing);
      expect(updated?.summary, isNull);

      final recreatedRepository = MockLectureRepository();
      final restored = await recreatedRepository.getLecture(lecture.id);
      expect(restored?.title, '운영체제 - 수정');
      expect(restored?.duration, const Duration(minutes: 40));

      final allLectures = await recreatedRepository.getLectures();
      expect(allLectures.where((item) => item.id == lecture.id), hasLength(1));
      expect(allLectures.first.id, lecture.id);
    });
  });
}

Lecture _lecture({required String title}) {
  return Lecture(
    id: 'lecture-crud',
    title: title,
    createdAt: DateTime.utc(2030),
    duration: const Duration(minutes: 40),
    status: LectureStatus.completed,
    recordingType: RecordingType.audio,
    summary: '업데이트 전에 존재하는 요약',
  );
}
