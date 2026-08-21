import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:premind/core/network/api_client.dart';
import 'package:premind/features/lectures/data/lecture_repository.dart';
import 'package:premind/features/lectures/domain/lecture.dart';
import 'package:premind/features/recording/data/recording_session_repository.dart';
import 'package:premind/features/recording/domain/recording_session.dart';
import 'package:premind/features/upload/data/recording_uploader.dart';
import 'package:premind/features/upload/data/upload_api.dart';
import 'package:premind/features/upload/data/upload_queue_repository.dart';
import 'package:premind/features/upload/domain/upload_job.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A 250 byte recording split by a 100 byte server chunk size gives three
/// chunks, the last one short — enough to exercise every offset case.
const _fileLength = 250;
const _chunkSize = 100;

final _fixedNow = DateTime.utc(2026, 8, 20, 9);

void main() {
  group('RecordingUploader', () {
    late Directory tempDirectory;
    late File recordingFile;
    late List<int> recordingBytes;

    setUp(() {
      SharedPreferences.setMockInitialValues(<String, Object>{});
      tempDirectory = Directory.systemTemp.createTempSync('premind_upload');
      recordingBytes = List<int>.generate(
        _fileLength,
        (index) => (index * 7) % 256,
      );
      recordingFile = File('${tempDirectory.path}/premind_session.m4a')
        ..writeAsBytesSync(recordingBytes);
    });

    tearDown(() {
      if (tempDirectory.existsSync()) {
        tempDirectory.deleteSync(recursive: true);
      }
    });

    Future<_Harness> buildHarness({
      _FakeUploadApi? api,
      String? token = 'access-token',
      String? filePath,
      bool withSession = true,
      bool withLecture = true,
    }) async {
      final uploadApi = api ?? _FakeUploadApi();
      final queue = UploadQueueRepository();
      final sessions = RecordingSessionRepository();
      final lectures = _FakeLectureRepository();

      if (withSession) {
        await sessions.save(_recordingSession(recordingFile.path));
      }
      if (withLecture) {
        lectures.lectures['lecture-1'] = Lecture(
          id: 'lecture-1',
          title: '자료구조 3주차',
          createdAt: _fixedNow,
          duration: const Duration(minutes: 12),
          status: LectureStatus.uploadPending,
          recordingType: RecordingType.audio,
          localAudioPath: recordingFile.path,
        );
      }

      final job = await queue.enqueue(
        UploadJob.forRecording(
          session: _recordingSession(filePath ?? recordingFile.path),
          title: '자료구조 3주차',
          totalBytes: _fileLength,
          now: _fixedNow,
        ),
      );

      return _Harness(
        job: job,
        queue: queue,
        sessions: sessions,
        lectures: lectures,
        api: uploadApi,
        uploader: RecordingUploader(
          queueRepository: queue,
          uploadApi: uploadApi,
          accessToken: () async => token,
          sessionRepository: sessions,
          lectureRepository: lectures,
          now: () => _fixedNow,
          random: math.Random(7),
        ),
      );
    }

    test('uploads a fresh recording: init, every chunk, complete', () async {
      final api = _FakeUploadApi();
      final harness = await buildHarness(api: api);

      final result = await harness.uploader.uploadJob(harness.job);

      expect(api.createCalls, 1);
      expect(api.lastClientReference, 'session-1');
      expect(api.lastFilename, 'premind_session.m4a');
      expect(api.lastContentType, 'audio/mp4');
      expect(api.lastTotalBytes, _fileLength);
      expect(api.lastDurationMs, const Duration(minutes: 12).inMilliseconds);
      expect(api.lastMarkers.map((marker) => marker.timestamp), <Duration>[
        const Duration(minutes: 2),
      ]);
      expect(api.tokens, everyElement('access-token'));

      // Every chunk, in order, with the server's chunk size.
      expect(api.putIndexes, <int>[0, 1, 2]);
      expect(api.putBytes[0], recordingBytes.sublist(0, 100));
      expect(api.putBytes[1], recordingBytes.sublist(100, 200));
      expect(api.putBytes[2], recordingBytes.sublist(200, 250));
      expect(api.completeCalls, 1);

      expect(result.status, UploadJobStatus.completed);
      expect(result.videoId, 'video-1');
      expect(result.progress, 1.0);
      expect(result.lastError, isNull);
      expect(result.isTerminal, isFalse);

      final persisted = await harness.queue.get('session-1');
      expect(persisted?.status, UploadJobStatus.completed);
      expect(persisted?.videoId, 'video-1');
      expect(await harness.queue.getPending(), isEmpty);
    });

    test('resumes from the chunks the server already holds', () async {
      final api = _FakeUploadApi(receivedChunks: const <int>[0, 1]);
      final harness = await buildHarness(api: api);

      final result = await harness.uploader.uploadJob(harness.job);

      expect(api.putIndexes, <int>[2]);
      expect(api.putBytes[2], recordingBytes.sublist(200, 250));
      expect(result.status, UploadJobStatus.completed);
    });

    test('finishes immediately when the server session is already '
        'completed', () async {
      final api = _FakeUploadApi(
        sessionStatus: UploadSessionStatus.completed,
        receivedChunks: const <int>[0, 1, 2],
      );
      final harness = await buildHarness(api: api);

      final result = await harness.uploader.uploadJob(harness.job);

      expect(api.putIndexes, isEmpty);
      expect(api.completeCalls, 0);
      expect(result.status, UploadJobStatus.completed);
      expect(result.videoId, 'video-1');
    });

    test('uses the server chunk size even when it exceeds the file', () async {
      final api = _FakeUploadApi(chunkSize: 5242880);
      final harness = await buildHarness(api: api);

      final result = await harness.uploader.uploadJob(harness.job);

      expect(api.putIndexes, <int>[0]);
      expect(api.putBytes[0], recordingBytes);
      expect(result.status, UploadJobStatus.completed);
      expect(result.chunkSize, 5242880);
    });

    test('a network failure mid-file is retryable and keeps the chunks '
        'already accepted', () async {
      final api = _FakeUploadApi(
        failAtChunk: 1,
        chunkFailure: const ApiException(
          message: 'Could not reach the server: no route to host',
          isNetworkError: true,
        ),
      );
      final harness = await buildHarness(api: api);

      final result = await harness.uploader.uploadJob(harness.job);

      expect(api.putIndexes, <int>[0]);
      expect(api.completeCalls, 0);
      expect(result.status, UploadJobStatus.failed);
      expect(result.attempts, 1);
      expect(result.isTerminal, isFalse);
      expect(result.isRetryPending, isTrue);
      // 2^0 * 5s, plus up to 25% jitter.
      expect(
        result.nextAttemptAt!.difference(_fixedNow).inMilliseconds,
        inInclusiveRange(5000, 6250),
      );
      expect(result.lastError, contains('Could not reach the server'));
      expect(result.uploadedChunks, <int>[0]);
      expect(result.uploadId, 'upload-1');
      expect(result.chunkSize, _chunkSize);

      // Still pending, and the recording session mirrors the failure.
      expect((await harness.queue.getPending()).single.id, 'session-1');
      expect(
        (await harness.sessions.get('session-1'))?.uploadStatus,
        UploadStatus.failed,
      );
      // A retry is coming, so the lecture stays queued rather than failed.
      expect(
        harness.lectures.lectures['lecture-1']?.status,
        LectureStatus.uploadPending,
      );
    });

    test('a new uploader resumes a crashed job from the middle of the '
        'file', () async {
      final crashingApi = _FakeUploadApi(
        failAtChunk: 1,
        chunkFailure: const ApiException(message: 'boom', isNetworkError: true),
      );
      final harness = await buildHarness(api: crashingApi);
      await harness.uploader.uploadJob(harness.job);

      // Simulate a relaunch: brand new repository and uploader instances that
      // only know what was persisted.
      final resumedQueue = UploadQueueRepository();
      final persisted = await resumedQueue.get('session-1');
      expect(persisted, isNotNull);
      expect(persisted!.uploadedChunks, <int>[0]);

      final resumedApi = _FakeUploadApi();
      final resumedUploader = RecordingUploader(
        queueRepository: resumedQueue,
        uploadApi: resumedApi,
        accessToken: () async => 'access-token',
        sessionRepository: RecordingSessionRepository(),
        lectureRepository: harness.lectures,
        now: () => _fixedNow,
        random: math.Random(7),
      );

      final result = await resumedUploader.uploadJob(persisted);

      // No re-init, and chunk 0 is never sent a second time.
      expect(resumedApi.createCalls, 0);
      expect(resumedApi.getCalls, 0);
      expect(resumedApi.putIndexes, <int>[1, 2]);
      expect(resumedApi.putBytes[1], recordingBytes.sublist(100, 200));
      expect(resumedApi.putBytes[2], recordingBytes.sublist(200, 250));
      expect(result.status, UploadJobStatus.completed);
      expect(result.attempts, 1, reason: 'a success must not add an attempt');
    });

    test('a 500 is retryable but a 400 is terminal', () async {
      final serverError = await buildHarness(
        api: _FakeUploadApi(
          failAtChunk: 0,
          chunkFailure: const ApiException(
            statusCode: 503,
            message: 'Service unavailable',
          ),
        ),
      );
      final retried = await serverError.uploader.uploadJob(serverError.job);
      expect(retried.isTerminal, isFalse);
      expect(retried.attempts, 1);

      SharedPreferences.setMockInitialValues(<String, Object>{});
      final clientError = await buildHarness(
        api: _FakeUploadApi(
          failAtChunk: 0,
          chunkFailure: const ApiException(
            statusCode: 400,
            message: 'Malformed chunk',
          ),
        ),
      );
      final rejected = await clientError.uploader.uploadJob(clientError.job);
      expect(rejected.isTerminal, isTrue);
      expect(rejected.attempts, 0);
      expect(rejected.lastError, 'Malformed chunk');
    });

    test('a missing access token fails the job terminally', () async {
      final api = _FakeUploadApi();
      final harness = await buildHarness(api: api, token: null);

      final result = await harness.uploader.uploadJob(harness.job);

      expect(api.createCalls, 0);
      expect(api.putIndexes, isEmpty);
      expect(result.status, UploadJobStatus.failed);
      expect(result.isTerminal, isTrue);
      expect(result.attempts, 0, reason: 'a terminal failure never retries');
      expect(result.nextAttemptAt, isNull);
      expect(result.lastError, contains('Sign in again'));
      expect(
        harness.lectures.lectures['lecture-1']?.status,
        LectureStatus.failed,
      );
    });

    test('a missing recording file fails the job terminally', () async {
      final api = _FakeUploadApi();
      final harness = await buildHarness(
        api: api,
        filePath: '${tempDirectory.path}/gone.m4a',
      );

      final result = await harness.uploader.uploadJob(harness.job);

      expect(api.createCalls, 0);
      expect(result.status, UploadJobStatus.failed);
      expect(result.isTerminal, isTrue);
      expect(result.attempts, 0);
      expect(result.lastError, contains('missing'));
      expect(
        (await harness.sessions.get('session-1'))?.uploadStatus,
        UploadStatus.failed,
      );
    });

    test(
      'a completed upload syncs the recording session and lecture',
      () async {
        final harness = await buildHarness(api: _FakeUploadApi());

        await harness.uploader.uploadJob(harness.job);

        final session = await harness.sessions.get('session-1');
        expect(session?.uploadStatus, UploadStatus.completed);
        // Recording metadata itself is untouched by the uploader.
        expect(session?.markers, hasLength(1));
        expect(session?.status, RecordingSessionStatus.completed);
        expect(
          harness.lectures.lectures['lecture-1']?.status,
          LectureStatus.processing,
        );
      },
    );

    test('processQueue drains due jobs and skips backed-off ones', () async {
      final api = _FakeUploadApi();
      final harness = await buildHarness(api: api);
      await harness.queue.save(
        harness.job.copyWith(
          id: 'session-2',
          status: UploadJobStatus.failed,
          nextAttemptAt: _fixedNow.add(const Duration(minutes: 5)),
          createdAt: _fixedNow.subtract(const Duration(hours: 1)),
        ),
      );
      await harness.queue.save(
        harness.job.copyWith(
          id: 'session-3',
          status: UploadJobStatus.failed,
          nextAttemptAt: null,
          lastError: 'The recording file is missing.',
          createdAt: _fixedNow.subtract(const Duration(hours: 2)),
        ),
      );

      await harness.uploader.processQueue();

      // Only the due job ran: one init, three chunks, one complete.
      expect(api.createCalls, 1);
      expect(api.putIndexes, <int>[0, 1, 2]);
      expect(
        (await harness.queue.get('session-1'))?.status,
        UploadJobStatus.completed,
      );
      expect(
        (await harness.queue.get('session-2'))?.status,
        UploadJobStatus.failed,
      );
      expect((await harness.queue.get('session-2'))?.attempts, 0);
      expect((await harness.queue.get('session-3'))?.attempts, 0);
    });
  });
}

