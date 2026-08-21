import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:premind/core/network/api_client.dart';
import 'package:premind/features/lectures/data/lecture_repository.dart';
import 'package:premind/features/lectures/domain/lecture.dart';
import 'package:premind/features/recording/data/recording_session_repository.dart';
import 'package:premind/features/recording/domain/recording_session.dart';
import 'package:premind/features/upload/data/upload_api.dart';
import 'package:premind/features/upload/data/upload_queue_repository.dart';
import 'package:premind/features/upload/domain/upload_job.dart';

/// Drains the resumable upload queue.
///
/// Design constraints that shaped this engine:
///
/// * One job and one chunk at a time. A lecture hall uplink is the bottleneck,
///   and parallel chunks only make each of them slower and more likely to time
///   out.
/// * Chunks are read from disk with [RandomAccessFile] one at a time. A
///   three-hour recording must never be loaded into memory.
/// * The job is persisted after every accepted chunk, so a crash resumes from
///   the middle of the file rather than from the beginning.
class RecordingUploader {
  RecordingUploader({
    required UploadQueueRepository queueRepository,
    required UploadApi uploadApi,
    required Future<String?> Function() accessToken,
    required RecordingSessionRepository sessionRepository,
    required LectureRepository lectureRepository,
    DateTime Function()? now,
    math.Random? random,
  }) : _queueRepository = queueRepository,
       _uploadApi = uploadApi,
       _accessToken = accessToken,
       _sessionRepository = sessionRepository,
       _lectureRepository = lectureRepository,
       _now = now ?? DateTime.now,
       _random = random ?? math.Random();

  /// First retry delay; doubled on every further attempt.
  static const _baseBackoff = Duration(seconds: 5);

  /// Ceiling for the retry delay, before jitter.
  static const _maxBackoff = Duration(minutes: 10);

  /// Keeps `2 ^ attempts` inside a safe integer range; the delay is capped by
  /// [_maxBackoff] long before this matters.
  static const _maxBackoffExponent = 16;

  final UploadQueueRepository _queueRepository;
  final UploadApi _uploadApi;
  final Future<String?> Function() _accessToken;
  final RecordingSessionRepository _sessionRepository;
  final LectureRepository _lectureRepository;
  final DateTime Function() _now;
  final math.Random _random;

  bool _processing = false;

  /// Uploads every job that is due, oldest first, one at a time.
  ///
  /// Re-entrant callers (a lifecycle event arriving while a drain is already
  /// running) return immediately instead of starting a second pass.
  Future<void> processQueue() async {
    if (_processing) {
      return;
    }
    _processing = true;
    try {
      final jobs = await _queueRepository.getPending();
      for (final job in jobs) {
        if (!job.isReadyAt(_now())) {
          continue;
        }
        await uploadJob(job);
      }
    } finally {
      _processing = false;
    }
  }

  /// Runs one job to completion, or to its next failure state.
  ///
  /// Never throws: every outcome is recorded on the returned job, which has
  /// already been persisted.
  Future<UploadJob> uploadJob(UploadJob job) async {
    if (job.status == UploadJobStatus.completed ||
        job.status == UploadJobStatus.cancelled) {
      return job;
    }

    try {
      final token = await _resolveToken();
      final file = await _verifyFile(job);
      final started = await _transitionToUploading(job);
      return await _upload(started, token, file);
    } on _TerminalUploadFailure catch (failure) {
      return _failTerminally(await _latest(job), failure.message);
    } on Object catch (error) {
      final latest = await _latest(job);
      if (_isRetryable(error)) {
        return _failWithRetry(latest, _describe(error));
      }
      return _failTerminally(latest, _describe(error));
    }
  }

  /// Abandons [jobId] server-side and marks it cancelled locally.
  Future<UploadJob?> cancel(String jobId) async {
    final job = await _queueRepository.get(jobId);
    if (job == null || job.status == UploadJobStatus.completed) {
      return job;
    }

    final uploadId = job.uploadId;
    if (uploadId != null) {
      try {
        final token = await _accessToken();
        if (token != null) {
          await _uploadApi.abandonSession(
            accessToken: token,
            uploadId: uploadId,
          );
        }
      } on Object {
        // Server-side sessions expire on their own; the local queue is what
        // decides whether more bytes are sent.
      }
    }

    final cancelled = job.copyWith(
      status: UploadJobStatus.cancelled,
      nextAttemptAt: null,
      updatedAt: _now(),
    );
    await _queueRepository.save(cancelled);
    await _syncRecordingSession(cancelled.id, UploadStatus.pending);
    return cancelled;
  }

