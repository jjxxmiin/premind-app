import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:premind/core/network/api_client.dart';
import 'package:premind/features/auth/data/api_auth_repository.dart';
import 'package:premind/features/auth/data/auth_token_store.dart';
import 'package:premind/features/lectures/presentation/lecture_providers.dart';
import 'package:premind/features/recording/domain/recording_session.dart';
import 'package:premind/features/recording/presentation/recording_session_providers.dart';
import 'package:premind/features/upload/data/recording_uploader.dart';
import 'package:premind/features/upload/data/upload_api.dart';
import 'package:premind/features/upload/data/upload_driver.dart';
import 'package:premind/features/upload/data/upload_queue_repository.dart';
import 'package:premind/features/upload/domain/upload_job.dart';

final uploadQueueRepositoryProvider = Provider<UploadQueueRepository>((ref) {
  return UploadQueueRepository();
});

final uploadApiProvider = Provider<UploadApi>((ref) {
  return HttpUploadApi(apiClient: ref.watch(apiClientProvider));
});

final recordingUploaderProvider = Provider<RecordingUploader>((ref) {
  return RecordingUploader(
    queueRepository: ref.watch(uploadQueueRepositoryProvider),
    uploadApi: ref.watch(uploadApiProvider),
    accessToken: ref.watch(apiAuthRepositoryProvider).validAccessToken,
    sessionRepository: ref.watch(recordingSessionRepositoryProvider),
    lectureRepository: ref.watch(lectureRepositoryProvider),
  );
});

/// Runs the queue on app start, on resume, and when a backoff elapses.
final uploadDriverProvider = Provider<UploadDriver>((ref) {
  final driver = UploadDriver(
    processQueue: ref.watch(recordingUploaderProvider).processQueue,
    queueRepository: ref.watch(uploadQueueRepositoryProvider),
    tokenStore: AuthTokenStore(),
    onDrained: () => ref.read(uploadQueueProvider.notifier).refresh(),
  );
  ref.onDispose(driver.dispose);
  return driver;
});

/// The uploads that still owe the server bytes, oldest first.
final uploadQueueProvider =
    AsyncNotifierProvider<UploadQueueNotifier, List<UploadJob>>(
      UploadQueueNotifier.new,
    );

class UploadQueueNotifier extends AsyncNotifier<List<UploadJob>> {
  UploadQueueRepository get _repository =>
      ref.read(uploadQueueRepositoryProvider);

  @override
  Future<List<UploadJob>> build() => _repository.getPending();

  Future<void> refresh() async {
    state = AsyncData<List<UploadJob>>(await _repository.getPending());
  }

  /// Queues [session] for upload, reading the recorded file's size.
  ///
  /// Returns null when there is nothing to upload (the file is missing or
  /// empty). An already queued recording keeps its existing progress.
  Future<UploadJob?> enqueueRecording({
    required RecordingSession session,
    required String title,
  }) async {
    final file = File(session.localFilePath);
    if (!await file.exists()) {
      return null;
    }
    final totalBytes = await file.length();
    if (totalBytes <= 0) {
      return null;
    }

    final job = await _repository.enqueue(
      UploadJob.forRecording(
        session: session,
        title: title,
        totalBytes: totalBytes,
      ),
    );
    await refresh();
    return job;
  }

  /// Runs the queue and refreshes the exposed list when it settles.
  Future<void> processQueue() async {
    await ref.read(recordingUploaderProvider).processQueue();
    await refresh();
  }

  /// Puts a failed job back in line and kicks the queue.
  ///
  /// Clears the backoff and the recorded attempts so a user-initiated retry
  /// starts immediately instead of waiting out the previous delay.
  Future<void> retry(String jobId) async {
    final job = await _repository.get(jobId);
    if (job == null || job.status == UploadJobStatus.completed) {
      return;
    }
    await _repository.save(
      job.copyWith(
        status: UploadJobStatus.queued,
        attempts: 0,
        lastError: null,
        nextAttemptAt: null,
        updatedAt: DateTime.now(),
      ),
    );
    await refresh();
    await ref.read(uploadDriverProvider).drain();
  }
}
