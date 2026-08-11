import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/lecture.dart';
import 'lecture_providers.dart';
import 'widgets/content_state.dart';
import 'widgets/lecture_card.dart';

enum _LectureFilter { all, completed, processing, failed }

class LecturesScreen extends ConsumerStatefulWidget {
  const LecturesScreen({
    super.key,
    required this.onLectureTap,
    this.onStartRecording,
  });

  final ValueChanged<String> onLectureTap;
  final VoidCallback? onStartRecording;

  @override
  ConsumerState<LecturesScreen> createState() => _LecturesScreenState();
}

class _LecturesScreenState extends ConsumerState<LecturesScreen> {
  final _searchController = TextEditingController();
  _LectureFilter _filter = _LectureFilter.all;
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool _matchesFilter(Lecture lecture) {
    return switch (_filter) {
      _LectureFilter.all => true,
      _LectureFilter.completed => lecture.status == LectureStatus.completed,
      _LectureFilter.failed => lecture.status == LectureStatus.failed,
      _LectureFilter.processing => switch (lecture.status) {
        LectureStatus.recording ||
        LectureStatus.uploadPending ||
        LectureStatus.uploading ||
        LectureStatus.processing => true,
        LectureStatus.completed || LectureStatus.failed => false,
      },
    };
  }

  List<Lecture> _visibleLectures(List<Lecture> lectures) {
    final normalizedQuery = _query.trim().toLowerCase();
    final visible = lectures.where((lecture) {
      final matchesQuery =
          normalizedQuery.isEmpty ||
          lecture.title.toLowerCase().contains(normalizedQuery);
      return matchesQuery && _matchesFilter(lecture);
    }).toList()..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return visible;
  }

  @override
  Widget build(BuildContext context) {
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
                '내 강의',
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.8,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: TextField(
                controller: _searchController,
                onChanged: (value) => setState(() => _query = value),
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: '강의 제목 검색',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _query.isEmpty
                      ? null
                      : IconButton(
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _query = '');
                          },
                          tooltip: '검색어 지우기',
                          icon: const Icon(Icons.close_rounded),
                        ),
                  filled: true,
                  fillColor: theme.colorScheme.surface,
                  contentPadding: const EdgeInsets.symmetric(vertical: 16),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: theme.colorScheme.outlineVariant,
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: theme.colorScheme.outlineVariant,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: theme.colorScheme.primary,
                      width: 1.25,
                    ),
                  ),
                ),
              ),
            ),
            SizedBox(
              height: 64,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                children: [
                  _FilterChip(
                    label: '전체',
                    selected: _filter == _LectureFilter.all,
                    onSelected: () =>
                        setState(() => _filter = _LectureFilter.all),
                  ),
                  _FilterChip(
                    label: '분석 완료',
                    selected: _filter == _LectureFilter.completed,
                    onSelected: () =>
                        setState(() => _filter = _LectureFilter.completed),
                  ),
                  _FilterChip(
                    label: '처리 중',
                    selected: _filter == _LectureFilter.processing,
                    onSelected: () =>
                        setState(() => _filter = _LectureFilter.processing),
                  ),
                  _FilterChip(
                    label: '재시도 필요',
                    selected: _filter == _LectureFilter.failed,
                    onSelected: () =>
                        setState(() => _filter = _LectureFilter.failed),
                  ),
                ],
              ),
            ),
            Expanded(child: _buildBody(lectures)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(AsyncValue<List<Lecture>> value) {
    return value.when(
      loading: () => const SingleChildScrollView(
        physics: NeverScrollableScrollPhysics(),
        padding: EdgeInsets.symmetric(horizontal: 20),
        child: DelayedSkeleton(child: LectureListSkeleton(itemCount: 6)),
      ),
      error: (error, stackTrace) =>
          ContentError(onRetry: () => ref.invalidate(lecturesProvider)),
      data: (lectures) {
        final visibleLectures = _visibleLectures(lectures);

        if (lectures.isEmpty) {
          return ContentEmpty(
            icon: Icons.auto_stories_outlined,
            title: '아직 기록한 강의가 없어요',
            message: '첫 강의를 기록해보세요.',
            showIcon: false,
            expandAction: true,
            action: widget.onStartRecording == null
                ? null
                : FilledButton(
                    onPressed: widget.onStartRecording,
                    child: const Text('강의 녹음 시작'),
                  ),
          );
        }

        if (visibleLectures.isEmpty) {
          return ContentEmpty(
            icon: Icons.search_off_rounded,
            title: '조건에 맞는 강의가 없어요',
            message: '검색어나 필터를 바꿔보세요.',
            showIcon: false,
            action: TextButton(
              onPressed: () {
                _searchController.clear();
                setState(() {
                  _query = '';
                  _filter = _LectureFilter.all;
                });
              },
              child: const Text('검색·필터 초기화'),
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async {
            final _ = await ref.refresh(lecturesProvider.future);
          },
          child: ListView.separated(
            physics: const AlwaysScrollableScrollPhysics(),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
            itemCount: visibleLectures.length,
            separatorBuilder: (context, index) => Divider(
              height: 1,
              color: Theme.of(context).colorScheme.outlineVariant,
            ),
            itemBuilder: (context, index) {
              final lecture = visibleLectures[index];
              return LectureCard(
                lecture: lecture,
                onTap: () => widget.onLectureTap(lecture.id),
              );
            },
          ),
        );
      },
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: Material(
        color: selected ? colorScheme.primaryContainer : Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onSelected,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
            child: Text(
              label,
              style: theme.textTheme.labelLarge?.copyWith(
                color: selected
                    ? colorScheme.primary
                    : colorScheme.onSurfaceVariant,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
