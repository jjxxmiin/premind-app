import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:premind/features/lectures/data/lecture_repository.dart';
import 'package:premind/features/lectures/data/mock_lecture_repository.dart';
import 'package:premind/features/lectures/domain/lecture.dart';

final lectureRepositoryProvider = Provider<LectureRepository>((ref) {
  return MockLectureRepository();
});

final lecturesProvider = AsyncNotifierProvider<LecturesNotifier, List<Lecture>>(
  LecturesNotifier.new,
);

class LecturesNotifier extends AsyncNotifier<List<Lecture>> {
  LectureRepository get _repository => ref.read(lectureRepositoryProvider);

  @override
  Future<List<Lecture>> build() => _repository.getLectures();

  Future<void> reload() async {
    state = const AsyncLoading<List<Lecture>>();
    try {
      state = AsyncData<List<Lecture>>(await _repository.getLectures());
    } on Object catch (error, stackTrace) {
      state = AsyncError<List<Lecture>>(error, stackTrace);
      Error.throwWithStackTrace(error, stackTrace);
    }
  }

  Future<void> addLecture(Lecture lecture) async {
    state = const AsyncLoading<List<Lecture>>();
    try {
      await _repository.createLecture(lecture);
      state = AsyncData<List<Lecture>>(await _repository.getLectures());
    } on Object catch (error, stackTrace) {
      state = AsyncError<List<Lecture>>(error, stackTrace);
      Error.throwWithStackTrace(error, stackTrace);
    }
  }

  Future<void> updateLecture(Lecture lecture) async {
    state = const AsyncLoading<List<Lecture>>();
    try {
      await _repository.saveLecture(lecture);
      state = AsyncData<List<Lecture>>(await _repository.getLectures());
    } on Object catch (error, stackTrace) {
      state = AsyncError<List<Lecture>>(error, stackTrace);
      Error.throwWithStackTrace(error, stackTrace);
    }
  }

  Future<void> add(Lecture lecture) => addLecture(lecture);
}