  Future<UploadJob> _upload(UploadJob job, String token, File file) async {
    var current = job;

    if (current.uploadId == null) {
      final session = await _uploadApi.createSession(
        accessToken: token,
        filename: _fileNameOf(current.filePath),
        totalBytes: current.totalBytes,
        contentType: _contentTypeOf(current.filePath),
        title: current.title,
        durationMs: current.durationMs,
        clientReference: current.id,
        markers: await _markersFor(current.id),
      );
      current = await _applySession(current, session);
      if (session.isCompleted) {
        return _markCompleted(current, session.videoId);
      }
    } else if (current.chunkSize == null) {
      // The upload id survived but the chunk size did not; without the
      // server's size the persisted chunk indexes mean nothing.
      final session = await _uploadApi.getSession(
        accessToken: token,
        uploadId: current.uploadId!,
      );
      current = await _applySession(current, session);
      if (session.isCompleted) {
        return _markCompleted(current, session.videoId);
      }
    }

    final uploadId = current.uploadId;
    final chunkSize = current.chunkSize;
    if (uploadId == null || chunkSize == null || chunkSize <= 0) {
      throw const _TerminalUploadFailure(
        'The server did not return a usable upload session.',
      );
    }

    final totalChunks = (current.totalBytes + chunkSize - 1) ~/ chunkSize;
    final uploaded = current.uploadedChunks.toSet();
    final handle = await file.open();
    try {
      for (var index = 0; index < totalChunks; index++) {
        if (uploaded.contains(index)) {
          continue;
        }

        final offset = index * chunkSize;
        final length = math.min(chunkSize, current.totalBytes - offset);
        await handle.setPosition(offset);
        final bytes = await handle.read(length);
        if (bytes.length != length) {
          throw const _TerminalUploadFailure(
            'The recording file changed while it was being uploaded.',
          );
        }

        final UploadChunkReceipt receipt;
        try {
          receipt = await _uploadApi.putChunk(
            accessToken: token,
            uploadId: uploadId,
            index: index,
            bytes: bytes,
          );
        } on ApiException catch (error) {
          final recovered = await _recoverFromChunkFailure(current, error);
          if (recovered != null) {
            return recovered;
          }
          rethrow;
        }

        uploaded
          ..add(index)
          ..addAll(receipt.receivedChunks);
        current = current.copyWith(
          uploadedChunks: uploaded.toList(),
          updatedAt: _now(),
        );
        await _queueRepository.save(current);
      }
    } finally {
      await handle.close();
    }

    final UploadCompletion completion;
    try {
      completion = await _uploadApi.completeSession(
        accessToken: token,
        uploadId: uploadId,
      );
    } on ApiException catch (error) {
      if (error.statusCode == 409 || error.statusCode == 404) {
        // The server disagrees about what it holds. Re-read its view so the
        // next attempt uploads exactly the chunks that are still missing.
        final refreshed = await _refreshSession(current, token, uploadId);
        if (refreshed != null) {
          return refreshed;
        }
      }
      rethrow;
    }

    return _markCompleted(current, completion.videoId);
  }

  /// Handles a chunk PUT rejection that the plain retry policy would misread.
  ///
  /// Returns a finished job when the server says the upload is already
  /// complete, or null when the caller should let the error propagate.
  Future<UploadJob?> _recoverFromChunkFailure(
    UploadJob job,
    ApiException error,
  ) async {
    if (error.statusCode == 404) {
      // The session is gone. Forget it and let the next attempt re-init with
      // the same client reference, which the server resolves idempotently.
      final reset = job.copyWith(
        uploadId: null,
        chunkSize: null,
        uploadedChunks: const <int>[],
        updatedAt: _now(),
      );
      await _queueRepository.save(reset);
      throw const _RetryableUploadFailure(
        'The upload session expired and will be restarted.',
      );
    }

    if (error.statusCode != 409) {
      return null;
    }

    // 409 means the session was already completed, which is a success for us.
    final uploadId = job.uploadId;
    if (uploadId == null) {
      return null;
    }
    final token = await _accessToken();
    if (token == null) {
      return null;
    }
    final session = await _uploadApi.getSession(
      accessToken: token,
      uploadId: uploadId,
    );
    if (!session.isCompleted) {
      return null;
    }
    return _markCompleted(await _applySession(job, session), session.videoId);
  }

