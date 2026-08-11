import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:premind/core/widgets/app_wordmark.dart';

import '../../lectures/domain/lecture.dart';
import '../../lectures/presentation/lecture_providers.dart';
import '../../lectures/presentation/widgets/content_state.dart';
import '../../lectures/presentation/widgets/lecture_card.dart';
import '../../recording/domain/recording_session.dart';
import '../../recording/presentation/recording_session_providers.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({
    super.key,
    required this.onStartRecording,
    required this.onVideoTap,
    required this.onLectureTap,
    required this.onRecoverLecture,
    this.onSeeAllLectures,
    this.onProfileTap,
  });

  final VoidCallback onStartRecording;
  final VoidCallback onVideoTap;
  final ValueChanged<String> onLectureTap;
  final ValueChanged<String> onRecoverLecture;
  final VoidCallback? onSeeAllLectures;
  final VoidCallback? onProfileTap;

  Future<void> _refresh(WidgetRef ref) async {
    final _ = await ref.refresh(lecturesProvider.future);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lectures = ref.watch(lecturesProvider);
    final recoverableSessions = ref.watch(recoverableRecordingSessionsProvider);
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _refresh(ref),
          color: colorScheme.primary,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                sliver: SliverToBoxAdapter(
                  child: _HomeHeader(onProfileTap: onProfileTap),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 44, 20, 0),
                sliver: SliverToBoxAdapter(child: _WelcomeMessage()),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
                sliver: SliverToBoxAdapter(
                  child: _PrimaryRecordingAction(onTap: onStartRecording),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                sliver: SliverToBoxAdapter(
                  child: _VideoAction(onTap: onVideoTap),
                ),
              ),
              ..._buildRecoveryBanner(recoverableSessions),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 40, 20, 8),
                sliver: SliverToBoxAdapter(
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '최근 강의',
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      TextButton(
                        onPressed:
                            onSeeAllLectures ??
                            () {
                              ScaffoldMessenger.of(context)
                                ..hideCurrentSnackBar()
                                ..showSnackBar(
                                  const SnackBar(
                                    content: Text('하단의 강의 탭에서 전체 강의를 볼 수 있어요.'),
                                  ),
                                );
                            },
                        style: TextButton.styleFrom(
                          foregroundColor: colorScheme.onSurfaceVariant,
                          minimumSize: const Size(0, 40),
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                        ),
                        child: const Text('전체보기'),
                      ),
                    ],
                  ),
                ),
              ),
              ..._buildRecentLectures(context, ref, lectures),
              const SliverToBoxAdapter(child: SizedBox(height: 28)),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildRecoveryBanner(
    AsyncValue<List<RecordingSession>> sessions,
  ) {
    return sessions.maybeWhen(
      data: (items) {
        if (items.isEmpty) {
          return const <Widget>[];
        }
        final session = items.first;
        return <Widget>[
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            sliver: SliverToBoxAdapter(
              child: _RecoveryBanner(
                additionalCount: items.length - 1,
                onPressed: () => onRecoverLecture(session.lectureId),
              ),
            ),
          ),
        ];
      },
      orElse: () => const <Widget>[],
    );
  }

  List<Widget> _buildRecentLectures(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<List<Lecture>> value,
  ) {
    return value.when(
      loading: () => const [
        SliverPadding(
          padding: EdgeInsets.symmetric(horizontal: 20),
          sliver: SliverToBoxAdapter(
            child: DelayedSkeleton(
              child: LectureListSkeleton(itemCount: 3, compact: true),
            ),
          ),
        ),
      ],
      error: (error, stackTrace) => [
        SliverToBoxAdapter(
          child: SizedBox(
            height: 230,
            child: ContentError(
              onRetry: () => ref.invalidate(lecturesProvider),
            ),
          ),
        ),
      ],
      data: (items) {
        final recent = [...items]
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        final visibleItems = recent.take(3).toList();

        if (visibleItems.isEmpty) {
          return [
            SliverToBoxAdapter(
              child: ContentEmpty(
                icon: Icons.auto_stories_outlined,
                title: '아직 기록한 강의가 없어요',
                message: '첫 강의를 기록해보세요.',
                showIcon: false,
                expandAction: true,
                action: FilledButton(
                  onPressed: onStartRecording,
                  child: const Text('강의 녹음 시작'),
                ),
              ),
            ),
          ];
        }

        return [
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverList.separated(
              itemCount: visibleItems.length,
              separatorBuilder: (context, index) => Divider(
                height: 1,
                color: Theme.of(context).colorScheme.outlineVariant,
              ),
              itemBuilder: (context, index) {
                final lecture = visibleItems[index];
                return LectureCard(
                  lecture: lecture,
                  compact: true,
                  onTap: () => onLectureTap(lecture.id),
                );
              },
            ),
          ),
        ];
      },
    );
  }
}

