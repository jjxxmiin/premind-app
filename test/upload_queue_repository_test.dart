import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:premind/features/upload/data/upload_queue_repository.dart';
import 'package:premind/features/upload/domain/upload_job.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _queueKey = 'premind.upload_queue.v1';

void main() {
  group('UploadQueueRepository', () {
    setUp(() {
      SharedPreferences.setMockInitialValues(<String, Object>{});
    });

    test('round-trips a job through storage', () async {
      final repository = UploadQueueRepository();
      final job = _job(id: 'a', createdAt: DateTime.utc(2026, 8, 8)).copyWith(
        uploadId: 'server-1',
        chunkSize: 1024,
        uploadedChunks: const <int>[2, 0, 0, 1],
        status: UploadJobStatus.uploading,
        attempts: 2,
        lastError: 'network hiccup',
        nextAttemptAt: DateTime.utc(2026, 8, 8, 0, 5),
        videoId: 'video-1',
      );

      await repository.enqueue(job);

      final loaded = await UploadQueueRepository().get('a');
      expect(loaded, isNotNull);
      expect(loaded!.lectureId, 'lecture-a');
      expect(loaded.filePath, '/tmp/a.m4a');
      expect(loaded.title, 'Lecture a');
      expect(loaded.durationMs, 720000);
      expect(loaded.totalBytes, 4096);
      expect(loaded.uploadId, 'server-1');
      expect(loaded.chunkSize, 1024);
      expect(loaded.uploadedChunks, <int>[0, 1, 2]);
      expect(loaded.status, UploadJobStatus.uploading);
      expect(loaded.attempts, 2);
      expect(loaded.lastError, 'network hiccup');
      expect(loaded.nextAttemptAt, DateTime.utc(2026, 8, 8, 0, 5));
      expect(loaded.videoId, 'video-1');
      expect(loaded.createdAt, DateTime.utc(2026, 8, 8));
      expect(loaded.progress, closeTo(3 * 1024 / 4096, 1e-9));

      expect(await repository.get('missing'), isNull);
    });

    test('save upserts by id and enqueue keeps existing progress', () async {
      final repository = UploadQueueRepository();
      final job = _job(id: 'a', createdAt: DateTime.utc(2026, 8, 8));
      await repository.enqueue(job);

      await repository.save(
        job.copyWith(
          status: UploadJobStatus.uploading,
          uploadedChunks: const <int>[0, 1],
        ),
      );

      expect(await repository.getAll(), hasLength(1));

      // Re-enqueueing the same recording must not reset it to queued.
      final reEnqueued = await repository.enqueue(job);
      expect(reEnqueued.status, UploadJobStatus.uploading);
      expect(reEnqueued.uploadedChunks, <int>[0, 1]);
      expect(await repository.getAll(), hasLength(1));

      await repository.remove('a');
      expect(await repository.getAll(), isEmpty);
    });

    test('getPending returns unfinished jobs oldest first', () async {
      final repository = UploadQueueRepository();
      await repository.enqueue(
        _job(id: 'queued', createdAt: DateTime.utc(2026, 8, 8, 3)),
      );
      await repository.save(
        _job(
          id: 'uploading',
          createdAt: DateTime.utc(2026, 8, 8, 2),
        ).copyWith(status: UploadJobStatus.uploading),
      );
      await repository.save(
        _job(
          id: 'failed',
          createdAt: DateTime.utc(2026, 8, 8, 1),
        ).copyWith(status: UploadJobStatus.failed),
      );
      await repository.save(
        _job(
          id: 'completed',
          createdAt: DateTime.utc(2026, 8, 8, 4),
        ).copyWith(status: UploadJobStatus.completed, videoId: 'video-1'),
      );
      await repository.save(
        _job(
          id: 'cancelled',
          createdAt: DateTime.utc(2026, 8, 8, 5),
        ).copyWith(status: UploadJobStatus.cancelled),
      );

      final pending = await repository.getPending();

      expect(pending.map((job) => job.id), <String>[
        'failed',
        'uploading',
        'queued',
      ]);
      expect(() => pending.add(pending.first), throwsUnsupportedError);
      expect((await repository.getAll()).map((job) => job.id), <String>[
        'failed',
        'uploading',
        'queued',
        'completed',
        'cancelled',
      ]);
    });

    test('skips a malformed entry and keeps the rest of the queue', () async {
      final valid = _job(
        id: 'valid',
        createdAt: DateTime.utc(2026, 8, 8),
      ).copyWith(uploadedChunks: const <int>[0, 1]).toJson();
      valid['uploadedChunks'] = <Object?>[0, 'not-a-chunk', 1];

      SharedPreferences.setMockInitialValues(<String, Object>{
        _queueKey: jsonEncode(<Object?>[
          valid,
          <String, Object?>{'id': 'damaged'},
          <String, Object?>{...valid, 'id': 'bad-status', 'status': 'unknown'},
          'not-an-object',
        ]),
      });

      final repository = UploadQueueRepository();
      final all = await repository.getAll();

      expect(all, hasLength(1));
      expect(all.single.id, 'valid');
      expect(all.single.uploadedChunks, <int>[0, 1]);
      expect((await repository.getPending()).single.id, 'valid');
    });
  });
}

UploadJob _job({required String id, required DateTime createdAt}) {
  return UploadJob(
    id: id,
    lectureId: 'lecture-$id',
    filePath: '/tmp/$id.m4a',
    title: 'Lecture $id',
    durationMs: 720000,
    totalBytes: 4096,
    status: UploadJobStatus.queued,
    createdAt: createdAt,
    updatedAt: createdAt,
  );
}
