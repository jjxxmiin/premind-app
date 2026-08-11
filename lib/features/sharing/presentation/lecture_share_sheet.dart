import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../lectures/domain/lecture.dart';
import '../../lectures/presentation/lecture_providers.dart';

Future<void> showLectureShareSheet(
  BuildContext context, {
  required String lectureId,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    backgroundColor: Theme.of(context).colorScheme.surface,
    builder: (_) => _LectureShareSheet(lectureId: lectureId),
  );
}

class _LectureShareSheet extends ConsumerStatefulWidget {
  const _LectureShareSheet({required this.lectureId});

  final String lectureId;

  @override
  ConsumerState<_LectureShareSheet> createState() => _LectureShareSheetState();
}

class _LectureShareSheetState extends ConsumerState<_LectureShareSheet> {
  late final Future<Lecture?> _lectureFuture;
  Lecture? _lecture;
  bool _includeAudio = true;
  bool _includeSummary = true;
  bool _includeKeyPoints = true;
  bool _includeTranscript = false;
  bool _creating = false;
  String? _shareUrl;
  String? _errorMessage;

  bool get _hasSelection =>
      _includeAudio ||
      _includeSummary ||
      _includeKeyPoints ||
      _includeTranscript;

  @override
  void initState() {
    super.initState();
    _lectureFuture = ref
        .read(lectureRepositoryProvider)
        .getLecture(widget.lectureId);
  }

  Future<void> _createLink(Lecture lecture) async {
    if (_creating || !_hasSelection) {
      return;
    }
    setState(() {
      _creating = true;
      _errorMessage = null;
    });

    try {
      await Future<void>.delayed(const Duration(milliseconds: 650));
      final link =
          lecture.shareUrl ?? 'https://premind.co.kr/share/${lecture.id}';
      await ref
          .read(lecturesProvider.notifier)
          .updateLecture(lecture.copyWith(shareUrl: link));
      if (!mounted) {
        return;
      }
      unawaited(HapticFeedback.selectionClick());
      setState(() {
        _lecture = lecture.copyWith(shareUrl: link);
        _shareUrl = link;
        _creating = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _creating = false;
        _errorMessage = '공유 링크를 만들지 못했어요. 잠시 후 다시 시도해주세요.';
      });
    }
  }

  Future<void> _copyLink() async {
    final link = _shareUrl;
    if (link == null) {
      return;
    }
    await Clipboard.setData(ClipboardData(text: link));
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('공유 링크를 복사했어요.')));
  }

  Future<void> _shareLink() async {
    final link = _shareUrl;
    final lecture = _lecture;
    if (link == null || lecture == null) {
      return;
    }
    final renderBox = context.findRenderObject() as RenderBox?;
    try {
      await SharePlus.instance.share(
        ShareParams(
          title: lecture.title,
          subject: '${lecture.title} · PREMIND',
          text: '${lecture.title}\n$link',
          sharePositionOrigin: renderBox == null
              ? null
              : renderBox.localToGlobal(Offset.zero) & renderBox.size,
        ),
      );
    } catch (_) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('공유 창을 열지 못했어요. 링크 복사를 이용해주세요.')),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return FutureBuilder<Lecture?>(
      future: _lectureFuture,
      builder: (context, snapshot) {
        final lecture = _lecture ?? snapshot.data;
        if (snapshot.connectionState != ConnectionState.done &&
            lecture == null) {
          return const SizedBox(
            height: 260,
            child: Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              ),
            ),
          );
        }
        if (lecture == null) {
          return _ShareLoadError(onClose: () => Navigator.of(context).pop());
        }
        _lecture ??= lecture;

        return AnimatedPadding(
          duration: const Duration(milliseconds: 150),
          padding: EdgeInsets.only(bottom: bottomInset),
          child: _shareUrl == null
              ? _ShareOptions(
                  lecture: lecture,
                  includeAudio: _includeAudio,
                  includeSummary: _includeSummary,
                  includeKeyPoints: _includeKeyPoints,
                  includeTranscript: _includeTranscript,
                  creating: _creating,
                  errorMessage: _errorMessage,
                  onAudioChanged: (value) =>
                      setState(() => _includeAudio = value),
                  onSummaryChanged: (value) =>
                      setState(() => _includeSummary = value),
                  onKeyPointsChanged: (value) =>
                      setState(() => _includeKeyPoints = value),
                  onTranscriptChanged: (value) =>
                      setState(() => _includeTranscript = value),
                  onCreate: _hasSelection ? () => _createLink(lecture) : null,
                )
              : _ShareComplete(onCopy: _copyLink, onShare: _shareLink),
        );
      },
    );
  }
}