RecordingSession _recordingSession(String filePath) {
  return RecordingSession(
    id: 'session-1',
    lectureId: 'lecture-1',
    startedAt: _fixedNow,
    endedAt: _fixedNow.add(const Duration(minutes: 12)),
    localFilePath: filePath,
    duration: const Duration(minutes: 12),
    status: RecordingSessionStatus.completed,
    uploadStatus: UploadStatus.pending,
    markers: <RecordingMarker>[
      RecordingMarker(
        timestamp: const Duration(minutes: 2),
        createdAt: _fixedNow.add(const Duration(minutes: 2)),
      ),
    ],
  );
}

class _Harness {
  _Harness({
    required this.job,
    required this.queue,
    required this.sessions,
    required this.lectures,
    required this.api,
    required this.uploader,
  });

  final UploadJob job;
  final UploadQueueRepository queue;
  final RecordingSessionRepository sessions;
  final _FakeLectureRepository lectures;
  final _FakeUploadApi api;
  final RecordingUploader uploader;
}

class _FakeUploadApi implements UploadApi {
  _FakeUploadApi({
    this.chunkSize = _chunkSize,
    Iterable<int> receivedChunks = const <int>[],
    this.sessionStatus = UploadSessionStatus.pending,
    this.failAtChunk,
    this.chunkFailure,
  }) : received = <int>{...receivedChunks};

