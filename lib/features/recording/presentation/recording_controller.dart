import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';
import 'package:uuid/uuid.dart';

import '../../lectures/data/lecture_repository.dart';
import '../../lectures/domain/lecture.dart';
import '../../lectures/presentation/lecture_providers.dart';
import '../../upload/data/upload_queue_repository.dart';
import '../../upload/domain/upload_job.dart';
import '../../upload/presentation/upload_providers.dart';
import '../data/recording_session_repository.dart';
import '../domain/recording_session.dart';
import 'recording_session_providers.dart';
import 'recording_state.dart';

final recordingControllerProvider = NotifierProvider.autoDispose
    .family<RecordingController, RecordingState, String>(
      RecordingController.new,
    );

class RecordingController extends Notifier<RecordingState> {
  RecordingController(this._title);

  final String _title;
  final AudioRecorder _recorder = AudioRecorder();
  final Stopwatch _stopwatch = Stopwatch();
  final Uuid _uuid = const Uuid();

  Timer? _ticker;
  StreamSubscription<Amplitude>? _amplitudeSubscription;
  StreamSubscription<RecordState>? _recordStateSubscription;
  late RecordingSessionRepository _sessionRepository;
  late LectureRepository _lectureRepository;
  late UploadQueueRepository _uploadQueueRepository;
  Future<void> _transitionTail = Future<void>.value();
  DateTime? _startedAt;
  bool _finishing = false;
  bool _disposed = false;
  bool _recorderStartRequested = false;

  @override
  RecordingState build() {
    _sessionRepository = ref.read(recordingSessionRepositoryProvider);
    _lectureRepository = ref.read(lectureRepositoryProvider);
    _uploadQueueRepository = ref.read(uploadQueueRepositoryProvider);
    ref.onDispose(() {
      final snapshot = state;
      _disposed = true;
      _ticker?.cancel();
      _stopwatch.stop();
      unawaited(_closeRecorderSafely(snapshot));
    });
    return RecordingState(title: _title);
  }

  Future<void> start() async {
    if (state.status == RecordingFlowStatus.preparing || state.isActive) {
      return;
    }

    _recorderStartRequested = false;
    state = state.copyWith(
      status: RecordingFlowStatus.preparing,
      errorMessage: '',
      permissionPermanentlyDenied: false,
    );

    try {
      var permission = await Permission.microphone.status;
      if (_disposed) {
        return;
      }
      if (!permission.isGranted) {
        permission = await Permission.microphone.request();
      }
      if (_disposed) {
        return;
      }

      if (!permission.isGranted) {
        state = state.copyWith(
          status: RecordingFlowStatus.permissionDenied,
          permissionPermanentlyDenied:
              permission.isPermanentlyDenied || permission.isRestricted,
        );
        return;
      }

      final recorderPermission = await _recorder.hasPermission(request: false);
      if (_disposed) {
        return;
      }
      if (!recorderPermission) {
        state = state.copyWith(status: RecordingFlowStatus.permissionDenied);
        return;
      }

      final documentsDirectory = await getApplicationDocumentsDirectory();
      if (_disposed) {
        return;
      }
      final recordingsDirectory = Directory(
        '${documentsDirectory.path}${Platform.pathSeparator}recordings',
      );
      await recordingsDirectory.create(recursive: true);
      if (_disposed) {
        return;
      }

      final sessionId = _uuid.v4();
      final lectureId = _uuid.v4();
      final startedAt = DateTime.now();
      final filePath =
          '${recordingsDirectory.path}${Platform.pathSeparator}'
          'premind_$sessionId.m4a';

      _startedAt = startedAt;
      state = state.copyWith(
        sessionId: sessionId,
        lectureId: lectureId,
        filePath: filePath,
      );

      await _sessionRepository.save(
        RecordingSession(
          id: sessionId,
          lectureId: lectureId,
          startedAt: startedAt,
          localFilePath: filePath,
          duration: Duration.zero,
          status: RecordingSessionStatus.recording,
          uploadStatus: UploadStatus.pending,
          markers: const [],
        ),
      );
      if (_disposed) {
        return;
      }

      await ref
          .read(lecturesProvider.notifier)
          .addLecture(
            Lecture(
              id: lectureId,
              title: _title,
              createdAt: startedAt,
              duration: Duration.zero,
              status: LectureStatus.recording,
              recordingType: RecordingType.audio,
              localAudioPath: filePath,
            ),
          );
      if (_disposed) {
        return;
      }

      _recorderStartRequested = true;
      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 128000,
          sampleRate: 44100,
          numChannels: 1,
          autoGain: true,
          noiseSuppress: true,
          audioInterruption: AudioInterruptionMode.pause,
          androidConfig: AndroidRecordConfig(
            // ignore: deprecated_member_use
            service: AndroidService(
              title: 'PREMIND 강의 녹음 중',
              content: '화면을 닫아도 강의를 안전하게 기록하고 있어요.',
            ),
          ),
        ),
        path: filePath,
      );