class _ShareOptions extends StatelessWidget {
  const _ShareOptions({
    required this.lecture,
    required this.includeAudio,
    required this.includeSummary,
    required this.includeKeyPoints,
    required this.includeTranscript,
    required this.creating,
    required this.errorMessage,
    required this.onAudioChanged,
    required this.onSummaryChanged,
    required this.onKeyPointsChanged,
    required this.onTranscriptChanged,
    required this.onCreate,
  });

  final Lecture lecture;
  final bool includeAudio;
  final bool includeSummary;
  final bool includeKeyPoints;
  final bool includeTranscript;
  final bool creating;
  final String? errorMessage;
  final ValueChanged<bool> onAudioChanged;
  final ValueChanged<bool> onSummaryChanged;
  final ValueChanged<bool> onKeyPointsChanged;
  final ValueChanged<bool> onTranscriptChanged;
  final VoidCallback? onCreate;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '강의 공유하기',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            lecture.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 30),
          Text('공유할 내용', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          _SelectionRow(
            label: '강의 음성',
            value: includeAudio,
            onChanged: onAudioChanged,
          ),
          const Divider(height: 1),
          _SelectionRow(
            label: 'AI 요약',
            value: includeSummary,
            onChanged: onSummaryChanged,
          ),
          const Divider(height: 1),
          _SelectionRow(
            label: '핵심 내용',
            value: includeKeyPoints,
            onChanged: onKeyPointsChanged,
          ),
          const Divider(height: 1),
          _SelectionRow(
            label: '스크립트',
            value: includeTranscript,
            onChanged: onTranscriptChanged,
          ),
          const SizedBox(height: 24),
          Text('공개 범위', style: theme.textTheme.titleMedium),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            decoration: BoxDecoration(
              color: theme.colorScheme.primaryContainer.withValues(alpha: 0.46),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: theme.colorScheme.outlineVariant),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '링크가 있는 사람',
                        style: theme.textTheme.bodyLarge?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '링크를 받은 사람만 볼 수 있어요',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.check_rounded, color: theme.colorScheme.primary),
              ],
            ),
          ),
          if (errorMessage != null) ...[
            const SizedBox(height: 8),
            Text(
              errorMessage!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.error,
              ),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: creating ? null : onCreate,
            child: creating
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2.2),
                  )
                : const Text('공유 링크 만들기'),
          ),
        ],
      ),
    );
  }
}

class _SelectionRow extends StatelessWidget {
  const _SelectionRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => onChanged(!value),
        child: SizedBox(
          height: 58,
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              Switch.adaptive(value: value, onChanged: onChanged),
            ],
          ),
        ),
      ),
    );
  }
}

class _ShareComplete extends StatelessWidget {
  const _ShareComplete({required this.onCopy, required this.onShare});

  final VoidCallback onCopy;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: theme.colorScheme.primaryContainer,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.check_rounded,
                  size: 19,
                  color: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '공유 링크를 만들었어요',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.35,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '학생에게 링크를 보내면 선택한 강의 내용을 바로 확인할 수 있어요.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 28),
          OutlinedButton.icon(
            onPressed: onCopy,
            icon: const Icon(Icons.content_copy_rounded),
            label: const Text('링크 복사'),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: onShare,
            icon: const Icon(Icons.ios_share_rounded),
            label: const Text('공유하기'),
          ),
        ],
      ),
    );
  }
}

class _ShareLoadError extends StatelessWidget {
  const _ShareLoadError({required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('강의를 불러오지 못했어요', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          const Text('화면을 닫고 잠시 후 다시 시도해주세요.'),
          const SizedBox(height: 22),
          FilledButton(onPressed: onClose, child: const Text('확인')),
        ],
      ),
    );
  }
}