  final int chunkSize;
  final Set<int> received;
  final UploadSessionStatus sessionStatus;
  final String uploadId = 'upload-1';
  final String videoId = 'video-1';
  final int? failAtChunk;
  final Object? chunkFailure;

  int createCalls = 0;
  int getCalls = 0;
  int completeCalls = 0;
  int abandonCalls = 0;
  final List<String> tokens = <String>[];
  final List<int> putIndexes = <int>[];
  final Map<int, List<int>> putBytes = <int, List<int>>{};
  String? lastClientReference;
  String? lastFilename;
  String? lastContentType;
  int? lastTotalBytes;
  int? lastDurationMs;
  List<RecordingMarker> lastMarkers = const <RecordingMarker>[];

  @override
  Future<UploadSessionState> createSession({
    required String accessToken,
    required String filename,
    required int totalBytes,
    required String contentType,
    required String title,
    required int durationMs,
    required String clientReference,
    required List<RecordingMarker> markers,
  }) async {
    createCalls++;
    tokens.add(accessToken);
    lastFilename = filename;
    lastTotalBytes = totalBytes;
    lastContentType = contentType;
    lastDurationMs = durationMs;
    lastClientReference = clientReference;
    lastMarkers = markers;
    return _state();
  }

  @override
  Future<UploadSessionState> getSession({
    required String accessToken,
    required String uploadId,
  }) async {
    getCalls++;
    tokens.add(accessToken);
    return _state();
  }

