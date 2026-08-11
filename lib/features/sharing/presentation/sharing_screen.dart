import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../lectures/domain/lecture.dart';
import '../../lectures/presentation/lecture_providers.dart';
import '../../lectures/presentation/widgets/content_state.dart';
import '../../lectures/presentation/widgets/lecture_card.dart';

class SharingScreen extends ConsumerWidget {
  const SharingScreen({super.key, this.onLectureTap, this.onBrowseLectures});

  final ValueChanged<String>? onLectureTap;
  final VoidCallback? onBrowseLectures;

  Future<void> _copyLink(BuildContext context, String link) async {
    await Clipboard.setData(ClipboardData(text: link));
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('공유 링크를 복사했어요.')));
  }

  Future<void> _showStopSharing(
    BuildContext context,
    WidgetRef ref,
    Lecture lecture,
  ) async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '공유를 중지할까요?',
              style: Theme.of(
                sheetContext,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              '‘${lecture.title}’ 링크를 더 이상 사용할 수 없게 됩니다.',
              style: Theme.of(sheetContext).textTheme.bodyMedium?.copyWith(
                color: Theme.of(sheetContext).colorScheme.onSurfaceVariant,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: () => Navigator.of(sheetContext).pop(false),
              child: const Text('계속 공유하기'),
            ),
            const SizedBox(height: 10),
            FilledButton(
              onPressed: () => Navigator.of(sheetContext).pop(true),
              style: FilledButton.styleFrom(
                backgroundColor: Theme.of(sheetContext).colorScheme.error,
                foregroundColor: Theme.of(sheetContext).colorScheme.onError,
              ),
              child: const Text('공유 중지'),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true || !context.mounted) {
      return;
    }
    try {
      await ref
          .read(lecturesProvider.notifier)
          .updateLecture(lecture.copyWith(shareUrl: null));
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('공유를 중지했어요.')));
    } catch (_) {
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('공유를 중지하지 못했어요. 다시 시도해주세요.')),
        );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lectures = ref.watch(lecturesProvider);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
              child: Text(
                '공유',
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.8,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 7, 20, 24),
              child: Text(
                '공유 중인 강의와 링크를 한곳에서 관리해요.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            Expanded(
              child: lectures.when(
                loading: () =>
                    const DelayedSkeleton(child: _SharingListSkeleton()),
                error: (error, stackTrace) => ContentError(
                  onRetry: () => ref.invalidate(lecturesProvider),
                ),
                data: (items) => _buildList(context, ref, items),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList(BuildContext context, WidgetRef ref, List<Lecture> items) {
    final shared =
        items
            .where((lecture) => lecture.shareUrl?.trim().isNotEmpty ?? false)
            .toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    if (shared.isEmpty) {
      return _SharingEmptyState(onBrowseLectures: onBrowseLectures);
    }

    return RefreshIndicator(
      onRefresh: () async {
        final _ = await ref.refresh(lecturesProvider.future);
      },
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 28),
        itemCount: shared.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
              child: Text(
                '공유 중 ${shared.length}개',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            );
          }

          final lecture = shared[index - 1];
          final link = lecture.shareUrl!;
          return _SharedLectureRow(
            lecture: lecture,
            isLast: index == shared.length,
            onTap: onLectureTap == null
                ? null
                : () => onLectureTap!(lecture.id),
            onCopy: () => _copyLink(context, link),
            onStop: () => _showStopSharing(context, ref, lecture),
          );
        },
      ),
    );
  }
}

class _SharedLectureRow extends StatelessWidget {
  const _SharedLectureRow({
    required this.lecture,
    required this.onCopy,
    required this.onStop,
    required this.isLast,
    this.onTap,
  });

  final Lecture lecture;
  final VoidCallback onCopy;
  final VoidCallback onStop;
  final VoidCallback? onTap;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Padding(
      padding: const EdgeInsets.only(left: 20),
      child: Container(
        padding: const EdgeInsets.fromLTRB(0, 18, 20, 10),
        decoration: isLast
            ? null
            : BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: colorScheme.outlineVariant),
                ),
              ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onTap,
                borderRadius: BorderRadius.circular(10),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              lecture.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.titleMedium?.copyWith(
                                height: 1.35,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${formatLectureDate(lecture.createdAt)} · 링크가 활성화되어 있어요',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: colorScheme.tertiaryContainer,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '공유 중',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: colorScheme.onTertiaryContainer,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 7),
            Row(
              children: [
                TextButton(onPressed: onCopy, child: const Text('링크 복사')),
                TextButton(
                  onPressed: onStop,
                  style: TextButton.styleFrom(
                    foregroundColor: colorScheme.error,
                  ),
                  child: const Text('공유 중지'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SharingEmptyState extends StatelessWidget {
  const _SharingEmptyState({this.onBrowseLectures});

  final VoidCallback? onBrowseLectures;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '아직 공유한 강의가 없어요',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              '정리가 끝난 강의에서 공유 링크를 만들어보세요.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            if (onBrowseLectures != null) ...[
              const SizedBox(height: 22),
              FilledButton(
                onPressed: onBrowseLectures,
                child: const Text('강의 보러가기'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SharingListSkeleton extends StatelessWidget {
  const _SharingListSkeleton();

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
      itemCount: 3,
      separatorBuilder: (context, index) => Divider(
        height: 1,
        color: Theme.of(context).colorScheme.outlineVariant,
      ),
      itemBuilder: (context, index) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FractionallySizedBox(
              widthFactor: 0.62,
              child: Container(
                height: 20,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(7),
                ),
              ),
            ),
            const SizedBox(height: 10),
            FractionallySizedBox(
              widthFactor: 0.44,
              child: Container(
                height: 13,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
            ),
            const SizedBox(height: 15),
            FractionallySizedBox(
              widthFactor: 0.82,
              child: Container(
                height: 12,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
