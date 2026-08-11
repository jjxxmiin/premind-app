import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:premind/app/theme.dart';
import 'package:premind/features/lectures/data/lecture_repository.dart';
import 'package:premind/features/lectures/domain/lecture.dart';
import 'package:premind/features/lectures/presentation/lecture_providers.dart';
import 'package:premind/features/sharing/presentation/lecture_share_sheet.dart';

void main() {
  testWidgets('creates a persisted mock share link from the selection sheet', (
    tester,
  ) async {
    final repository = _MemoryLectureRepository(_lecture);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [lectureRepositoryProvider.overrideWithValue(repository)],
        child: MaterialApp(
          theme: appTheme,
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: FilledButton(
                  onPressed: () => unawaited(
                    showLectureShareSheet(context, lectureId: _lecture.id),
                  ),
                  child: const Text('공유 열기'),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('공유 열기'));
    await tester.pumpAndSettle();

    expect(find.text('공유할 내용'), findsOneWidget);
    expect(find.text('강의 음성'), findsOneWidget);
    expect(find.text('AI 요약'), findsOneWidget);
    expect(find.text('핵심 내용'), findsOneWidget);
    expect(find.text('스크립트'), findsOneWidget);

    await tester.tap(find.text('공유 링크 만들기'));
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pumpAndSettle();

    expect(find.text('공유 링크를 만들었어요'), findsOneWidget);
    expect(find.text('링크 복사'), findsOneWidget);
    expect(find.text('공유하기'), findsOneWidget);
    expect(
      repository.lecture.shareUrl,
      'https://premind.co.kr/share/lecture-1',
    );
  });
}

final _lecture = Lecture(
  id: 'lecture-1',
  title: '인공지능 개론',
  createdAt: DateTime.utc(2026, 8, 8),
  duration: const Duration(minutes: 52),
  status: LectureStatus.completed,
  recordingType: RecordingType.audio,
  summary: '머신러닝의 기본 개념을 정리했습니다.',
  keyPoints: const ['머신러닝의 정의'],
);

class _MemoryLectureRepository implements LectureRepository {
  _MemoryLectureRepository(this.lecture);

  Lecture lecture;

  @override
  Future<Lecture> createLecture(Lecture lecture) async {
    this.lecture = lecture;
    return lecture;
  }

  @override
  Future<Lecture?> getLecture(String id) async {
    return id == lecture.id ? lecture : null;
  }

  @override
  Future<List<Lecture>> getLectures() async => [lecture];

  @override
  Future<void> saveLecture(Lecture lecture) async {
    this.lecture = lecture;
  }
}