      if (_disposed) {
        return;
      }

      _stopwatch
        ..reset()
        ..start();
      state = state.copyWith(status: RecordingFlowStatus.recording);
      _startMonitoring();
    } catch (error) {
      if (!_disposed) {
        await _markFailed(error);
      }
    }
  }

  void _startMonitoring() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_disposed) {
        return;
      }
      state = state.copyWith(elapsed: _stopwatch.elapsed);
      if (_stopwatch.elapsed.inSeconds > 0 &&
          _stopwatch.elapsed.inSeconds % 5 == 0) {
        unawaited(persistSnapshot());
      }
    });

    _amplitudeSubscription?.cancel();
    _amplitudeSubscription = _recorder
        .onAmplitudeChanged(const Duration(milliseconds: 140))
        .listen((amplitude) {
          if (_disposed || state.status != RecordingFlowStatus.recording) {
            return;
          }
          final normalized = amplitude.current.isFinite
              ? ((amplitude.current + 60) / 60).clamp(0.04, 1.0)
              : 0.04;
          state = state.copyWith(amplitude: normalized);
        }, onError: _handleAmplitudeError);

    _recordStateSubscription?.cancel();
    _recordStateSubscription = _recorder.onStateChanged().listen((value) {
      if (_disposed) {
        return;
      }
      if (value == RecordState.pause &&
          state.status == RecordingFlowStatus.recording &&
          !_finishing) {
        _stopwatch.stop();
        state = state.copyWith(
          status: RecordingFlowStatus.paused,
          elapsed: _stopwatch.elapsed,
          amplitude: 0,
        );
        unawaited(persistSnapshot());
      } else if (value == RecordState.stop && state.isActive && !_finishing) {
        unawaited(_handleUnexpectedNativeStop());
      }
    }, onError: _handleRecordStreamError);
  }

  void _handleAmplitudeError(Object error, StackTrace stackTrace) {
    if (!_disposed && state.isActive) {
      state = state.copyWith(errorMessage: '오디오 레벨을 확인할 수 없지만 녹음은 계속됩니다.');
    }
  }

  void _handleRecordStreamError(Object error, StackTrace stackTrace) {
    unawaited(_handleUnexpectedNativeStop());
  }

  Future<void> _handleUnexpectedNativeStop() {
    return _serializeTransition<void>(() async {
      if (_disposed || _finishing || !state.isActive) {
        return;
      }
      _ticker?.cancel();
      _stopwatch.stop();
      try {
        await _amplitudeSubscription?.cancel();
        await _recordStateSubscription?.cancel();
      } catch (_) {
        // Persist the failure even when a native stream cannot be cancelled.
      }
      await _markFailed(StateError('Native recorder stopped unexpectedly.'));
    });
  }

  Future<void> pause() {
    return _serializeTransition<void>(() async {
      if (_disposed ||
          _finishing ||
          state.status != RecordingFlowStatus.recording) {
        return;
      }
      try {
        await _recorder.pause();
        if (_disposed || _finishing || !state.isActive) {
          return;
        }
        _stopwatch.stop();
        state = state.copyWith(
          status: RecordingFlowStatus.paused,
          elapsed: _stopwatch.elapsed,
          amplitude: 0,
        );
        await persistSnapshot();
      } catch (_) {
        if (!_disposed && !_finishing && state.isActive) {
          state = state.copyWith(errorMessage: '일시정지하지 못했습니다. 다시 시도해 주세요.');
        }
      }
    });
  }

  Future<void> resume() {
    return _serializeTransition<void>(() async {
      if (_disposed ||
          _finishing ||
          state.status != RecordingFlowStatus.paused) {
        return;
      }
      try {
        await _recorder.resume();
        if (_disposed || _finishing || !state.isActive) {
          return;
        }
        _stopwatch.start();
        state = state.copyWith(status: RecordingFlowStatus.recording);
        await persistSnapshot();
      } catch (_) {
        if (!_disposed && !_finishing && state.isActive) {
          state = state.copyWith(errorMessage: '녹음을 다시 시작하지 못했습니다.');
        }
      }
    });
  }

  Future<void> addMarker() async {
    if (!state.isActive) {
      return;
    }
    final marker = RecordingMarker(
      timestamp: _stopwatch.elapsed,
      createdAt: DateTime.now(),
    );
    state = state.copyWith(markers: [...state.markers, marker]);
    await persistSnapshot();
  }

  Future<void> persistSnapshot() async {
    if (state.sessionId == null || _startedAt == null) {
      return;
    }
    try {
      await _sessionRepository.save(await _sessionFromState(state));
      if (!_disposed && state.errorMessage?.startsWith('세션 정보') == true) {
        state = state.copyWith(errorMessage: '');
      }
    } catch (_) {
      if (!_disposed) {
        state = state.copyWith(errorMessage: '세션 정보 저장이 지연되고 있어요. 녹음은 계속됩니다.');
      }
    }
  }

  Future<RecordingState?> finish() {
    return _serializeTransition<RecordingState?>(() async {
      if (_disposed || !state.isActive || _finishing) {
        return null;
      }
      _finishing = true;
      _ticker?.cancel();
      _stopwatch.stop();

      try {
        final returnedPath = await _recorder.stop();
        await _amplitudeSubscription?.cancel();
        await _recordStateSubscription?.cancel();
        if (_disposed) {
          return null;
        }

        final completedState = state.copyWith(
          status: RecordingFlowStatus.completed,
          elapsed: _stopwatch.elapsed,
          amplitude: 0,
          filePath: returnedPath ?? state.filePath,
        );
        state = completedState;

        final completedSession = await _sessionFromState(
          completedState,
          status: RecordingSessionStatus.completed,
          endedAt: DateTime.now(),
        );
        await _sessionRepository.save(completedSession);
        await _enqueueUpload(completedSession);
        ref.invalidate(recoverableRecordingSessionsProvider);
        ref.invalidate(uploadQueueProvider);

        final lectureId = completedState.lectureId;
        if (lectureId != null) {
          try {
            final currentLecture = await ref
                .read(lectureRepositoryProvider)
                .getLecture(lectureId);
            if (currentLecture != null) {
              await ref
                  .read(lecturesProvider.notifier)
                  .updateLecture(
                    currentLecture.copyWith(
                      duration: completedState.elapsed,
                      status: LectureStatus.uploadPending,
                      localAudioPath: completedState.filePath,
                      markers: completedState.markers
                          .map(
                            (marker) => LectureMarker(
                              timestamp: marker.timestamp,
                              label: '교수자 중요 표시',
                            ),
                          )
                          .toList(growable: false),
                    ),
                  );
            }
          } catch (_) {
            // The completed session is enough to reconstruct lecture metadata.
          }
        }
        return completedState;
      } catch (error) {
        if (!_disposed) {
          await _markFailed(error);
        }
        return null;
      } finally {
        _finishing = false;
      }
    });
  }

  Future<T> _serializeTransition<T>(Future<T> Function() operation) {
    final completer = Completer<T>();
    _transitionTail = _transitionTail.then((_) async {
      try {
        completer.complete(await operation());
      } on Object catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });
    return completer.future;
  }

  /// Rebuilds the persisted session from [snapshot].
  ///
  /// The upload status is read back from storage rather than reset: a snapshot
  /// is saved every few seconds, and hardcoding `pending` here would keep
  /// knocking a session that is already uploading (or uploaded) back to the
  /// start of the queue.
  Future<RecordingSession> _sessionFromState(
    RecordingState snapshot, {
    RecordingSessionStatus? status,
    DateTime? endedAt,
  }) async {
    final sessionId = snapshot.sessionId!;
    UploadStatus uploadStatus;
    try {
      final existing = await _sessionRepository.get(sessionId);
      uploadStatus = existing?.uploadStatus ?? UploadStatus.pending;
    } catch (_) {
      uploadStatus = UploadStatus.pending;
    }

    return RecordingSession(
      id: sessionId,
      lectureId: snapshot.lectureId!,
      startedAt: _startedAt!,
      endedAt: endedAt,
      localFilePath: snapshot.filePath!,
      duration: snapshot.elapsed,
      status:
          status ??
          (snapshot.status == RecordingFlowStatus.paused
              ? RecordingSessionStatus.paused
              : RecordingSessionStatus.recording),
      uploadStatus: uploadStatus,
      markers: snapshot.markers,
    );
  }

  /// Adds the finished [session] to the resumable upload queue.
  ///
  /// Failure-tolerant by design: a recording that is safely on disk must never
  /// be lost because the queue could not be written. The session stays
  /// recoverable, so a later pass can queue it again.
  Future<void> _enqueueUpload(RecordingSession session) async {
    try {
      final file = File(session.localFilePath);
      if (!await file.exists()) {
        return;
      }
      final totalBytes = await file.length();
      if (totalBytes <= 0) {
        return;
      }
      await _uploadQueueRepository.enqueue(
        UploadJob.forRecording(
          session: session,
          title: _title,
          totalBytes: totalBytes,
        ),
      );
    } catch (_) {
      // Recording completion must succeed even when queueing does not.
    }
  }

  Future<void> _markFailed(Object error) async {
    if (!_disposed) {
      state = state.copyWith(
        status: RecordingFlowStatus.failed,
        elapsed: _stopwatch.elapsed,
        amplitude: 0,
        errorMessage: '녹음을 저장하지 못했습니다. 저장공간과 마이크 상태를 확인해 주세요.',
      );
    }
    if (state.sessionId != null && _startedAt != null) {
      try {
        if (_recorderStartRequested) {
          await _sessionRepository.save(
            await _sessionFromState(
              state,
              status: RecordingSessionStatus.failed,
              endedAt: DateTime.now(),
            ),
          );
        } else {
          await _sessionRepository.remove(state.sessionId!);
        }
      } catch (_) {
        // The original recording error is more useful than a persistence error.
      }
    }
    if (!_disposed && state.lectureId != null) {
      try {
        final lecture = await ref
            .read(lectureRepositoryProvider)
            .getLecture(state.lectureId!);
        if (lecture != null) {
          await ref
              .read(lecturesProvider.notifier)
              .updateLecture(lecture.copyWith(status: LectureStatus.failed));
        }
      } catch (_) {
        // Preserve the recording error even if lecture metadata cannot update.
      }
    }
    if (!_disposed) {
      ref.invalidate(recoverableRecordingSessionsProvider);
    }
  }

  Future<void> _closeRecorderSafely(RecordingState snapshot) async {
    try {
      await _amplitudeSubscription?.cancel();
      await _recordStateSubscription?.cancel();
      if (snapshot.isActive) {
        final path = await _recorder.stop();
        if (snapshot.sessionId != null && _startedAt != null) {
          final finalized = snapshot.copyWith(
            status: RecordingFlowStatus.completed,
            elapsed: _stopwatch.elapsed,
            filePath: path ?? snapshot.filePath,
          );
          final finalizedSession = await _sessionFromState(
            finalized,
            status: RecordingSessionStatus.completed,
            endedAt: DateTime.now(),
          );
          await _sessionRepository.save(finalizedSession);
          await _enqueueUpload(finalizedSession);
          final lectureId = finalized.lectureId;
          if (lectureId != null) {
            final lecture = await _lectureRepository.getLecture(lectureId);
            if (lecture != null) {
              await _lectureRepository.saveLecture(
                lecture.copyWith(
                  duration: finalized.elapsed,
                  status: LectureStatus.uploadPending,
                  localAudioPath: finalized.filePath,
                  markers: finalized.markers
                      .map(
                        (marker) => LectureMarker(
                          timestamp: marker.timestamp,
                          label: '교수자 중요 표시',
                        ),
                      )
                      .toList(growable: false),
                ),
              );
            }
          }
        }
      }
    } catch (_) {
      // A previously persisted in-progress session remains recoverable.
    } finally {
      try {
        await _recorder.dispose();
      } catch (_) {
        // Disposing is best-effort after the session metadata is persisted.
      }
    }
  }
}
