import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../domain/lecture.dart';
import 'lecture_providers.dart';
import 'widgets/content_state.dart';
import 'widgets/lecture_card.dart';

class LectureDetailScreen extends ConsumerWidget {
  const LectureDetailScreen({
    super.key,
    required this.lectureId,
    required this.onShare,
    this.showCompletionMessage = false,
    this.onRetryProcessing,
  });

  final String lectureId;
  final VoidCallback onShare;
  final bool showCompletionMessage;
  final VoidCallback? onRetryProcessing;

  Lecture? _findLecture(List<Lecture> lectures) {
    for (final lecture in lectures) {
      if (lecture.id == lectureId) {
        return lecture;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lectures = ref.watch(lecturesProvider);

    return lectures.when(
      loading: () => const _DetailScaffold(
        body: DelayedSkeleton(child: _LectureDetailSkeleton()),
      ),
      error: (error, stackTrace) => _DetailScaffold(
        body: ContentError(onRetry: () => ref.invalidate(lecturesProvider)),
      ),
      data: (items) {
        final lecture = _findLecture(items);
        if (lecture == null) {
          return const _DetailScaffold(
            body: ContentEmpty(
              icon: Icons.find_in_page_outlined,
              title: '강의를 찾을 수 없어요',
              message: '삭제되었거나 이동된 강의일 수 있어요.',
            ),
          );
        }

        final hasResult =
            lecture.status == LectureStatus.completed && _hasResult(lecture);
        return _DetailScaffold(
          body: hasResult
              ? _LectureResultView(
                  lecture: lecture,
                  showCompletionMessage: showCompletionMessage,
                )
              : _LecturePendingView(
                  lecture: lecture,
                  onRetry: onRetryProcessing,
                ),
          bottom: hasResult ? _ShareButton(onPressed: onShare) : null,
        );
      },
    );
  }

  bool _hasResult(Lecture lecture) {
    return (lecture.summary?.trim().isNotEmpty ?? false) ||
        lecture.keyPoints.isNotEmpty ||
        lecture.chapters.isNotEmpty ||
        lecture.transcript.isNotEmpty ||
        lecture.markers.isNotEmpty;
  }
}

class _DetailScaffold extends StatelessWidget {
  const _DetailScaffold({required this.body, this.bottom});

  final Widget body;
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('강의 상세'),
        actions: [
          IconButton(
            onPressed: () {
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(
                  const SnackBar(content: Text('강의 관리 기능은 준비 중이에요.')),
                );
            },
            tooltip: '더보기',
            icon: const Icon(Icons.more_horiz_rounded),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: SafeArea(top: false, child: body),
      bottomNavigationBar: bottom,
    );
  }
}

class _LectureResultView extends StatefulWidget {
  const _LectureResultView({
    required this.lecture,
    required this.showCompletionMessage,
  });

  final Lecture lecture;
  final bool showCompletionMessage;

  @override
  State<_LectureResultView> createState() => _LectureResultViewState();
}

class _LectureResultViewState extends State<_LectureResultView> {
  late final AudioPlayer _player;
  bool _isCheckingAudio = true;
  bool _isAudioReady = false;
  bool _isTranscriptExpanded = false;
  String? _audioMessage;
  double _playbackSpeed = 1;
  int _loadGeneration = 0;

  @override
  void initState() {
    super.initState();
    _player = AudioPlayer();
    unawaited(_prepareAudio());
  }

  @override
  void didUpdateWidget(covariant _LectureResultView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.lecture.localAudioPath != widget.lecture.localAudioPath) {
      unawaited(_prepareAudio());
    }
  }

  @override
  void dispose() {
    _loadGeneration += 1;
    unawaited(_player.dispose());
    super.dispose();
  }

  Future<void> _prepareAudio() async {
    final generation = ++_loadGeneration;
    final rawPath = widget.lecture.localAudioPath?.trim();

    if (mounted) {
      setState(() {
        _isCheckingAudio = true;
        _isAudioReady = false;
        _audioMessage = null;
      });
    }

    if (rawPath == null || rawPath.isEmpty || rawPath.startsWith('mock://')) {
      _setAudioUnavailable(generation, '녹음 파일이 이 기기에 없어요.');
      return;
    }

    try {
      final uri = Uri.tryParse(rawPath);
      final file = uri != null && uri.scheme == 'file'
          ? File.fromUri(uri)
          : File(rawPath);
      if (!await file.exists()) {
        _setAudioUnavailable(generation, '로컬 녹음 파일을 찾을 수 없어요.');
        return;
      }

      await _player.setFilePath(file.path);
      await _player.setSpeed(_playbackSpeed);
      if (!mounted || generation != _loadGeneration) {
        return;
      }
      setState(() {
        _isCheckingAudio = false;
        _isAudioReady = true;
      });
    } catch (_) {
      _setAudioUnavailable(generation, '녹음 파일을 재생할 수 없어요.');
    }
  }

  void _setAudioUnavailable(int generation, String message) {
    if (!mounted || generation != _loadGeneration) {
      return;
    }
    setState(() {
      _isCheckingAudio = false;
      _isAudioReady = false;
      _audioMessage = message;
    });
  }

  void _showAudioMessage([String? message]) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text(message ?? _audioMessage ?? '녹음 파일을 준비하고 있어요.')),
      );
  }

  Future<void> _togglePlayback() async {
    if (!_isAudioReady) {
      _showAudioMessage();
      return;
    }
    try {
      if (_player.playing) {
        await _player.pause();
      } else {
        if (_player.processingState == ProcessingState.completed) {
          await _player.seek(Duration.zero);
        }
        await _player.play();
      }
    } catch (_) {
      if (mounted) {
        _showAudioMessage('녹음 파일을 재생하지 못했어요.');
      }
    }
  }

  Future<void> _setPlaybackSpeed(double speed) async {
    try {
      await _player.setSpeed(speed);
      if (mounted) {
        setState(() => _playbackSpeed = speed);
      }
    } catch (_) {
      if (mounted) {
        _showAudioMessage('재생 속도를 바꾸지 못했어요.');
      }
    }
  }

  Future<void> _seekTo(Duration timestamp) async {
    if (!_isAudioReady) {
      _showAudioMessage();
      return;
    }

    try {
      await _player.seek(timestamp);
    } catch (_) {
      if (mounted) {
        _showAudioMessage('해당 구간으로 이동하지 못했어요.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final lecture = widget.lecture;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 48),
      children: [
        if (widget.showCompletionMessage) ...[
          const _CompletionNotice(),
          const SizedBox(height: 18),
        ],
        _LectureHeading(lecture: lecture),
        const SizedBox(height: 24),
        _AudioPlayerSurface(
          player: _player,
          lectureDuration: lecture.duration,
          isChecking: _isCheckingAudio,
          isReady: _isAudioReady,
          unavailableMessage: _audioMessage,
          playbackSpeed: _playbackSpeed,
          onTogglePlayback: () => unawaited(_togglePlayback()),
          onSpeedSelected: (speed) => unawaited(_setPlaybackSpeed(speed)),
        ),
        const SizedBox(height: 40),
        _SummarySection(lecture: lecture),
        const SizedBox(height: 40),
        _KeyPointsSection(points: lecture.keyPoints),
        const SizedBox(height: 40),
        _ImportantMomentsSection(lecture: lecture, onSeek: _seekTo),
        const SizedBox(height: 40),
        _TranscriptSection(
          segments: lecture.transcript,
          expanded: _isTranscriptExpanded,
          onToggle: () =>
              setState(() => _isTranscriptExpanded = !_isTranscriptExpanded),
          onSeek: _seekTo,
        ),
      ],
    );
  }
}

class _CompletionNotice extends StatelessWidget {
  const _CompletionNotice();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: scheme.tertiaryContainer,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: scheme.tertiary.withValues(alpha: 0.18)),
      ),
      child: Row(
        children: [
          Icon(Icons.check_circle_rounded, size: 19, color: scheme.tertiary),
          const SizedBox(width: 9),
          Text(
            '강의 정리가 끝났어요',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: scheme.onTertiaryContainer,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _LectureHeading extends StatelessWidget {
  const _LectureHeading({required this.lecture});

  final Lecture lecture;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          lecture.title,
          style: theme.textTheme.headlineMedium?.copyWith(
            height: 1.25,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.8,
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 7,
          runSpacing: 7,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              formatLectureDate(lecture.createdAt),
              style: theme.textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            Text('·', style: TextStyle(color: colorScheme.outline)),
            Text(
              formatLectureDuration(lecture.duration),
              style: theme.textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            LectureStatusBadge(status: lecture.status),
          ],
        ),
      ],
    );
  }
}

