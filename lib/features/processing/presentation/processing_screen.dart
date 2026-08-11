import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../lectures/domain/lecture.dart';
import '../../lectures/presentation/lecture_providers.dart';
import '../../recording/data/recording_file_validator.dart';
import '../../recording/domain/recording_session.dart';
import '../../recording/presentation/recording_session_providers.dart';

class ProcessingScreen extends ConsumerStatefulWidget {
  const ProcessingScreen({required this.lectureId, super.key});

  final String lectureId;

  @override
  ConsumerState<ProcessingScreen> createState() => _ProcessingScreenState();
}

class _ProcessingScreenState extends ConsumerState<ProcessingScreen>
    with WidgetsBindingObserver {
  static const _stages = [
    '녹음 저장 완료',
    '음성 파일 업로드',
    '음성 인식',
    '핵심 내용 정리',
    '강의 노트 만들기',
  ];

  Timer? _timer;
  int _stageIndex = 0;
  bool _working = false;
  bool _completed = false;
  bool _isPrepared = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        !_completed &&
        _isPrepared &&
        _errorMessage == null) {
      _scheduleNextStage();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached) {
      _timer?.cancel();
    }
  }

  Future<void> _start() async {
    if (!mounted) {
      return;
    }
    _timer?.cancel();
    setState(() {
      _stageIndex = 0;
      _completed = false;
      _isPrepared = false;
      _errorMessage = null;
    });
    try {
      final lecture = await _findOrRestoreLecture();
      final recoveredLecture = await _prepareLocalRecording(lecture);
      if (!mounted) {
        return;
      }
      await ref
          .read(lecturesProvider.notifier)
          .updateLecture(
            recoveredLecture.copyWith(status: LectureStatus.processing),
          );
      if (mounted) {
        setState(() {
          _isPrepared = true;
          _stageIndex = 1;
        });
        _scheduleNextStage();
      }
    } on _ProcessingPreparationException catch (error) {
      if (mounted) {
        setState(() => _errorMessage = error.message);
      }
    } catch (_) {
      if (mounted) {
        setState(() => _errorMessage = '처리할 강의 정보를 불러오지 못했어요.');
      }
    }
  }

  Future<Lecture> _findOrRestoreLecture() async {
    final lectureRepository = ref.read(lectureRepositoryProvider);
    final lecture = await lectureRepository.getLecture(widget.lectureId);
    if (lecture != null) {
      return lecture;
    }
    if (!mounted) {
      throw const _ProcessingPreparationException('강의 복구가 중단됐어요.');
    }

    final sessionRepository = ref.read(recordingSessionRepositoryProvider);
    final sessions = await sessionRepository.getAll();
    RecordingSession? session;
    for (final candidate in sessions) {
      if (candidate.lectureId == widget.lectureId) {
        session = candidate;
        break;
      }
    }
    if (session == null) {
      throw const _ProcessingPreparationException('강의 정보를 찾을 수 없어요.');
    }

    await _validateLocalRecording(session.localFilePath);
    final restored = Lecture(
      id: session.lectureId,
      title: '복구된 강의',
      createdAt: session.startedAt,
      duration: session.duration,
      status: LectureStatus.uploadPending,
      recordingType: RecordingType.audio,
      localAudioPath: session.localFilePath,
      markers: session.markers
          .map(
            (marker) =>
                LectureMarker(timestamp: marker.timestamp, label: '교수자 중요 표시'),
          )
          .toList(growable: false),
    );
    await lectureRepository.createLecture(restored);
    if (!mounted) {
      return restored;
    }
    await ref.read(lecturesProvider.notifier).reload();
    return restored;
  }

  Future<Lecture> _prepareLocalRecording(Lecture lecture) async {
    if (!mounted) {
      throw const _ProcessingPreparationException('강의 복구가 중단됐어요.');
    }
    final repository = ref.read(recordingSessionRepositoryProvider);
    final sessions = await repository.getAll();
    RecordingSession? localSession;
    for (final session in sessions) {
      if (session.lectureId == lecture.id) {
        localSession = session;
        break;
      }
    }

    if (localSession == null) {
      return lecture;
    }
    await _validateLocalRecording(localSession.localFilePath);

    await repository.save(
      localSession.copyWith(
        endedAt: localSession.endedAt ?? DateTime.now(),
        status: RecordingSessionStatus.completed,
        uploadStatus: UploadStatus.uploading,
      ),
    );
    if (mounted) {
      ref.invalidate(recoverableRecordingSessionsProvider);
    }

    return lecture.copyWith(
      duration: localSession.duration,
      localAudioPath: localSession.localFilePath,
      markers: localSession.markers
          .map(
            (marker) =>
                LectureMarker(timestamp: marker.timestamp, label: '교수자 중요 표시'),
          )
          .toList(growable: false),
    );
  }

  Future<void> _validateLocalRecording(String path) async {
    try {
      await validateM4aRecording(path);
    } on RecordingFileValidationException catch (error) {
      final message = switch (error.issue) {
        RecordingFileIssue.missing =>
          '로컬 녹음 파일을 찾을 수 없어요. 파일을 삭제하지 말고 복구 기능을 기다려 주세요.',
        RecordingFileIssue.tooSmall => '녹음 파일이 완전히 저장되지 않았어요. 원본은 그대로 보관 중입니다.',
        RecordingFileIssue.incompleteContainer =>
          '녹음 파일 마무리가 확인되지 않았어요. 손상 방지를 위해 원본을 그대로 보관합니다.',
      };
      throw _ProcessingPreparationException(message);
    }
  }

  void _scheduleNextStage() {
    if (_timer?.isActive == true ||
        _completed ||
        !_isPrepared ||
        _errorMessage != null ||
        !mounted) {
      return;
    }
    _timer = Timer(const Duration(seconds: 2), () => unawaited(_advance()));
  }

  Future<void> _advance() async {
    if (_working ||
        !mounted ||
        _completed ||
        !_isPrepared ||
        _errorMessage != null) {
      return;
    }
    _working = true;
    try {
      if (_stageIndex < _stages.length - 1) {
        setState(() => _stageIndex += 1);
        _scheduleNextStage();
      } else {
        await _completeLecture();
        if (mounted) {
          setState(() => _completed = true);
          unawaited(HapticFeedback.selectionClick());
          context.goNamed(
            'lecture-detail',
            pathParameters: {'lectureId': widget.lectureId},
            extra: true,
          );
        }
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isPrepared = false;
          _errorMessage = 'AI 강의 노트를 만들지 못했어요. 녹음 파일은 기기에 안전하게 저장되어 있어요.';
        });
      }
    } finally {
      _working = false;
    }
  }

  Future<void> _completeLecture() async {
    final lecture = await ref
        .read(lectureRepositoryProvider)
        .getLecture(widget.lectureId);
    if (!mounted) {
      return;
    }
    if (lecture == null) {
      throw StateError('Lecture not found');
    }

    final duration = lecture.duration;
    Duration atRatio(double ratio) {
      if (duration == Duration.zero) {
        return Duration.zero;
      }
      return Duration(milliseconds: (duration.inMilliseconds * ratio).round());
    }

    final generatedChapters = <LectureChapter>[
      LectureChapter(timestamp: Duration.zero, title: '강의 도입과 오늘의 목표'),
      LectureChapter(timestamp: atRatio(0.35), title: '핵심 개념 설명'),
      LectureChapter(timestamp: atRatio(0.72), title: '사례와 정리'),
      ...lecture.markers.map(
        (marker) =>
            LectureChapter(timestamp: marker.timestamp, title: '교수자 중요 표시'),
      ),
    ]..sort((a, b) => a.timestamp.compareTo(b.timestamp));

    final completed = lecture.copyWith(
      status: LectureStatus.completed,
      summary: '이 강의는 핵심 개념을 차근차근 소개하고, 주요 사례를 통해 이해를 돕는 흐름으로 진행되었습니다.',
      keyPoints: const [
        '강의의 핵심 개념과 학습 목표',
        '개념을 이해하기 위한 대표 사례',
        '수업 내용을 다시 확인할 중요 구간',
      ],
      chapters: generatedChapters,
      transcript: [
        const TranscriptSegment(
          timestamp: Duration.zero,
          text: '오늘 수업에서 다룰 핵심 내용을 먼저 살펴보겠습니다.',
        ),
        TranscriptSegment(
          timestamp: atRatio(0.35),
          text: '이제 중요한 개념을 사례와 함께 자세히 설명하겠습니다.',
        ),
        TranscriptSegment(
          timestamp: atRatio(0.72),
          text: '마지막으로 오늘 배운 내용을 정리해 보겠습니다.',
        ),
      ],
    );
    await ref.read(lecturesProvider.notifier).updateLecture(completed);
    if (!mounted) {
      return;
    }
    await _markMockUploadCompleted();
  }

  Future<void> _markMockUploadCompleted() async {
    final repository = ref.read(recordingSessionRepositoryProvider);
    final sessions = await repository.getAll();
    for (final session in sessions.where(
      (item) => item.lectureId == widget.lectureId,
    )) {
      await repository.save(
        session.copyWith(
          status: RecordingSessionStatus.completed,
          uploadStatus: UploadStatus.completed,
          endedAt: session.endedAt ?? DateTime.now(),
        ),
      );
    }
    if (mounted) {
      ref.invalidate(recoverableRecordingSessionsProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () => context.goNamed('home'),
          icon: const Icon(Icons.close_rounded),
          tooltip: '홈으로',
        ),
        title: const Text('강의 정리'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 18, 24, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '강의를 정리하고 있어요',
                style: theme.textTheme.headlineMedium?.copyWith(height: 1.25),
              ),
              const SizedBox(height: 10),
              Text(
                '앱을 잠시 닫아도 녹음 파일은 기기에 안전하게 남아 있어요.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  height: 1.55,
                ),
              ),
              const SizedBox(height: 40),
              if (_errorMessage != null)
                _ProcessingError(message: _errorMessage!, onRetry: _start)
              else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Column(
                    children: List.generate(
                      _stages.length,
                      (index) => _StageRow(
                        label: _stages[index],
                        state: index < _stageIndex || _completed
                            ? _StageState.done
                            : index == _stageIndex
                            ? _StageState.active
                            : _StageState.waiting,
                        isLast: index == _stages.length - 1,
                      ),
                    ),
                  ),
                ),
              const Spacer(),
              TextButton(
                onPressed: () => context.goNamed('home'),
                child: const Text('나중에 계속하기'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum _StageState { waiting, active, done }

class _StageRow extends StatelessWidget {
  const _StageRow({
    required this.label,
    required this.state,
    required this.isLast,
  });

  final String label;
  final _StageState state;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final activeColor = state == _StageState.waiting
        ? scheme.outlineVariant
        : state == _StageState.done
        ? scheme.tertiary
        : scheme.primary;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 28,
            child: Column(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  width: 24,
                  height: 24,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: state == _StageState.done
                        ? scheme.tertiaryContainer
                        : state == _StageState.active
                        ? scheme.primaryContainer
                        : scheme.surfaceContainerHighest,
                    shape: BoxShape.circle,
                    border: Border.all(color: activeColor),
                  ),
                  child: state == _StageState.done
                      ? Icon(Icons.check_rounded, size: 15, color: activeColor)
                      : state == _StageState.active
                      ? SizedBox(
                          width: 11,
                          height: 11,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: activeColor,
                          ),
                        )
                      : null,
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 1,
                      margin: const EdgeInsets.symmetric(vertical: 3),
                      color: state == _StageState.done
                          ? scheme.tertiary.withValues(alpha: 0.35)
                          : scheme.outlineVariant,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 22, top: 2),
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontWeight: state == _StageState.active
                      ? FontWeight.w700
                      : FontWeight.w500,
                  color: state == _StageState.waiting
                      ? scheme.onSurfaceVariant
                      : scheme.onSurface,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProcessingError extends StatelessWidget {
  const _ProcessingError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: scheme.errorContainer,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Icon(Icons.error_outline_rounded, color: scheme.onErrorContainer),
          const SizedBox(height: 10),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onRetry, child: const Text('다시 시도')),
        ],
      ),
    );
  }
}

class _ProcessingPreparationException implements Exception {
  const _ProcessingPreparationException(this.message);

  final String message;
}
