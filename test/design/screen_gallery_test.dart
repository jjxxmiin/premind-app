@Tags(<String>['gallery'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:premind/app/theme.dart';
import 'package:premind/features/auth/presentation/email_login_screen.dart';
import 'package:premind/features/auth/presentation/login_screen.dart';
import 'package:premind/features/home/presentation/home_screen.dart';
import 'package:premind/features/lectures/data/lecture_repository.dart';
import 'package:premind/features/lectures/domain/lecture.dart';
import 'package:premind/features/lectures/presentation/lecture_detail_screen.dart';
import 'package:premind/features/lectures/presentation/lecture_providers.dart';
import 'package:premind/features/lectures/presentation/lectures_screen.dart';
import 'package:premind/features/profile/presentation/profile_screen.dart';
import 'package:premind/features/recording/data/recording_session_repository.dart';
import 'package:premind/features/recording/presentation/recording_session_providers.dart';
import 'package:premind/features/upload/domain/upload_job.dart';
import 'package:premind/features/upload/presentation/upload_providers.dart';
import 'package:premind/features/recording/domain/recording_session.dart';
import 'package:premind/features/recording/presentation/recording_complete_screen.dart';
import 'package:premind/features/recording/presentation/recording_controller.dart';
import 'package:premind/features/recording/presentation/recording_screen.dart';
import 'package:premind/features/recording/presentation/recording_state.dart';
import 'package:shared_preferences/shared_preferences.dart';
// ignore: depend_on_referenced_packages
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
// ignore: depend_on_referenced_packages
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

/// Renders each screen to a PNG so the design can be reviewed as pixels rather
/// than as code. Not part of the default suite; refresh the images with:
///
/// ```
/// flutter test --tags gallery --run-skipped --update-goldens test/design
/// ```
void main() {
  setUpAll(() async {
    // Without the real typeface the test font draws every glyph as a box, which
    // hides exactly what a design review needs to see.
    await _loadPretendard();
  });

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    // The recording controller builds an AudioRecorder eagerly; there is no
    // microphone plugin in a widget test, so answer its channel with nulls.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('com.llfbandit.record/messages'),
          (call) async => null,
        );
  });

  Future<void> capture(WidgetTester tester, String name, Widget scope) async {
    // Rendered at 2x so type weight, spacing, and colour can be judged.
    tester.view.devicePixelRatio = 2;
    tester.view.physicalSize = const Size(390 * 2, 844 * 2);
    addTearDown(tester.view.reset);

    await tester.pumpWidget(scope);
    // Let implicit animations finish: a half-animated frame misreports colours
    // (a button's label is still mid-fade toward its foreground colour).
    // Screens with a perpetual animation — a spinner, a pulsing dot — never
    // settle, so fall back to the frame we have.
    try {
      await tester.pumpAndSettle(
        const Duration(milliseconds: 50),
        EnginePhase.sendSemanticsUpdate,
        const Duration(seconds: 5),
      );
    } on FlutterError {
      await tester.pump(const Duration(milliseconds: 400));
    }
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('images/$name.png'),
    );
  }

  testWidgets('recording · active', (tester) async {
    await capture(
      tester,
      'recording-active',
      ProviderScope(
        overrides: [
          recordingControllerProvider.overrideWith2(
            (title) => _StubRecordingController(
              title,
              _recordingState(status: RecordingFlowStatus.recording),
            ),
          ),
        ],
        child: _app(const RecordingScreen(title: '인공지능 개론 3주차')),
      ),
    );
  });

  testWidgets('recording · paused', (tester) async {
    await capture(
      tester,
      'recording-paused',
      ProviderScope(
        overrides: [
          recordingControllerProvider.overrideWith2(
            (title) => _StubRecordingController(
              title,
              _recordingState(status: RecordingFlowStatus.paused),
            ),
          ),
        ],
        child: _app(const RecordingScreen(title: '인공지능 개론 3주차')),
      ),
    );
  });

  testWidgets('recording · complete', (tester) async {
    await capture(
      tester,
      'recording-complete',
      ProviderScope(
        child: _app(
          RecordingCompleteScreen(
            recording: _recordingState(status: RecordingFlowStatus.completed),
          ),
        ),
      ),
    );
  });

  testWidgets('home · upload in flight', (tester) async {
    await capture(
      tester,
      'home-uploading',
      ProviderScope(
        overrides: [
          lectureRepositoryProvider.overrideWithValue(
            _GalleryLectureRepository(),
          ),
          recordingSessionRepositoryProvider.overrideWithValue(
            _GallerySessionRepository(),
          ),
          uploadQueueProvider.overrideWith(_GalleryUploadQueue.new),
        ],
        child: _app(
          HomeScreen(
            onStartRecording: () {},
            onVideoTap: () {},
            onLectureTap: (_) {},
            onRecoverLecture: (_) {},
          ),
        ),
      ),
    );
  });

  testWidgets('lectures', (tester) async {
    await capture(
      tester,
      'lectures',
      ProviderScope(
        overrides: [
          lectureRepositoryProvider.overrideWithValue(
            _GalleryLectureRepository(),
          ),
        ],
        child: _app(LecturesScreen(onLectureTap: (_) {})),
      ),
    );
  });

  testWidgets('lecture detail', (tester) async {
    await capture(
      tester,
      'lecture-detail',
      ProviderScope(
        overrides: [
          lectureRepositoryProvider.overrideWithValue(
            _GalleryLectureRepository(),
          ),
        ],
        child: _app(
          LectureDetailScreen(lectureId: 'lecture-1', onShare: () {}),
        ),
      ),
    );
  });

  testWidgets('profile', (tester) async {
    await capture(
      tester,
      'profile',
      ProviderScope(child: _app(ProfileScreen(onLogout: () {}))),
    );
  });

  testWidgets('email login', (tester) async {
    await capture(
      tester,
      'email-login',
      ProviderScope(child: _app(EmailLoginScreen(onLoginSuccess: () {}))),
    );
  });

  testWidgets('login', (tester) async {
    await capture(
      tester,
      'login',
      ProviderScope(
        child: _app(
          LoginScreen(showDevelopmentLogin: true, onLoginSuccess: () {}),
        ),
      ),
    );
  });
}

