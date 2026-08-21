import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/utils/duration_format.dart';
import '../domain/recording_session.dart';
import 'recording_controller.dart';
import 'recording_state.dart';

class RecordingScreen extends ConsumerStatefulWidget {
  const RecordingScreen({required this.title, super.key});

  final String title;

  @override
  ConsumerState<RecordingScreen> createState() => _RecordingScreenState();
}

class _RecordingScreenState extends ConsumerState<RecordingScreen>
    with WidgetsBindingObserver {
  bool _showingLeaveMessage = false;
  bool _didConfirmRecordingStart = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(recordingControllerProvider(widget.title).notifier).start();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached ||
        state == AppLifecycleState.hidden) {
      unawaited(
        ref
            .read(recordingControllerProvider(widget.title).notifier)
            .persistSnapshot(),
      );
    }
  }

  Future<void> _requestLeave() async {
    final recording = ref.read(recordingControllerProvider(widget.title));
    final isProtected =
        recording.isActive || recording.status == RecordingFlowStatus.preparing;
    if (!isProtected) {
      if (mounted) {
        context.pop();
      }
      return;
    }
    if (_showingLeaveMessage || !mounted) {
      return;
    }
    _showingLeaveMessage = true;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: const Icon(Icons.shield_outlined),
        title: const Text('녹음을 안전하게 보관하고 있어요'),
        content: Text(
          recording.status == RecordingFlowStatus.preparing
              ? '마이크 연결이 끝날 때까지 잠시만 기다려 주세요.'
              : '이 화면을 나가려면 먼저 녹음을 종료해 주세요.',
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('계속 녹음'),
          ),
        ],
      ),
    );
    _showingLeaveMessage = false;
  }

  Future<void> _confirmFinish() async {
    final shouldFinish = await showModalBottomSheet<bool>(
      context: context,
      useSafeArea: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: Theme.of(sheetContext).colorScheme.outlineVariant,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              '녹음을 종료할까요?',
              style: Theme.of(sheetContext).textTheme.headlineSmall,
            ),
            const SizedBox(height: 10),
            const Text('현재까지 기록한 내용은 기기에 안전하게 저장돼요.'),
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: () => Navigator.of(sheetContext).pop(false),
              child: const Text('계속 녹음'),
            ),
            const SizedBox(height: 10),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Theme.of(sheetContext).colorScheme.error,
                foregroundColor: Theme.of(sheetContext).colorScheme.onError,
              ),
              onPressed: () => Navigator.of(sheetContext).pop(true),
              child: const Text('녹음 종료'),
            ),
          ],
        ),
      ),
    );

    if (shouldFinish != true || !mounted) {
      return;
    }
    unawaited(HapticFeedback.mediumImpact());
    final result = await ref
        .read(recordingControllerProvider(widget.title).notifier)
        .finish();
    if (!mounted || result == null) {
      return;
    }
    context.goNamed('recording-complete', extra: result);
  }

  Future<void> _addMarker() async {
    final before = ref
        .read(recordingControllerProvider(widget.title))
        .markers
        .length;
    final controller = ref.read(
      recordingControllerProvider(widget.title).notifier,
    );
    await controller.addMarker();
    if (!mounted) {
      return;
    }
    final current = ref.read(recordingControllerProvider(widget.title));
    if (current.markers.length <= before) {
      return;
    }
    unawaited(HapticFeedback.selectionClick());
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            '${formatDuration(current.elapsed, alwaysShowHours: false)}에 중요 표시했어요.',
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final recording = ref.watch(recordingControllerProvider(widget.title));
    ref.listen(recordingControllerProvider(widget.title), (previous, next) {
      if (!_didConfirmRecordingStart &&
          next.status == RecordingFlowStatus.recording &&
          previous?.status != RecordingFlowStatus.paused) {
        _didConfirmRecordingStart = true;
        unawaited(HapticFeedback.lightImpact());
      }
    });
    final canPop =
        !recording.isActive &&
        recording.status != RecordingFlowStatus.preparing;

    return PopScope(
      canPop: canPop,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          unawaited(_requestLeave());
        }
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            onPressed: _requestLeave,
            tooltip: '녹음 화면 닫기',
            icon: const Icon(Icons.close_rounded),
          ),
          title: Text(
            widget.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          centerTitle: true,
        ),
        body: SafeArea(
          child: switch (recording.status) {
            RecordingFlowStatus.idle ||
            RecordingFlowStatus.preparing => const _PreparingView(),
            RecordingFlowStatus.permissionDenied => _PermissionDeniedView(
              permanentlyDenied: recording.permissionPermanentlyDenied,
              onRetry: () => ref
                  .read(recordingControllerProvider(widget.title).notifier)
                  .start(),
              onOpenSettings: openAppSettings,
            ),
            RecordingFlowStatus.failed => _FailureView(
              message: recording.errorMessage,
              onBack: _requestLeave,
            ),
            _ => _ActiveRecordingView(
              recording: recording,
              onPauseToggle: recording.status == RecordingFlowStatus.paused
                  ? () => ref
                        .read(
                          recordingControllerProvider(widget.title).notifier,
                        )
                        .resume()
                  : () => ref
                        .read(
                          recordingControllerProvider(widget.title).notifier,
                        )
                        .pause(),
              onMarker: _addMarker,
              onFinish: _confirmFinish,
            ),
          },
        ),
      ),
    );
  }
}

