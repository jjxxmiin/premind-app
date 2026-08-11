import 'package:premind/features/lectures/domain/lecture.dart';

abstract interface class LectureRepository {
  Future<List<Lecture>> getLectures();

  Future<Lecture?> getLecture(String id);

  Future<Lecture> createLecture(Lecture lecture);

  Future<void> saveLecture(Lecture lecture);
}