/// Registers the bundled Pretendard faces with the test font system.
Future<void> _loadPretendard() async {
  const faces = <String>[
    'Pretendard-Regular',
    'Pretendard-Medium',
    'Pretendard-SemiBold',
    'Pretendard-Bold',
    'Pretendard-ExtraBold',
  ];
  final loader = FontLoader('Pretendard');
  for (final face in faces) {
    final bytes = await File('assets/fonts/$face.otf').readAsBytes();
    loader.addFont(Future<ByteData>.value(ByteData.sublistView(bytes)));
  }
  await loader.load();

  // Material icons otherwise render as empty boxes, hiding the control shapes.
  final flutterRoot = Platform.environment['FLUTTER_ROOT'];
  final iconFont = File(
    '$flutterRoot/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  );
  if (!iconFont.existsSync()) {
    // Better a loud gallery than a silent one full of empty boxes.
    throw StateError('Material icon font not found at ${iconFont.path}');
  }
  if (iconFont.existsSync()) {
    final icons = FontLoader('MaterialIcons')
      ..addFont(
        Future<ByteData>.value(
          ByteData.sublistView(iconFont.readAsBytesSync()),
        ),
      );
    await icons.load();
  }
}

/// The app shell every gallery entry is drawn inside.
Widget _app(Widget screen) {
  return MaterialApp(theme: appTheme, locale: const Locale('ko'), home: screen);
}

RecordingState _recordingState({required RecordingFlowStatus status}) {
  return RecordingState(
    title: '인공지능 개론 3주차',
    status: status,
    elapsed: const Duration(minutes: 42, seconds: 17),
    amplitude: 0.62,
    markers: <RecordingMarker>[
      RecordingMarker(
        timestamp: const Duration(minutes: 12),
        createdAt: DateTime.utc(2026, 8, 20, 12),
      ),
      RecordingMarker(
        timestamp: const Duration(minutes: 31),
        createdAt: DateTime.utc(2026, 8, 20, 12, 20),
      ),
    ],
    sessionId: 'session-1',
    lectureId: 'lecture-1',
    filePath: '/tmp/premind_session-1.m4a',
  );
}

/// Holds a fixed state so a screen can be drawn without a microphone.
class _StubRecordingController extends RecordingController {
  _StubRecordingController(super.title, this._state);

  final RecordingState _state;

  @override
  RecordingState build() => _state;
}

/// A small, realistic library so list and detail screens have something to show.
class _GalleryLectureRepository implements LectureRepository {
  final List<Lecture> _lectures = <Lecture>[
    Lecture(
      id: 'lecture-1',
      title: '인공지능 개론 3주차',
      createdAt: DateTime(2026, 8, 18, 17, 10),
      duration: const Duration(minutes: 52, seconds: 14),
      status: LectureStatus.completed,
      recordingType: RecordingType.audio,
      summary: '오늘 강의에서는 머신러닝의 기본 개념과 지도학습 원리를 중심으로 설명했습니다.',
      keyPoints: const <String>['머신러닝의 정의', '지도학습과 비지도학습', '학습 데이터의 역할'],
      markers: const <LectureMarker>[
        LectureMarker(
          timestamp: Duration(minutes: 32, seconds: 18),
          label: '교수자 중요 표시',
        ),
      ],
    ),
    Lecture(
      id: 'lecture-2',
      title: '자료구조 2주차 · 배열과 리스트',
      createdAt: DateTime(2026, 8, 15, 10, 0),
      duration: const Duration(minutes: 48),
      status: LectureStatus.uploadPending,
      recordingType: RecordingType.audio,
    ),
  ];

  @override
  Future<List<Lecture>> getLectures() async => _lectures;

  @override
  Future<Lecture?> getLecture(String id) async =>
      _lectures.where((lecture) => lecture.id == id).firstOrNull;

  @override
  Future<Lecture> createLecture(Lecture lecture) async => lecture;

  @override
  Future<void> saveLecture(Lecture lecture) async {}
}

class _GallerySessionRepository implements RecordingSessionRepository {
  final RecordingSession _session = RecordingSession(
    id: 'session-2',
    lectureId: 'lecture-2',
    startedAt: DateTime(2026, 8, 15, 10),
    endedAt: DateTime(2026, 8, 15, 10, 48),
    localFilePath: '/tmp/premind_session-2.m4a',
    duration: const Duration(minutes: 48),
    status: RecordingSessionStatus.completed,
    uploadStatus: UploadStatus.uploading,
  );

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

class _GalleryUploadQueue extends UploadQueueNotifier {
  @override
  Future<List<UploadJob>> build() async => <UploadJob>[
    UploadJob(
      id: 'session-2',
      lectureId: 'lecture-2',
      filePath: '/tmp/premind_session-2.m4a',
      title: '자료구조 2주차 · 배열과 리스트',
      durationMs: 2880000,
      totalBytes: 40 * 1024 * 1024,
      chunkSize: 8 * 1024 * 1024,
      uploadedChunks: const <int>[0, 1],
      status: UploadJobStatus.uploading,
      attempts: 0,
      createdAt: DateTime(2026, 8, 15, 10, 48),
      updatedAt: DateTime(2026, 8, 15, 10, 50),
    ),
  ];
}