  Future<UploadJob?> _refreshSession(
    UploadJob job,
    String token,
    String uploadId,
  ) async {
    final session = await _uploadApi.getSession(
      accessToken: token,
      uploadId: uploadId,
    );
    final refreshed = await _applySession(job, session);
    if (session.isCompleted) {
      return _markCompleted(refreshed, session.videoId);
    }
    throw const _RetryableUploadFailure(
      'The server is still missing part of the recording.',
    );
  }

  Future<String> _resolveToken() async {
    final token = await _accessToken();
    if (token == null) {
      throw const _TerminalUploadFailure(
        'Sign in again to finish uploading this recording.',
      );
    }
    return token;
  }

  Future<File> _verifyFile(UploadJob job) async {
    final file = File(job.filePath);
    if (!await file.exists()) {
      throw const _TerminalUploadFailure('The recording file is missing.');
    }

    final length = await file.length();
    if (length <= 0) {
      throw const _TerminalUploadFailure('The recording file is empty.');
    }
    if (length == job.totalBytes) {
      return file;
    }
    if (job.uploadId == null) {
      // Nothing is committed server-side yet, so adopt the real size: a
      // recorder can legitimately flush trailing bytes after the queue entry
      // was written.
      await _queueRepository.save(
        job.copyWith(totalBytes: length, updatedAt: _now()),
      );
      return file;
    }
    throw const _TerminalUploadFailure(
      'The recording file changed after the upload started.',
    );
  }

  Future<UploadJob> _transitionToUploading(UploadJob job) async {
    // Re-read: _verifyFile may have corrected the size.
    final latest = await _latest(job);
    final uploading = latest.copyWith(
      status: UploadJobStatus.uploading,
      lastError: null,
      nextAttemptAt: null,
      updatedAt: _now(),
    );
    await _queueRepository.save(uploading);
    await _syncRecordingSession(uploading.id, UploadStatus.uploading);
    await _syncLecture(uploading.lectureId, LectureStatus.uploading);
    return uploading;
  }

  Future<UploadJob> _applySession(
    UploadJob job,
    UploadSessionState session,
  ) async {
    final applied = job.copyWith(
      uploadId: session.uploadId,
      chunkSize: session.chunkSize,
      // The server is the authority on what it already holds.
      uploadedChunks: session.receivedChunks,
      updatedAt: _now(),
    );
    await _queueRepository.save(applied);
    return applied;
  }

  Future<UploadJob> _markCompleted(UploadJob job, String? videoId) async {
    final completed = job.copyWith(
      status: UploadJobStatus.completed,
      videoId: videoId ?? job.videoId,
      lastError: null,
      nextAttemptAt: null,
      updatedAt: _now(),
    );
    await _queueRepository.save(completed);
    await _syncRecordingSession(completed.id, UploadStatus.completed);
    // The bytes are on the server, so the lecture moves on to server-side
    // processing rather than staying stuck at "uploading".
    await _syncLecture(completed.lectureId, LectureStatus.processing);
    return completed;
  }

  Future<UploadJob> _failWithRetry(UploadJob job, String message) async {
    final failed = job.copyWith(
      status: UploadJobStatus.failed,
      attempts: job.attempts + 1,
      lastError: message,
      nextAttemptAt: _now().add(_backoffFor(job.attempts)),
      updatedAt: _now(),
    );
    await _queueRepository.save(failed);
    await _syncRecordingSession(failed.id, UploadStatus.failed);
    // A transient failure keeps the lecture in the queued state: it is about
    // to be retried, and flashing "failed" in the library would be a lie.
    await _syncLecture(failed.lectureId, LectureStatus.uploadPending);
    return failed;
  }

