@Tags(<String>['live'])
library;

import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:premind/core/network/api_client.dart';
import 'package:premind/core/network/api_config.dart';
import 'package:premind/features/recording/domain/recording_session.dart';
import 'package:premind/features/upload/data/upload_api.dart';

/// Drives the real [HttpUploadApi] against a running PREMIND API so the app's
/// wire format is checked against the server rather than against a fake.
///
/// Skipped by default (see `dart_test.yaml`); run it with a server up:
///
/// ```
/// flutter test --tags live --run-skipped \
///   test/live_upload_integration_test.dart \
///   --dart-define=API_BASE_URL=http://127.0.0.1:8777
/// ```
void main() {
  const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:8777',
  );
  const password = 'Premind1234';

  late ApiClient apiClient;
  late HttpUploadApi uploadApi;
  late String accessToken;
  late Directory workspace;

  setUpAll(() async {
    apiClient = ApiClient(config: ApiConfig(baseUrl: baseUrl));
    uploadApi = HttpUploadApi(apiClient: apiClient);

    // A fresh account per run: uploads consume the organisation's free share
    // rooms, so a reused account eventually answers 402 instead of exercising
    // the upload path.
    final email = 'live-${DateTime.now().microsecondsSinceEpoch}@premind.test';
    final registered = await apiClient.postJson(
      '/api/auth/register',
      <String, Object?>{
        'email': email,
        'name': '라이브 테스트 사용자',
        'password': password,
      },
    );
    accessToken = registered['access_token']! as String;
  });

  tearDownAll(() => apiClient.close());

  setUp(() => workspace = Directory.systemTemp.createTempSync('premind_live'));
  tearDown(() => workspace.deleteSync(recursive: true));

  /// Big enough to exceed the server's chunk size, so resume has real chunks
  /// to skip rather than degenerating into a single-chunk upload.
  const recordingBytes = 20 * 1024 * 1024;

  File writeRecording([int bytes = recordingBytes]) {
    final pattern = Uint8List.fromList(
      List<int>.generate(4096, (index) => (index * 31 + 7) % 256),
    );
    final file = File('${workspace.path}/premind_lecture.m4a');
    final sink = file.openSync(mode: FileMode.write);
    try {
      var written = 0;
      while (written < bytes) {
        final take = min(pattern.length, bytes - written);
        sink.writeFromSync(pattern, 0, take);
        written += take;
      }
      sink.flushSync();
    } finally {
      sink.closeSync();
    }
    return file;
  }

  Future<List<int>> readChunk(File file, int index, int chunkSize) async {
    final handle = await file.open();
    try {
      await handle.setPosition(index * chunkSize);
      final remaining = await file.length() - index * chunkSize;
      // Must await before the finally block closes the handle, or dart:io
      // throws "An async operation is currently pending".
      return await handle.read(min(chunkSize, remaining));
    } finally {
      await handle.close();
    }
  }

  test(
    'uploads a recording end to end and the server keeps every byte',
    () async {
      final file = writeRecording();
      final total = await file.length();
      final reference = 'live-${DateTime.now().microsecondsSinceEpoch}';

      final session = await uploadApi.createSession(
        accessToken: accessToken,
        filename: 'premind_lecture.m4a',
        totalBytes: total,
        contentType: 'audio/mp4',
        title: '라이브 통합 테스트 강의',
        durationMs: 3120000,
        clientReference: reference,
        markers: <RecordingMarker>[
          RecordingMarker(
            timestamp: const Duration(minutes: 1, seconds: 1),
            createdAt: DateTime.now(),
          ),
        ],
      );
      expect(session.receivedChunks, isEmpty);
      expect(session.totalBytes, total);
      expect(session.chunkSize, greaterThan(0));

      final chunkCount = (total / session.chunkSize).ceil();
      for (var index = 0; index < chunkCount; index++) {
        final receipt = await uploadApi.putChunk(
          accessToken: accessToken,
          uploadId: session.uploadId,
          index: index,
          bytes: await readChunk(file, index, session.chunkSize),
        );
        expect(receipt.receivedChunks, contains(index));
      }

      final completion = await uploadApi.completeSession(
        accessToken: accessToken,
        uploadId: session.uploadId,
      );
      expect(completion.videoId, isNotEmpty);

      // Repeating a lost completion must not create a second lecture.
      final repeat = await uploadApi.completeSession(
        accessToken: accessToken,
        uploadId: session.uploadId,
      );
      expect(repeat.videoId, completion.videoId);
    },
  );

  test(
    'resumes after a dropped connection without re-sending chunks',
    () async {
      final file = writeRecording();
      final total = await file.length();
      final reference = 'live-resume-${DateTime.now().microsecondsSinceEpoch}';

      Future<UploadSessionState> init() => uploadApi.createSession(
        accessToken: accessToken,
        filename: 'premind_lecture.m4a',
        totalBytes: total,
        contentType: 'audio/mp4',
        title: '재개 테스트 강의',
        durationMs: 600000,
        clientReference: reference,
        markers: const <RecordingMarker>[],
      );

      final first = await init();
      final chunkCount = (total / first.chunkSize).ceil();
      expect(
        chunkCount,
        greaterThan(1),
        reason: 'need multiple chunks to resume',
      );

      await uploadApi.putChunk(
        accessToken: accessToken,
        uploadId: first.uploadId,
        index: 0,
        bytes: await readChunk(file, 0, first.chunkSize),
      );

      // The app lost its upload id (reinstall, crash). Re-initialising on the
      // same recording id must recover the session, not start a second upload.
      final recovered = await init();
      expect(recovered.uploadId, first.uploadId);
      expect(recovered.receivedChunks, <int>[0]);

      for (var index = 1; index < chunkCount; index++) {
        await uploadApi.putChunk(
          accessToken: accessToken,
          uploadId: recovered.uploadId,
          index: index,
          bytes: await readChunk(file, index, recovered.chunkSize),
        );
      }

      final completion = await uploadApi.completeSession(
        accessToken: accessToken,
        uploadId: recovered.uploadId,
      );
      expect(completion.videoId, isNotEmpty);
    },
  );

  test('refuses to finalise a recording with a missing chunk', () async {
    final file = writeRecording();
    final total = await file.length();

    final session = await uploadApi.createSession(
      accessToken: accessToken,
      filename: 'premind_lecture.m4a',
      totalBytes: total,
      contentType: 'audio/mp4',
      title: '누락 청크 테스트',
      durationMs: 600000,
      clientReference: 'live-gap-${DateTime.now().microsecondsSinceEpoch}',
      markers: const <RecordingMarker>[],
    );
    await uploadApi.putChunk(
      accessToken: accessToken,
      uploadId: session.uploadId,
      index: 0,
      bytes: await readChunk(file, 0, session.chunkSize),
    );

    await expectLater(
      uploadApi.completeSession(
        accessToken: accessToken,
        uploadId: session.uploadId,
      ),
      throwsA(
        isA<ApiException>().having((e) => e.statusCode, 'statusCode', 409),
      ),
    );
  });

  test('rejects an unauthenticated upload', () async {
    await expectLater(
      uploadApi.createSession(
        accessToken: 'not-a-real-token',
        filename: 'x.m4a',
        totalBytes: 1024,
        contentType: 'audio/mp4',
        title: 'nope',
        durationMs: 1000,
        clientReference: 'live-unauth',
        markers: const <RecordingMarker>[],
      ),
      throwsA(
        isA<ApiException>().having(
          (e) => e.statusCode,
          'statusCode',
          anyOf(401, 403),
        ),
      ),
    );
  });

  test('abandoning an upload releases it', () async {
    final session = await uploadApi.createSession(
      accessToken: accessToken,
      filename: 'premind_lecture.m4a',
      totalBytes: 2048,
      contentType: 'audio/mp4',
      title: '취소 테스트',
      durationMs: 1000,
      clientReference: 'live-abort-${DateTime.now().microsecondsSinceEpoch}',
      markers: const <RecordingMarker>[],
    );

    await uploadApi.abandonSession(
      accessToken: accessToken,
      uploadId: session.uploadId,
    );

    await expectLater(
      uploadApi.completeSession(
        accessToken: accessToken,
        uploadId: session.uploadId,
      ),
      throwsA(
        isA<ApiException>().having((e) => e.statusCode, 'statusCode', 409),
      ),
    );
  });
}