class _PreparingView extends StatelessWidget {
  const _PreparingView();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: 20),
          Text('마이크와 저장공간을 준비하고 있어요'),
        ],
      ),
    );
  }
}

class _PermissionDeniedView extends StatelessWidget {
  const _PermissionDeniedView({
    required this.permanentlyDenied,
    required this.onRetry,
    required this.onOpenSettings,
  });

  final bool permanentlyDenied;
  final VoidCallback onRetry;
  final Future<bool> Function() onOpenSettings;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.errorContainer,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.mic_off_rounded,
                color: Theme.of(context).colorScheme.onErrorContainer,
                size: 34,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              '마이크 권한이 필요합니다',
              style: Theme.of(context).textTheme.headlineSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            Text(
              '강의를 녹음하려면 PREMIND가 마이크를 사용할 수 있도록 허용해 주세요.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: permanentlyDenied
                    ? () => unawaited(onOpenSettings())
                    : onRetry,
                child: Text(permanentlyDenied ? '설정으로 이동' : '권한 다시 요청'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FailureView extends StatelessWidget {
  const _FailureView({required this.message, required this.onBack});

  final String? message;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline_rounded,
              size: 56,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 20),
            Text(
              '녹음을 계속하지 못했어요',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(message ?? '잠시 후 다시 시도해 주세요.', textAlign: TextAlign.center),
            const SizedBox(height: 6),
            Text(
              '만들어진 녹음 파일은 삭제하지 않고 기기에 보관해요.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton(onPressed: onBack, child: const Text('홈으로 돌아가기')),
          ],
        ),
      ),
    );
  }
}

class _ActiveRecordingView extends StatelessWidget {
  const _ActiveRecordingView({
    required this.recording,
    required this.onPauseToggle,
    required this.onMarker,
    required this.onFinish,
  });