class _AudioPlayerSurface extends StatelessWidget {
  const _AudioPlayerSurface({
    required this.player,
    required this.lectureDuration,
    required this.isChecking,
    required this.isReady,
    required this.playbackSpeed,
    required this.onTogglePlayback,
    required this.onSpeedSelected,
    this.unavailableMessage,
  });

  final AudioPlayer player;
  final Duration lectureDuration;
  final bool isChecking;
  final bool isReady;
  final double playbackSpeed;
  final VoidCallback onTogglePlayback;
  final ValueChanged<double> onSpeedSelected;
  final String? unavailableMessage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: isChecking
          ? const _AudioCheckingState()
          : StreamBuilder<Duration?>(
              stream: player.durationStream,
              initialData: player.duration,
              builder: (context, durationSnapshot) {
                final audioDuration = durationSnapshot.data;
                final duration =
                    audioDuration != null && audioDuration > Duration.zero
                    ? audioDuration
                    : lectureDuration;

                return StreamBuilder<Duration>(
                  stream: player.positionStream,
                  initialData: player.position,
                  builder: (context, positionSnapshot) {
                    final maxMilliseconds = duration.inMilliseconds > 0
                        ? duration.inMilliseconds
                        : 1;
                    final positionMilliseconds =
                        (positionSnapshot.data ?? Duration.zero).inMilliseconds
                            .clamp(0, maxMilliseconds);

                    return Column(
                      children: [
                        Row(
                          children: [
                            StreamBuilder<PlayerState>(
                              stream: player.playerStateStream,
                              initialData: player.playerState,
                              builder: (context, stateSnapshot) {
                                final playing =
                                    stateSnapshot.data?.playing ?? false;
                                return IconButton.filled(
                                  onPressed: onTogglePlayback,
                                  tooltip: playing ? '일시정지' : '재생',
                                  style: IconButton.styleFrom(
                                    backgroundColor: colorScheme.primary,
                                    foregroundColor: colorScheme.onPrimary,
                                  ),
                                  icon: Icon(
                                    playing
                                        ? Icons.pause_rounded
                                        : Icons.play_arrow_rounded,
                                  ),
                                );
                              },
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Slider(
                                value: positionMilliseconds.toDouble(),
                                max: maxMilliseconds.toDouble(),
                                onChanged: isReady
                                    ? (value) => unawaited(
                                        player.seek(
                                          Duration(milliseconds: value.round()),
                                        ),
                                      )
                                    : null,
                              ),
                            ),
                          ],
                        ),
                        Padding(
                          padding: const EdgeInsets.only(left: 56),
                          child: Row(
                            children: [
                              Text(
                                formatLectureDuration(
                                  Duration(milliseconds: positionMilliseconds),
                                ),
                                style: theme.textTheme.labelSmall?.copyWith(
                                  color: colorScheme.onSurfaceVariant,
                                ),
                              ),
                              const Spacer(),
                              Text(
                                formatLectureDuration(duration),
                                style: theme.textTheme.labelSmall?.copyWith(
                                  color: colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                isReady
                                    ? '녹음 재생'
                                    : unavailableMessage ?? '녹음 파일을 사용할 수 없어요.',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            PopupMenuButton<double>(
                              tooltip: '재생 속도',
                              initialValue: playbackSpeed,
                              onSelected: onSpeedSelected,
                              itemBuilder: (context) => const [
                                PopupMenuItem(value: 0.8, child: Text('0.8x')),
                                PopupMenuItem(value: 1.0, child: Text('1.0x')),
                                PopupMenuItem(value: 1.2, child: Text('1.2x')),
                                PopupMenuItem(value: 1.5, child: Text('1.5x')),
                                PopupMenuItem(value: 2.0, child: Text('2.0x')),
                              ],
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 11,
                                  vertical: 7,
                                ),
                                decoration: BoxDecoration(
                                  color: colorScheme.surfaceContainerHighest,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  '${playbackSpeed.toStringAsFixed(1)}x',
                                  style: theme.textTheme.labelMedium?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    );
                  },
                );
              },
            ),
    );
  }
}

class _AudioCheckingState extends StatelessWidget {
  const _AudioCheckingState();

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return SizedBox(
      height: 92,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('녹음 파일을 확인하고 있어요'),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              minHeight: 4,
              backgroundColor: colorScheme.surfaceContainerHighest,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummarySection extends StatelessWidget {
  const _SummarySection({required this.lecture});

  final Lecture lecture;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final summary = lecture.summary?.trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionHeading(title: 'AI 강의 요약'),
        const SizedBox(height: 14),
        Text(
          summary == null || summary.isEmpty ? 'AI 요약을 준비하고 있어요.' : summary,
          style: theme.textTheme.bodyLarge?.copyWith(height: 1.7),
        ),
      ],
    );
  }
}

class _KeyPointsSection extends StatelessWidget {
  const _KeyPointsSection({required this.points});

  final List<String> points;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionHeading(title: '핵심 내용'),
        const SizedBox(height: 10),
        if (points.isEmpty)
          Text(
            '핵심 내용을 정리하고 있어요.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          )
        else
          ...points.indexed.map(
            (entry) => Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: entry.$1 == points.length - 1
                  ? null
                  : BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: colorScheme.outlineVariant),
                      ),
                    ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 38,
                    child: Text(
                      '${entry.$1 + 1}'.padLeft(2, '0'),
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      entry.$2,
                      style: theme.textTheme.bodyLarge?.copyWith(height: 1.5),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _ImportantMomentsSection extends StatelessWidget {
  const _ImportantMomentsSection({required this.lecture, required this.onSeek});

  final Lecture lecture;
  final ValueChanged<Duration> onSeek;

  List<LectureChapter> get _aiChapters {
    return lecture.chapters
        .where((chapter) {
          return !lecture.markers.any(
            (marker) =>
                marker.timestamp == chapter.timestamp &&
                (chapter.title == marker.label || chapter.title == '교수자 중요 표시'),
          );
        })
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final aiChapters = _aiChapters;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionHeading(title: '중요 구간'),
        const SizedBox(height: 6),
        Text(
          '직접 표시한 구간과 AI가 찾은 흐름을 구분해서 보여드려요.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: colorScheme.onSurfaceVariant,
          ),
        ),
        if (lecture.markers.isNotEmpty) ...[
          const SizedBox(height: 16),
          ...lecture.markers.map(
            (marker) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _MarkerMomentRow(marker: marker, onSeek: onSeek),
            ),
          ),
        ],
        if (aiChapters.isNotEmpty) ...[
          SizedBox(height: lecture.markers.isEmpty ? 18 : 24),
          Text(
            'AI가 찾은 구간',
            style: theme.textTheme.labelLarge?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 6),
          ...aiChapters.map(
            (chapter) => _SimpleMomentRow(
              timestamp: chapter.timestamp,
              title: chapter.title,
              onTap: () => onSeek(chapter.timestamp),
            ),
          ),
        ],
        if (lecture.markers.isEmpty && aiChapters.isEmpty) ...[
          const SizedBox(height: 16),
          Text(
            '아직 저장된 중요 구간이 없어요.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }
}

class _MarkerMomentRow extends StatelessWidget {
  const _MarkerMomentRow({required this.marker, required this.onSeek});

  final LectureMarker marker;
  final ValueChanged<Duration> onSeek;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return Material(
      color: colorScheme.primaryContainer.withValues(alpha: 0.55),
      borderRadius: BorderRadius.circular(14),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => onSeek(marker.timestamp),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 13, 12, 13),
          child: Row(
            children: [
              Container(
                width: 4,
                height: 38,
                decoration: BoxDecoration(
                  color: colorScheme.primary,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '교수자 직접 표시',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      marker.label,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                formatLectureDuration(marker.timestamp),
                style: theme.textTheme.labelMedium?.copyWith(
                  color: colorScheme.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 4),
              Icon(
                Icons.play_arrow_rounded,
                size: 19,
                color: colorScheme.primary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SimpleMomentRow extends StatelessWidget {
  const _SimpleMomentRow({
    required this.timestamp,
    required this.title,
    required this.onTap,
  });

  final Duration timestamp;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 13),
          child: Row(
            children: [
              SizedBox(
                width: 54,
                child: Text(
                  formatLectureDuration(timestamp),
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  title,
                  style: theme.textTheme.bodyMedium?.copyWith(height: 1.45),
                ),
              ),
              Icon(
                Icons.play_arrow_rounded,
                size: 19,
                color: colorScheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TranscriptSection extends StatelessWidget {
  const _TranscriptSection({
    required this.segments,
    required this.expanded,
    required this.onToggle,
    required this.onSeek,
  });

  final List<TranscriptSegment> segments;
  final bool expanded;
  final VoidCallback onToggle;
  final ValueChanged<Duration> onSeek;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(child: _SectionHeading(title: '스크립트')),
            if (segments.isNotEmpty)
              TextButton(
                onPressed: onToggle,
                child: Text(expanded ? '접기' : '스크립트 보기'),
              ),
          ],
        ),
        if (segments.isEmpty) ...[
          const SizedBox(height: 12),
          Text(
            '음성 인식이 끝나면 시간순으로 보여드려요.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ] else if (!expanded) ...[
          const SizedBox(height: 6),
          Text(
            '${segments.length}개의 구간이 준비되어 있어요.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ] else ...[
          const SizedBox(height: 8),
          ...segments.map(
            (segment) => _TranscriptRow(segment: segment, onSeek: onSeek),
          ),
        ],
      ],
    );
  }
}

class _TranscriptRow extends StatelessWidget {
  const _TranscriptRow({required this.segment, required this.onSeek});

  final TranscriptSegment segment;
  final ValueChanged<Duration> onSeek;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 11),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 58,
            child: InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: () => onSeek(segment.timestamp),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Text(
                  formatLectureDuration(segment.timestamp),
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              segment.text,
              style: theme.textTheme.bodyMedium?.copyWith(height: 1.6),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: Theme.of(context).textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: -0.45,
      ),
    );
  }
}

class _LecturePendingView extends StatelessWidget {
  const _LecturePendingView({required this.lecture, this.onRetry});

  final Lecture lecture;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isFailed = lecture.status == LectureStatus.failed;
    final (title, message) = switch (lecture.status) {
      LectureStatus.recording => ('강의를 기록하고 있어요', '녹음을 마치면 파일을 안전하게 저장할게요.'),
      LectureStatus.uploadPending => (
        '업로드를 기다리고 있어요',
        '녹음 파일은 기기에 안전하게 보관되어 있어요.',
      ),
      LectureStatus.uploading => (
        '강의를 업로드하고 있어요',
        '네트워크가 끊겨도 로컬 파일은 삭제되지 않아요.',
      ),
      LectureStatus.processing => (
        '강의를 정리하고 있어요',
        '음성 인식과 핵심 내용 정리를 차례로 진행하고 있어요.',
      ),
      LectureStatus.completed => ('강의 결과를 준비하고 있어요', '분석 결과를 불러오는 중이에요.'),
      LectureStatus.failed => ('강의를 업로드하지 못했어요', '녹음 파일은 기기에 안전하게 저장되어 있어요.'),
    };

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
      children: [
        _LectureHeading(lecture: lecture),
        const SizedBox(height: 40),
        Text(
          title,
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 9),
        Text(
          message,
          style: theme.textTheme.bodyLarge?.copyWith(
            color: colorScheme.onSurfaceVariant,
            height: 1.55,
          ),
        ),
        if (!isFailed) ...[
          const SizedBox(height: 26),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: const LinearProgressIndicator(minHeight: 5),
          ),
        ] else if (onRetry != null) ...[
          const SizedBox(height: 24),
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton(
              onPressed: onRetry,
              child: const Text('다시 업로드'),
            ),
          ),
        ],
      ],
    );
  }
}

class _LectureDetailSkeleton extends StatelessWidget {
  const _LectureDetailSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: const [
        _SkeletonBlock(widthFactor: 0.72, height: 30),
        SizedBox(height: 12),
        _SkeletonBlock(widthFactor: 0.45, height: 14),
        SizedBox(height: 24),
        _SkeletonBlock(height: 126, radius: 18),
        SizedBox(height: 40),
        _SkeletonBlock(widthFactor: 0.4, height: 22),
        SizedBox(height: 16),
        _SkeletonBlock(height: 17),
        SizedBox(height: 9),
        _SkeletonBlock(widthFactor: 0.88, height: 17),
        SizedBox(height: 9),
        _SkeletonBlock(widthFactor: 0.62, height: 17),
        SizedBox(height: 40),
        _SkeletonBlock(widthFactor: 0.34, height: 22),
        SizedBox(height: 18),
        _SkeletonBlock(height: 54),
        SizedBox(height: 8),
        _SkeletonBlock(height: 54),
      ],
    );
  }
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({
    this.widthFactor = 1,
    required this.height,
    this.radius = 8,
  });

  final double widthFactor;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      widthFactor: widthFactor,
      alignment: Alignment.centerLeft,
      child: Container(
        height: height,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }
}

class _ShareButton extends StatelessWidget {
  const _ShareButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        border: Border(top: BorderSide(color: colorScheme.outlineVariant)),
      ),
      child: SafeArea(
        minimum: const EdgeInsets.fromLTRB(20, 12, 20, 12),
        child: FilledButton(
          onPressed: onPressed,
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(54),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(15),
            ),
          ),
          child: const Text('강의 공유하기'),
        ),
      ),
    );
  }
}