class _RecoveryBanner extends StatelessWidget {
  const _RecoveryBanner({
    required this.additionalCount,
    required this.onPressed,
  });

  final int additionalCount;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.secondaryContainer.withValues(alpha: 0.62),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        children: [
          Icon(Icons.cloud_upload_outlined, color: theme.colorScheme.secondary),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '업로드하지 않은 강의가 있어요',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  additionalCount > 0
                      ? '이 강의 외 $additionalCount개가 기기에 안전하게 저장되어 있어요.'
                      : '녹음 파일은 기기에 안전하게 저장되어 있어요.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          TextButton(onPressed: onPressed, child: const Text('정리 계속')),
        ],
      ),
    );
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({this.onProfileTap});

  final VoidCallback? onProfileTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    void showComingSoon() {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('준비 중인 기능이에요.')));
    }

    return Row(
      children: [
        const Expanded(
          child: Align(
            alignment: Alignment.centerLeft,
            child: AppWordmark(height: 22),
          ),
        ),
        Material(
          color: colorScheme.surface,
          shape: CircleBorder(
            side: BorderSide(color: colorScheme.outlineVariant),
          ),
          child: InkWell(
            onTap: onProfileTap ?? showComingSoon,
            customBorder: const CircleBorder(),
            child: SizedBox(
              width: 40,
              height: 40,
              child: Icon(
                Icons.person_outline_rounded,
                size: 20,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _WelcomeMessage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '오늘 강의를\n기록해볼까요?',
          style: theme.textTheme.headlineMedium?.copyWith(
            fontSize: 30,
            height: 1.26,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.9,
          ),
        ),
      ],
    );
  }
}

class _PrimaryRecordingAction extends StatelessWidget {
  const _PrimaryRecordingAction({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Material(
      color: colorScheme.primaryContainer,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 184,
          child: Stack(
            children: [
              Positioned(
                right: -36,
                top: -48,
                child: _TerminalCircle(
                  size: 132,
                  color: colorScheme.primary.withValues(alpha: 0.07),
                ),
              ),
              Positioned(
                right: 54,
                bottom: -24,
                child: _TerminalCircle(
                  size: 68,
                  color: colorScheme.primary.withValues(alpha: 0.06),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '강의 녹음',
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: colorScheme.onPrimaryContainer,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '음성으로 강의를 기록하고\nAI 노트를 만들어보세요.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colorScheme.onPrimaryContainer.withValues(
                          alpha: 0.72,
                        ),
                        height: 1.5,
                      ),
                    ),
                    const Spacer(),
                    Align(
                      alignment: Alignment.bottomRight,
                      child: Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: colorScheme.primary,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.mic_none_rounded,
                          size: 25,
                          color: colorScheme.onPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TerminalCircle extends StatelessWidget {
  const _TerminalCircle({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: SizedBox.square(
        dimension: size,
        child: DecoratedBox(
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
      ),
    );
  }
}

class _VideoAction extends StatelessWidget {
  const _VideoAction({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Material(
      color: colorScheme.surface.withValues(alpha: 0.82),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: colorScheme.outlineVariant),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
          child: Row(
            children: [
              Icon(
                Icons.videocam_outlined,
                size: 21,
                color: colorScheme.onSurfaceVariant,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  '영상으로 기록하기',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                '준비 중',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
