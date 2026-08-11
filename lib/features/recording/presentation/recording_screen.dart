import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/utils/duration_format.dart';
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
        padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: math.max(0, constraints.maxHeight - 34),
          ),
          child: IntrinsicHeight(
            child: Column(
              children: [
                Row(
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
                        color: isPaused
                            ? scheme.onSurfaceVariant
                            : scheme.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    Icon(
                      Icons.shield_outlined,
                      size: 17,
                      color: scheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      '기기에 저장 중',
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                Text(
                  formatDuration(recording.elapsed),
                  style: theme.textTheme.displaySmall?.copyWith(
                    fontSize: 48,
                    fontFeatures: const [FontFeature.tabularFigures()],
                    fontWeight: FontWeight.w700,
                    letterSpacing: -1.8,
                  ),
                ),
                const SizedBox(height: 34),
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
                const SizedBox(height: 30),
                Text(
                  isPaused ? '잠시 멈춰 있어요' : '강의를 기록하고 있어요',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  child: Text(
                    recording.markers.isEmpty
                        ? '기억할 순간은 중요 표시로 남겨보세요.'
                        : '중요 표시 ${recording.markers.length}개를 남겼어요.',
                    key: ValueKey(recording.markers.length),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ),
                if (recording.errorMessage?.isNotEmpty == true) ...[
                  const SizedBox(height: 10),
                  Text(
                    recording.errorMessage!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: scheme.error,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
                const Spacer(),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _RecordingAction(
                      icon: recording.markers.isEmpty
                          ? Icons.star_border_rounded
                          : Icons.star_rounded,
                      label: '중요 표시',
                      onPressed: onMarker,
                      highlighted: recording.markers.isNotEmpty,
                    ),
                    _RecordingAction(
                      icon: isPaused ? Icons.mic_rounded : Icons.pause_rounded,
                      label: isPaused ? '계속하기' : '일시정지',
                      onPressed: onPauseToggle,
                    ),
                    _RecordingAction(
                      icon: Icons.stop_rounded,
                      label: '종료',
                      destructive: true,
                      onPressed: onFinish,
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

class _RecordingAction extends StatelessWidget {
  const _RecordingAction({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.destructive = false,
    this.highlighted = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final bool destructive;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final foreground = destructive
        ? scheme.onError
        : highlighted
        ? scheme.primary
        : scheme.onSurface;
    final background = destructive
        ? scheme.error
        : highlighted
        ? scheme.primaryContainer
        : scheme.surfaceContainerHighest;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Column(
        children: [
          Material(
            color: background,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onPressed,
              child: SizedBox(
                width: 64,
                height: 64,
                child: Icon(icon, color: foreground, size: 29),
              ),
            ),
          ),
          const SizedBox(height: 9),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: destructive ? scheme.error : scheme.onSurface,
              fontWeight: FontWeight.w600,
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
