import 'package:flutter/material.dart';
import 'package:premind/core/constants/app_colors.dart';

import '../../domain/lecture.dart';

String formatLectureDuration(Duration duration) {
  final hours = duration.inHours;
  final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
  final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');

  if (hours > 0) {
    return '$hours:$minutes:$seconds';
  }
  return '${duration.inMinutes}:$seconds';
}

String formatLectureDate(DateTime date) {
  final local = date.toLocal();
  final month = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  return '${local.year}.$month.$day';
}

String formatLectureListDate(DateTime date, {DateTime? now}) {
  final local = date.toLocal();
  final today = (now ?? DateTime.now()).toLocal();
  final localDay = DateTime(local.year, local.month, local.day);
  final todayDay = DateTime(today.year, today.month, today.day);
  final difference = todayDay.difference(localDay).inDays;
  final period = local.hour < 12 ? '오전' : '오후';
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final minute = local.minute.toString().padLeft(2, '0');
  final time = '$period $hour:$minute';

  if (difference == 0) {
    return '오늘 $time';
  }
  if (difference == 1) {
    return '어제 $time';
  }
  if (local.year == today.year) {
    return '${local.month}월 ${local.day}일 $time';
  }
  return '${local.year}년 ${local.month}월 ${local.day}일';
}

String formatLectureListDuration(Duration duration) {
  if (duration.inHours > 0) {
    final remainingMinutes = duration.inMinutes.remainder(60);
    return remainingMinutes == 0
        ? '${duration.inHours}시간'
        : '${duration.inHours}시간 $remainingMinutes분';
  }
  if (duration.inMinutes > 0) {
    return '${duration.inMinutes}분';
  }
  return '${duration.inSeconds}초';
}

String lectureStatusLabel(LectureStatus status) {
  return switch (status) {
    LectureStatus.recording => '녹음 중',
    LectureStatus.uploadPending => '업로드 대기',
    LectureStatus.uploading => '업로드 중',
    LectureStatus.processing => '정리 중',
    LectureStatus.completed => '정리 완료',
    LectureStatus.failed => '다시 업로드 필요',
  };
}

class LectureStatusBadge extends StatelessWidget {
  const LectureStatusBadge({super.key, required this.status});

  final LectureStatus status;

  @override
  Widget build(BuildContext context) {
    final foreground = switch (status) {
      LectureStatus.completed => AppColors.positiveStrong,
      LectureStatus.failed ||
      LectureStatus.recording => AppColors.negativeStrong,
      LectureStatus.uploadPending ||
      LectureStatus.uploading ||
      LectureStatus.processing => AppColors.warningStrong,
    };

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 5,
          height: 5,
          decoration: BoxDecoration(color: foreground, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          lectureStatusLabel(status),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: foreground,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class LectureCard extends StatelessWidget {
  const LectureCard({
    super.key,
    required this.lecture,
    required this.onTap,
    this.trailing,
    this.compact = false,
  });

  final Lecture lecture;
  final VoidCallback onTap;
  final Widget? trailing;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: compact ? 15 : 18),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
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
                        fontSize: compact ? 16 : 17,
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 7,
                      runSpacing: 5,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          formatLectureListDate(lecture.createdAt),
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                        Container(
                          width: 3,
                          height: 3,
                          decoration: BoxDecoration(
                            color: colorScheme.outline,
                            shape: BoxShape.circle,
                          ),
                        ),
                        Text(
                          formatLectureListDuration(lecture.duration),
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                        Container(
                          width: 3,
                          height: 3,
                          decoration: BoxDecoration(
                            color: colorScheme.outline,
                            shape: BoxShape.circle,
                          ),
                        ),
                        Text(
                          lecture.recordingType == RecordingType.video
                              ? '영상'
                              : '음성',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 7),
                    LectureStatusBadge(status: lecture.status),
                  ],
                ),
              ),
              if (trailing != null) ...[const SizedBox(width: 8), trailing!],
            ],
          ),
        ),
      ),
    );
  }
}