  final RecordingState recording;
  final VoidCallback onPauseToggle;
  final VoidCallback onMarker;
  final VoidCallback onFinish;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isPaused = recording.status == RecordingFlowStatus.paused;

    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: math.max(0, constraints.maxHeight - 28),
          ),
          child: IntrinsicHeight(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // One centre of gravity: status, time, signal and marks read
                // as a single live block, with the controls pinned below it.
                const Spacer(),
                _RecordingStatusLine(isPaused: isPaused),
                const SizedBox(height: 18),
                Text(
                  formatDuration(recording.elapsed),
                  textAlign: TextAlign.center,
                  style: theme.textTheme.displaySmall?.copyWith(
                    fontSize: 48,
                    fontFeatures: const [FontFeature.tabularFigures()],
                    fontWeight: FontWeight.w700,
                    letterSpacing: -1.8,
                    color: isPaused
                        ? scheme.onSurfaceVariant
                        : scheme.onSurface,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  isPaused ? '잠시 멈춰 있어요' : '기기에 저장되고 있어요',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 28),
                SizedBox(
                  height: 96,
                  width: double.infinity,
                  child: CustomPaint(
                    painter: _WaveformPainter(
                      amplitude: isPaused ? 0.04 : recording.amplitude,
                      color: scheme.primary,
                      pausedColor: scheme.outlineVariant,
                      paused: isPaused,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                // Where the 중요 표시 landed, not just how many: the marks are
                // what the AI weights later, so the lecturer should be able to
                // see the shape of what they have captured.
                _MarkerTimeline(
                  elapsed: recording.elapsed,
                  markers: recording.markers,
                  paused: isPaused,
                ),
                if (recording.errorMessage?.isNotEmpty == true) ...[
                  const SizedBox(height: 14),
                  Text(
                    recording.errorMessage!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: scheme.error,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
                const Spacer(),
                const SizedBox(height: 8),
                // While recording, 중요 표시 leads: it is pressed many times
                // per lecture and it is what the AI weights later. While
                // paused, the action the lecturer actually needs is 계속하기,
                // so the two swap places rather than sitting in a fixed row.
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: isPaused
                            ? _RecordingAction(
                                icon: recording.markers.isEmpty
                                    ? Icons.star_border_rounded
                                    : Icons.star_rounded,
                                label: '중요 표시',
                                onPressed: onMarker,
                                size: 60,
                              )
                            : _RecordingAction(
                                icon: Icons.pause_rounded,
                                label: '일시정지',
                                onPressed: onPauseToggle,
                                size: 60,
                              ),
                      ),
                    ),
                    isPaused
                        ? _RecordingAction(
                            icon: Icons.mic_rounded,
                            label: '계속하기',
                            onPressed: onPauseToggle,
                            primary: true,
                            size: 84,
                          )
                        : _RecordingAction(
                            icon: recording.markers.isEmpty
                                ? Icons.star_border_rounded
                                : Icons.star_rounded,
                            label: '중요 표시',
                            onPressed: onMarker,
                            primary: true,
                            size: 84,
                          ),
                    Expanded(
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: _RecordingAction(
                          icon: Icons.stop_rounded,
                          label: '종료',
                          destructive: true,
                          onPressed: onFinish,
                          size: 60,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The single live-state line: a pulseless dot plus what is happening.
class _RecordingStatusLine extends StatelessWidget {
  const _RecordingStatusLine({required this.isPaused});

  final bool isPaused;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: isPaused ? scheme.outline : scheme.error,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          isPaused ? '일시정지' : '녹음 중',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: isPaused ? scheme.onSurfaceVariant : scheme.onSurface,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

/// A time track with a tick for every 중요 표시 placed so far.
class _MarkerTimeline extends StatelessWidget {
  const _MarkerTimeline({
    required this.elapsed,
    required this.markers,
    required this.paused,
  });

  final Duration elapsed;
  final List<RecordingMarker> markers;
  final bool paused;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final hasMarkers = markers.isNotEmpty;

    return Semantics(
      label: hasMarkers ? '중요 표시 ${markers.length}개' : '아직 중요 표시가 없어요',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 26,
            child: CustomPaint(
              painter: _MarkerTrackPainter(
                elapsed: elapsed,
                markers: markers,
                trackColor: scheme.outlineVariant,
                markerColor: paused ? scheme.outline : scheme.primary,
              ),
            ),
          ),
          const SizedBox(height: 10),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: Text(
              hasMarkers
                  ? '중요 표시 ${markers.length}개 · 마지막 ${formatDuration(markers.last.timestamp)}'
                  : '기억할 순간은 중요 표시로 남겨보세요',
              key: ValueKey<int>(markers.length),
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: hasMarkers ? scheme.primary : scheme.onSurfaceVariant,
                fontWeight: hasMarkers ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MarkerTrackPainter extends CustomPainter {
  const _MarkerTrackPainter({
    required this.elapsed,
    required this.markers,
    required this.trackColor,
    required this.markerColor,
  });

  final Duration elapsed;
  final List<RecordingMarker> markers;
  final Color trackColor;
  final Color markerColor;

  @override
  void paint(Canvas canvas, Size size) {
    final centreY = size.height / 2;
    final track = Paint()
      ..color = trackColor
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3;
    canvas.drawLine(
      Offset(1.5, centreY),
      Offset(size.width - 1.5, centreY),
      track,
    );

    final total = elapsed.inMilliseconds;
    if (total <= 0 || markers.isEmpty) {
      return;
    }

    final tick = Paint()
      ..color = markerColor
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3;
    for (final marker in markers) {
      final ratio = (marker.timestamp.inMilliseconds / total).clamp(0.0, 1.0);
      final x = 1.5 + (size.width - 3) * ratio;
      canvas.drawLine(
        Offset(x, centreY - size.height / 2 + 2),
        Offset(x, centreY + size.height / 2 - 2),
        tick,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _MarkerTrackPainter oldDelegate) {
    return oldDelegate.elapsed != elapsed ||
        oldDelegate.markers.length != markers.length ||
        oldDelegate.markerColor != markerColor;
  }
}

class _RecordingAction extends StatelessWidget {
  const _RecordingAction({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.destructive = false,
    this.primary = false,
    this.size = 64,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  /// Quiet, outlined treatment — reserved for 종료, which is pressed once.
  final bool destructive;

  /// The lead action: filled brand circle, larger tap target.
  final bool primary;
  final double size;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    final (Color background, Color foreground, BoxBorder? border) = switch ((
      primary,
      destructive,
    )) {
      (true, _) => (scheme.primary, scheme.onPrimary, null),
      (_, true) => (
        Colors.transparent,
        scheme.error,
        Border.all(color: scheme.error.withValues(alpha: 0.45), width: 1.5),
      ),
      _ => (scheme.surfaceContainerHighest, scheme.onSurface, null),
    };

    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: border,
              color: background,
            ),
            child: Material(
              color: Colors.transparent,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onPressed,
                child: SizedBox(
                  width: size,
                  height: size,
                  child: Icon(icon, color: foreground, size: primary ? 38 : 27),
                ),
              ),
            ),
          ),
          const SizedBox(height: 9),
          Text(
            label,
            style: theme.textTheme.labelMedium?.copyWith(
              color: destructive
                  ? scheme.error
                  : primary
                  ? scheme.primary
                  : scheme.onSurface,
              fontWeight: primary ? FontWeight.w700 : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _WaveformPainter extends CustomPainter {
  const _WaveformPainter({
    required this.amplitude,
    required this.color,
    required this.pausedColor,
    required this.paused,
  });

  final double amplitude;
  final Color color;
  final Color pausedColor;
  final bool paused;

  @override
  void paint(Canvas canvas, Size size) {
    const barCount = 31;
    const gap = 5.0;
    final barWidth = (size.width - gap * (barCount - 1)) / barCount;
    final paint = Paint()
      ..color = paused ? pausedColor : color
      ..strokeCap = StrokeCap.round
      ..strokeWidth = math.max(2, barWidth);

    for (var index = 0; index < barCount; index++) {
      final wave = (math.sin(index * 0.82) + 1) / 2;
      final centerBoost = 1 - ((index - barCount / 2).abs() / barCount);
      final factor = 0.18 + (wave * 0.42 + centerBoost * 0.4) * amplitude;
      final barHeight = math.max(6, size.height * factor);
      final x = index * (barWidth + gap) + barWidth / 2;
      canvas.drawLine(
        Offset(x, (size.height - barHeight) / 2),
        Offset(x, (size.height + barHeight) / 2),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _WaveformPainter oldDelegate) {
    return oldDelegate.amplitude != amplitude || oldDelegate.paused != paused;
  }
}
