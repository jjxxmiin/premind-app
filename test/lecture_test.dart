import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:premind/features/lectures/domain/lecture.dart';

void main() {
  group('Lecture', () {
    test('round-trips every field through JSON', () {
      final original = _lecture();

      final decoded = jsonDecode(jsonEncode(original.toJson()));
      final restored = Lecture.fromJson(
        Map<String, Object?>.from(decoded as Map),
      );

      expect(restored.id, original.id);
      expect(restored.title, original.title);
      expect(restored.createdAt, original.createdAt);
      expect(restored.duration, original.duration);
      expect(restored.status, original.status);
      expect(restored.recordingType, original.recordingType);
      expect(restored.localAudioPath, original.localAudioPath);
      expect(restored.summary, original.summary);
      expect(restored.keyPoints, original.keyPoints);
      expect(restored.shareUrl, original.shareUrl);

      expect(restored.chapters, hasLength(1));
      expect(restored.chapters.single.timestamp, const Duration(minutes: 4));
      expect(restored.chapters.single.title, '핵심 개념');
      expect(restored.transcript, hasLength(1));
      expect(
        restored.transcript.single.timestamp,
        const Duration(minutes: 4, seconds: 3),
      );
      expect(restored.transcript.single.text, '중요한 설명입니다.');
      expect(restored.markers, hasLength(1));
      expect(restored.markers.single.timestamp, const Duration(minutes: 5));
      expect(restored.markers.single.label, '시험 출제');
    });

    test('copyWith retains omitted nullable fields and can clear them', () {
      final original = _lecture();

      final retained = original.copyWith(title: '수정된 강의');
      expect(retained.localAudioPath, original.localAudioPath);
      expect(retained.summary, original.summary);
      expect(retained.shareUrl, original.shareUrl);

      final cleared = original.copyWith(
        localAudioPath: null,
        summary: null,
        shareUrl: null,
      );
      expect(cleared.localAudioPath, isNull);
      expect(cleared.summary, isNull);
      expect(cleared.shareUrl, isNull);
      expect(cleared.id, original.id);
      expect(cleared.title, original.title);
    });
  });
}

Lecture _lecture() {
  return Lecture(
    id: 'lecture-json',
    title: '자료구조',
    createdAt: DateTime.utc(2026, 8, 8, 1, 2, 3),
    duration: const Duration(minutes: 47, seconds: 19),
    status: LectureStatus.completed,
    recordingType: RecordingType.audio,
    localAudioPath: '/tmp/lecture-json.m4a',
    summary: '자료구조의 핵심을 정리했습니다.',
    keyPoints: const ['스택', '큐'],
    chapters: const [
      LectureChapter(timestamp: Duration(minutes: 4), title: '핵심 개념'),
    ],
    transcript: const [
      TranscriptSegment(
        timestamp: Duration(minutes: 4, seconds: 3),
        text: '중요한 설명입니다.',
      ),
    ],
    markers: const [
      LectureMarker(timestamp: Duration(minutes: 5), label: '시험 출제'),
    ],
    shareUrl: 'https://premind.example/lecture-json',
  );
}
