import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:premind/app/theme.dart';
import 'package:premind/features/home/presentation/home_screen.dart';
import 'package:premind/features/lectures/data/lecture_repository.dart';
import 'package:premind/features/lectures/domain/lecture.dart';
import 'package:premind/features/lectures/presentation/lecture_providers.dart';
import 'package:premind/features/recording/data/recording_session_repository.dart';
import 'package:premind/features/recording/domain/recording_session.dart';
import 'package:premind/features/recording/presentation/recording_session_providers.dart';
import 'package:premind/features/upload/domain/upload_job.dart';
import 'package:premind/features/upload/presentation/upload_providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The home banner is the only place a user sees whether a finished recording
/// actually reached the server, so each queue state must read differently.
void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  Future<void> pumpHome(
    WidgetTester tester, {
    required UploadJob? job,
    VoidCallback? onRecover,
  }) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          recordingSessionRepositoryProvider.overrideWithValue(
            _RecoverableSessionRepository(_session),
          ),
          lectureRepositoryProvider.overrideWithValue(
            _EmptyLectureRepository(),
          ),
          uploadQueueProvider.overrideWith(
            () => _StubUploadQueue(
              job == null ? <UploadJob>[] : <UploadJob>[job],
            ),
          ),
        ],
        child: MaterialApp(
          theme: appTheme,
          home: HomeScreen(
            onStartRecording: () {},
            onVideoTap: () {},
            onLectureTap: (_) {},
            onRecoverLecture: (_) => onRecover?.call(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('an unqueued recording still offers to continue', (tester) async {
    await pumpHome(tester, job: null);

    expect(find.text('업로드하지 않은 강의가 있어요'), findsOneWidget);
    expect(find.text('정리 계속'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);
  });

  testWidgets('an upload in flight shows its progress', (tester) async {
    await pumpHome(
      tester,
      job: _job(
        status: UploadJobStatus.uploading,
        chunkSize: 1000,
        uploadedChunks: const <int>[0, 1],
      ),
    );

    expect(find.text('강의를 업로드하고 있어요'), findsOneWidget);
    expect(find.textContaining('50%'), findsOneWidget);
    final bar = tester.widget<LinearProgressIndicator>(
      find.byType(LinearProgressIndicator),
    );
    expect(bar.value, closeTo(0.5, 0.001));
  });

  testWidgets('a retryable failure promises to keep trying', (tester) async {
    await pumpHome(
      tester,
      job: _job(
        status: UploadJobStatus.failed,
        nextAttemptAt: DateTime.utc(2026, 8, 20, 12, 5),
      ),
    );

    expect(find.text('업로드를 다시 시도할게요'), findsOneWidget);
    expect(find.textContaining('네트워크가 돌아오면'), findsOneWidget);
    // A self-healing retry must not nag the user with a button.
    expect(find.text('다시 시도'), findsNothing);
  });

  testWidgets('a terminal failure offers a retry button', (tester) async {
    await pumpHome(tester, job: _job(status: UploadJobStatus.failed));

    expect(find.text('업로드하지 못했어요'), findsOneWidget);
    expect(find.textContaining('기기에 그대로 있어요'), findsOneWidget);
    expect(find.text('다시 시도'), findsOneWidget);
    expect(find.text('정리 계속'), findsNothing);
  });

  testWidgets('a queued recording says it is waiting', (tester) async {
    await pumpHome(tester, job: _job(status: UploadJobStatus.queued));

    expect(find.text('업로드를 기다리고 있어요'), findsOneWidget);
  });
}

final _session = RecordingSession(
  id: 'session-1',
  lectureId: 'lecture-1',
  startedAt: DateTime.utc(2026, 8, 20, 11),
  endedAt: DateTime.utc(2026, 8, 20, 12),
  localFilePath: '/tmp/session-1.m4a',
  duration: const Duration(minutes: 52),
  status: RecordingSessionStatus.completed,
  uploadStatus: UploadStatus.pending,
);

UploadJob _job({
  required UploadJobStatus status,
  int? chunkSize,
  List<int> uploadedChunks = const <int>[],
  DateTime? nextAttemptAt,
}) {
  final now = DateTime.utc(2026, 8, 20, 12);
  return UploadJob(
    id: _session.id,
    lectureId: _session.lectureId,
    filePath: _session.localFilePath,
    title: '인공지능 개론',
    durationMs: 3120000,
    totalBytes: 4000,
    chunkSize: chunkSize,
    uploadedChunks: uploadedChunks,
    status: status,
    attempts: status == UploadJobStatus.failed ? 1 : 0,
    nextAttemptAt: nextAttemptAt,
    createdAt: now,
    updatedAt: now,
  );
}

class _StubUploadQueue extends UploadQueueNotifier {
  _StubUploadQueue(this._jobs);

  final List<UploadJob> _jobs;

  @override
  Future<List<UploadJob>> build() async => _jobs;
}

class _RecoverableSessionRepository implements RecordingSessionRepository {
  _RecoverableSessionRepository(this._session);

  final RecordingSession _session;

  @override
  Future<List<RecordingSession>> getRecoverable() async => <RecordingSession>[
    _session,
  ];

  @override
  Future<List<RecordingSession>> getAll() async => <RecordingSession>[_session];

  @override
  Future<RecordingSession?> get(String id) async =>
      id == _session.id ? _session : null;

  @override
  Future<void> save(RecordingSession session) async {}

  @override
  Future<void> remove(String id) async {}
}

class _EmptyLectureRepository implements LectureRepository {
  @override
  Future<List<Lecture>> getLectures() async => const <Lecture>[];

  @override
  Future<Lecture?> getLecture(String id) async => null;

  @override
  Future<Lecture> createLecture(Lecture lecture) async => lecture;

  @override
  Future<void> saveLecture(Lecture lecture) async {}
}
