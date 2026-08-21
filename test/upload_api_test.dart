import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:premind/core/network/api_client.dart';
import 'package:premind/core/network/api_config.dart';
import 'package:premind/features/recording/domain/recording_session.dart';
import 'package:premind/features/upload/data/upload_api.dart';

void main() {
  group('HttpUploadApi', () {
    late _RecordingHttpClient httpClient;
    late HttpUploadApi api;

    void respond(Future<http.Response> Function(http.BaseRequest) handler) {
      httpClient.handler = handler;
    }

    setUp(() {
      httpClient = _RecordingHttpClient();
      api = HttpUploadApi(
        apiClient: ApiClient(
          config: ApiConfig(baseUrl: 'http://api.test'),
          httpClient: httpClient,
        ),
      );
    });

    test('createSession posts the documented payload', () async {
      respond(
        (_) async => _jsonResponse(201, <String, Object?>{
          'upload_id': 'upload-1',
          'chunk_size': 5242880,
          'total_bytes': 12345,
          'received_chunks': <Object?>[0, 1],
          'status': 'pending',
          'video_id': null,
        }),
      );

      final session = await api.createSession(
        accessToken: 'access-1',
        filename: 'premind_session.m4a',
        totalBytes: 12345,
        contentType: 'audio/mp4',
        title: '자료구조 3주차',
        durationMs: 720000,
        clientReference: 'session-1',
        markers: <RecordingMarker>[
          RecordingMarker(
            timestamp: const Duration(minutes: 2),
            createdAt: DateTime.utc(2026, 8, 20, 9, 2),
          ),
        ],
      );

      final request = httpClient.requests.single as http.Request;
      expect(request.method, 'POST');
      expect(request.url.toString(), 'http://api.test/api/uploads');
      expect(request.headers['Authorization'], 'Bearer access-1');

      final body = jsonDecode(request.body) as Map<String, Object?>;
      expect(body['filename'], 'premind_session.m4a');
      expect(body['total_bytes'], 12345);
      expect(body['content_type'], 'audio/mp4');
      expect(body['title'], '자료구조 3주차');
      expect(body['duration_ms'], 720000);
      expect(body['client_reference'], 'session-1');
      expect(body['markers'], <Object?>[
        <String, Object?>{
          'timestamp_ms': 120000,
          'created_at': '2026-08-20T09:02:00.000Z',
        },
      ]);

      expect(session.uploadId, 'upload-1');
      expect(session.chunkSize, 5242880);
      expect(session.receivedChunks, <int>[0, 1]);
      expect(session.isCompleted, isFalse);
    });

    test('getSession reads the resume point', () async {
      respond(
        (_) async => _jsonResponse(200, <String, Object?>{
          'upload_id': 'upload-1',
          'chunk_size': 1024,
          'total_bytes': 4096,
          'received_chunks': <Object?>[0, 2],
          'status': 'completed',
          'video_id': 'video-9',
        }),
      );

      final session = await api.getSession(
        accessToken: 'access-1',
        uploadId: 'upload-1',
      );

      final request = httpClient.requests.single;
      expect(request.method, 'GET');
      expect(request.url.path, '/api/uploads/upload-1');
      expect(session.isCompleted, isTrue);
      expect(session.videoId, 'video-9');
      expect(session.receivedChunks, <int>[0, 2]);
    });

    test('putChunk sends raw bytes to the indexed chunk path', () async {
      respond(
        (_) async => _jsonResponse(200, <String, Object?>{
          'received_chunks': <Object?>[0, 1],
          'received_bytes': 2048,
        }),
      );

      final receipt = await api.putChunk(
        accessToken: 'access-1',
        uploadId: 'upload-1',
        index: 1,
        bytes: const <int>[1, 2, 3, 4],
      );

      final request = httpClient.requests.single as http.Request;
      expect(request.method, 'PUT');
      expect(request.url.path, '/api/uploads/upload-1/chunks/1');
      expect(request.headers['Content-Type'], 'application/octet-stream');
      expect(request.bodyBytes, <int>[1, 2, 3, 4]);
      expect(receipt.receivedChunks, <int>[0, 1]);
      expect(receipt.receivedBytes, 2048);
    });

    test('completeSession returns the video id', () async {
      respond(
        (_) async => _jsonResponse(200, <String, Object?>{
          'upload_id': 'upload-1',
          'status': 'completed',
          'video_id': 'video-9',
        }),
      );

      final completion = await api.completeSession(
        accessToken: 'access-1',
        uploadId: 'upload-1',
      );

      final request = httpClient.requests.single;
      expect(request.method, 'POST');
      expect(request.url.path, '/api/uploads/upload-1/complete');
      expect(completion.videoId, 'video-9');
    });

    test('completeSession surfaces a missing-chunk 409', () async {
      respond(
        (_) async => _jsonResponse(409, <String, Object?>{
          'detail': 'Missing chunks: [2]',
        }),
      );

      await expectLater(
        api.completeSession(accessToken: 'access-1', uploadId: 'upload-1'),
        throwsA(
          isA<ApiException>()
              .having((error) => error.statusCode, 'statusCode', 409)
              .having(
                (error) => error.message,
                'message',
                'Missing chunks: [2]',
              ),
        ),
      );
    });

    test('abandonSession deletes the session and tolerates a 204', () async {
      respond((_) async => http.Response('', 204));

      await api.abandonSession(accessToken: 'access-1', uploadId: 'upload-1');

      final request = httpClient.requests.single;
      expect(request.method, 'DELETE');
      expect(request.url.path, '/api/uploads/upload-1');
      expect(request.headers['Authorization'], 'Bearer access-1');
    });
  });
}

http.Response _jsonResponse(int statusCode, Map<String, Object?> body) {
  return http.Response.bytes(
    utf8.encode(jsonEncode(body)),
    statusCode,
    headers: const <String, String>{'content-type': 'application/json'},
  );
}

class _RecordingHttpClient extends http.BaseClient {
  Future<http.Response> Function(http.BaseRequest request)? handler;
  final requests = <http.BaseRequest>[];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    requests.add(request);
    final response = await handler!(request);
    return http.StreamedResponse(
      Stream.value(response.bodyBytes),
      response.statusCode,
      headers: response.headers,
      request: request,
    );
  }
}