  @override
  Future<UploadChunkReceipt> putChunk({
    required String accessToken,
    required String uploadId,
    required int index,
    required List<int> bytes,
  }) async {
    tokens.add(accessToken);
    final failure = chunkFailure;
    if (failure != null && failAtChunk == index) {
      throw failure;
    }
    putIndexes.add(index);
    putBytes[index] = List<int>.from(bytes);
    received.add(index);
    return UploadChunkReceipt(
      receivedChunks: received.toList()..sort(),
      receivedBytes: putBytes.values.fold(
        0,
        (total, chunk) => total + chunk.length,
      ),
    );
  }

  @override
  Future<UploadCompletion> completeSession({
    required String accessToken,
    required String uploadId,
  }) async {
    completeCalls++;
    tokens.add(accessToken);
    return UploadCompletion(uploadId: uploadId, videoId: videoId);
  }

  @override
  Future<void> abandonSession({
    required String accessToken,
    required String uploadId,
  }) async {
    abandonCalls++;
    tokens.add(accessToken);
  }

  UploadSessionState _state() {
    return UploadSessionState(
      uploadId: uploadId,
      chunkSize: chunkSize,
      totalBytes: _fileLength,
      receivedChunks: received.toList()..sort(),
      status: sessionStatus,
      videoId: sessionStatus == UploadSessionStatus.completed ? videoId : null,
    );
  }
}

class _FakeLectureRepository implements LectureRepository {
  final Map<String, Lecture> lectures = <String, Lecture>{};

  @override
  Future<List<Lecture>> getLectures() async => lectures.values.toList();

  @override
  Future<Lecture?> getLecture(String id) async => lectures[id];

  @override
  Future<Lecture> createLecture(Lecture lecture) async {
    lectures[lecture.id] = lecture;
    return lecture;
  }

  @override
  Future<void> saveLecture(Lecture lecture) async {
    lectures[lecture.id] = lecture;
  }
}