  /// Marks a failure that retrying cannot fix. [UploadJob.attempts] is left
  /// alone and `nextAttemptAt` stays null, which is what makes the job
  /// terminal.
  Future<UploadJob> _failTerminally(UploadJob job, String message) async {
    final failed = job.copyWith(
      status: UploadJobStatus.failed,
      lastError: message,
      nextAttemptAt: null,
      updatedAt: _now(),
    );
    await _queueRepository.save(failed);
    await _syncRecordingSession(failed.id, UploadStatus.failed);
    await _syncLecture(failed.lectureId, LectureStatus.failed);
    return failed;
  }

  Duration _backoffFor(int attempts) {
    final exponent = attempts.clamp(0, _maxBackoffExponent);
    final scaled = _baseBackoff.inMilliseconds * (1 << exponent);
    final capped = math.min(scaled, _maxBackoff.inMilliseconds);
    // Jitter spreads out clients that all lost the same lecture-hall network.
    final jitter = (capped * 0.25 * _random.nextDouble()).round();
    return Duration(milliseconds: capped + jitter);
  }

  bool _isRetryable(Object error) {
    if (error is _RetryableUploadFailure) {
      return true;
    }
    if (error is ApiException) {
      if (error.isNetworkError) {
        return true;
      }
      final statusCode = error.statusCode;
      if (statusCode == null) {
        return true;
      }
      if (statusCode == 408 || statusCode == 429) {
        return true;
      }
      return statusCode >= 500;
    }
    // A transient disk or socket problem deserves another attempt.
    return error is IOException || error is TimeoutException;
  }

  String _describe(Object error) {
    if (error is _RetryableUploadFailure) {
      return error.message;
    }
    if (error is ApiException) {
      return error.message;
    }
    return error.toString();
  }

  Future<UploadJob> _latest(UploadJob job) async {
    try {
      return await _queueRepository.get(job.id) ?? job;
    } on Object {
      return job;
    }
  }

  Future<List<RecordingMarker>> _markersFor(String sessionId) async {
    try {
      final session = await _sessionRepository.get(sessionId);
      return session?.markers ?? const <RecordingMarker>[];
    } on Object {
      return const <RecordingMarker>[];
    }
  }

  /// Mirrors the job state onto the recording session. Best effort: mirrored
  /// metadata must never fail an upload.
  Future<void> _syncRecordingSession(
    String sessionId,
    UploadStatus status,
  ) async {
    try {
      final session = await _sessionRepository.get(sessionId);
      if (session == null || session.uploadStatus == status) {
        return;
      }
      await _sessionRepository.save(session.copyWith(uploadStatus: status));
    } on Object {
      // The queue entry remains the source of truth for the upload itself.
    }
  }

  Future<void> _syncLecture(String lectureId, LectureStatus status) async {
    try {
      final lecture = await _lectureRepository.getLecture(lectureId);
      if (lecture == null || lecture.status == status) {
        return;
      }
      await _lectureRepository.saveLecture(lecture.copyWith(status: status));
    } on Object {
      // The queue entry remains the source of truth for the upload itself.
    }
  }

  String _fileNameOf(String filePath) {
    final separator = math.max(
      filePath.lastIndexOf('/'),
      filePath.lastIndexOf(r'\'),
    );
    final name = separator == -1 ? filePath : filePath.substring(separator + 1);
    return name.isEmpty ? 'recording' : name;
  }

  String _contentTypeOf(String filePath) {
    final name = filePath.toLowerCase();
    if (name.endsWith('.m4a') || name.endsWith('.mp4')) {
      return 'audio/mp4';
    }
    if (name.endsWith('.mp3')) {
      return 'audio/mpeg';
    }
    if (name.endsWith('.aac')) {
      return 'audio/aac';
    }
    if (name.endsWith('.wav')) {
      return 'audio/wav';
    }
    if (name.endsWith('.ogg') || name.endsWith('.opus')) {
      return 'audio/ogg';
    }
    return 'application/octet-stream';
  }
}

/// A failure that retrying cannot fix.
class _TerminalUploadFailure implements Exception {
  const _TerminalUploadFailure(this.message);

  final String message;

  @override
  String toString() => 'TerminalUploadFailure: $message';
}

/// A failure that is worth another attempt even though the status code alone
/// would not say so.
class _RetryableUploadFailure implements Exception {
  const _RetryableUploadFailure(this.message);

  final String message;

  @override
  String toString() => 'RetryableUploadFailure: $message';
}
