import 'dart:async';

import 'package:flutter/material.dart';

class ContentLoading extends StatelessWidget {
  const ContentLoading({super.key, this.message = '불러오고 있어요'});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ContentError extends StatelessWidget {
  const ContentError({
    super.key,
    required this.onRetry,
    this.title = '내용을 불러오지 못했어요',
    this.message = '잠시 후 다시 시도해 주세요.',
  });

  final VoidCallback onRetry;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: colorScheme.errorContainer,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.cloud_off_outlined,
                color: colorScheme.onErrorContainer,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              title,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('다시 시도'),
            ),
          ],
        ),
      ),
    );
  }
}

class ContentEmpty extends StatelessWidget {
  const ContentEmpty({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
    this.showIcon = true,
    this.expandAction = false,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;
  final bool showIcon;
  final bool expandAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (showIcon) ...[
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  icon,
                  size: 24,
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 20),
            ],
            Text(
              title,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                height: 1.5,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            if (action != null) ...[
              const SizedBox(height: 22),
              if (expandAction)
                SizedBox(width: double.infinity, child: action)
              else
                action!,
            ],
          ],
        ),
      ),
    );
  }
}

class DelayedSkeleton extends StatefulWidget {
  const DelayedSkeleton({
    super.key,
    required this.child,
    this.delay = const Duration(milliseconds: 280),
  });

  final Widget child;
  final Duration delay;

  @override
  State<DelayedSkeleton> createState() => _DelayedSkeletonState();
}

class _DelayedSkeletonState extends State<DelayedSkeleton> {
  Timer? _timer;
  bool _isVisible = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer(widget.delay, () {
      if (mounted) {
        setState(() => _isVisible = true);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: IgnorePointer(
        child: AnimatedOpacity(
          opacity: _isVisible ? 1 : 0,
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOut,
          child: widget.child,
        ),
      ),
    );
  }
}

class LectureListSkeleton extends StatelessWidget {
  const LectureListSkeleton({
    super.key,
    this.itemCount = 5,
    this.compact = false,
  });

  final int itemCount;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final dividerColor = Theme.of(context).colorScheme.outlineVariant;

    return Column(
      children: [
        for (var index = 0; index < itemCount; index++) ...[
          _LectureSkeletonRow(compact: compact, index: index),
          if (index < itemCount - 1) Divider(height: 1, color: dividerColor),
        ],
      ],
    );
  }
}

class _LectureSkeletonRow extends StatelessWidget {
  const _LectureSkeletonRow({required this.compact, required this.index});

  final bool compact;
  final int index;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(
      context,
    ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.85);

    return Padding(
      padding: EdgeInsets.symmetric(vertical: compact ? 15 : 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FractionallySizedBox(
            widthFactor: index.isEven ? 0.56 : 0.72,
            alignment: Alignment.centerLeft,
            child: _SkeletonBar(color: color, height: 17),
          ),
          const SizedBox(height: 10),
          FractionallySizedBox(
            widthFactor: index.isEven ? 0.42 : 0.5,
            alignment: Alignment.centerLeft,
            child: _SkeletonBar(color: color, height: 12),
          ),
          const SizedBox(height: 9),
          FractionallySizedBox(
            widthFactor: 0.22,
            alignment: Alignment.centerLeft,
            child: _SkeletonBar(color: color, height: 10),
          ),
        ],
      ),
    );
  }
}

class _SkeletonBar extends StatelessWidget {
  const _SkeletonBar({required this.color, required this.height});

  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(6),
      ),
    );
  }
}
