import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:premind/features/recording/data/recording_session_repository.dart';
import 'package:premind/features/recording/domain/recording_session.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _sessionsKey = 'premind.recording_sessions.v1';

void main() {
  group('RecordingSessionRepository', () {
    setUp(() {
      SharedPreferences.setMockInitialValues(<String, Object>{});
    });

    test('saves, gets, restores, and filters recoverable sessions', () async {
      final repository = RecordingSessionRepository();
      final active = _session(
        id: 'active',
        startedAt: DateTime.utc(2026, 8, 8, 3),
        status: RecordingSessionStatus.recording,
        uploadStatus: UploadStatus.pending,
      );
      final awaitingUpload = _session(
        id: 'awaiting-upload',
        startedAt: DateTime.utc(2026, 8, 8, 2),
        status: RecordingSessionStatus.completed,
        uploadStatus: UploadStatus.pending,
      );
      final fullyCompleted = _session(
        id: 'complete',
        startedAt: DateTime.utc(2026, 8, 8, 1),
        status: RecordingSessionStatus.completed,
        uploadStatus: UploadStatus.completed,
      );

      await repository.save(fullyCompleted);
      await repository.save(awaitingUpload);
      await repository.save(active);

      final loaded = await repository.get('active');
      expect(loaded?.lectureId, 'lecture-active');
      expect(loaded?.markers, hasLength(1));
      expect(loaded?.duration, const Duration(minutes: 12));

      final recoverable = await repository.getRecoverable();
      expect(recoverable.map((session) => session.id), [
        'active',
        'awaiting-upload',
      ]);

      final recreatedRepository = RecordingSessionRepository();
      expect((await recreatedRepository.get('complete'))?.id, 'complete');
      expect(await recreatedRepository.get('missing'), isNull);

      await recreatedRepository.remove('active');
      expect(await recreatedRepository.get('active'), isNull);
      expect(
        (await recreatedRepository.getRecoverable()).map(
          (session) => session.id,
        ),
        ['awaiting-upload'],
      );
    });

    test('skips a malformed record and keeps valid recovery data', () async {
      final valid = _session(
        id: 'valid',
        startedAt: DateTime.utc(2026, 8, 8),
        status: RecordingSessionStatus.paused,
        uploadStatus: UploadStatus.pending,
      ).toJson();
      valid['markers'] = <Object?>[
        ...valid['markers']! as List<Object?>,
        <String, Object?>{'timestampMs': 'not-a-duration'},
      ];
      SharedPreferences.setMockInitialValues(<String, Object>{
        _sessionsKey: jsonEncode(<Object?>[
          valid,
          <String, Object?>{'id': 'damaged'},
          'not-an-object',
        ]),
      });

      final repository = RecordingSessionRepository();
      final all = await repository.getAll();
      final recoverable = await repository.getRecoverable();

      expect(all, hasLength(1));
      expect(all.single.id, 'valid');
      expect(all.single.markers, hasLength(1));
      expect(recoverable.map((session) => session.id), ['valid']);
    });
  });
}

RecordingSession _session({
  required String id,
  required DateTime startedAt,
  required RecordingSessionStatus status,
  required UploadStatus uploadStatus,
}) {
  return RecordingSession(
    id: id,
    lectureId: 'lecture-$id',
    startedAt: startedAt,
    endedAt: status == RecordingSessionStatus.completed
        ? startedAt.add(const Duration(minutes: 12))
        : null,
    localFilePath: '/tmp/$id.m4a',
    duration: const Duration(minutes: 12),
    status: status,
    uploadStatus: uploadStatus,
    markers: [
      RecordingMarker(
        timestamp: const Duration(minutes: 2),
        createdAt: startedAt.add(const Duration(minutes: 2)),
      ),
    ],
  );
}
