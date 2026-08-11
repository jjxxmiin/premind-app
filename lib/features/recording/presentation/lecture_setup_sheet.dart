import 'package:flutter/material.dart';

Future<String?> showLectureSetupSheet(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const LectureSetupSheet(),
  );
}

class LectureSetupSheet extends StatefulWidget {
  const LectureSetupSheet({super.key});

  @override
  State<LectureSetupSheet> createState() => _LectureSetupSheetState();
}

class _LectureSetupSheetState extends State<LectureSetupSheet> {
  late final TextEditingController _titleController;
  String? _selectedRoom;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: '새 강의');
  }

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  void _submit() {
    final title = _titleController.text.trim();
    Navigator.of(context).pop(title.isEmpty ? '새 강의' : title);
  }

  Future<void> _selectRoom() async {
    final room = await showModalBottomSheet<String?>(
      context: context,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('최근 강의실', style: Theme.of(sheetContext).textTheme.titleLarge),
            const SizedBox(height: 14),
            _RoomOption(
              label: '선택 안 함',
              selected: _selectedRoom == null,
              onTap: () => Navigator.of(sheetContext).pop(''),
            ),
            _RoomOption(
              label: '인공지능 개론',
              selected: _selectedRoom == '인공지능 개론',
              onTap: () => Navigator.of(sheetContext).pop('인공지능 개론'),
            ),
            _RoomOption(
              label: '데이터 분석',
              selected: _selectedRoom == '데이터 분석',
              onTap: () => Navigator.of(sheetContext).pop('데이터 분석'),
            ),
          ],
        ),
      ),
    );
    if (!mounted || room == null) {
      return;
    }
    setState(() => _selectedRoom = room.isEmpty ? null : room);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(24, 12, 24, 24 + bottomInset),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: theme.colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(99),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text('강의 녹음', style: theme.textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(
            '제목을 확인하고 바로 시작해보세요.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 24),
          Text('강의 제목', style: theme.textTheme.labelLarge),
          const SizedBox(height: 8),
          TextField(
            controller: _titleController,
            autofocus: true,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            decoration: const InputDecoration(hintText: '강의 제목을 입력해주세요'),
          ),
          const SizedBox(height: 22),
          Text('최근 강의실', style: theme.textTheme.labelLarge),
          const SizedBox(height: 8),
          Material(
            color: theme.colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              onTap: _selectRoom,
              borderRadius: BorderRadius.circular(14),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 15,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _selectedRoom ?? '선택 안 함',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: _selectedRoom == null
                              ? theme.colorScheme.onSurfaceVariant
                              : theme.colorScheme.onSurface,
                        ),
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: theme.colorScheme.outline,
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          FilledButton(onPressed: _submit, child: const Text('녹음 시작')),
        ],
      ),
    );
  }
}

class _RoomOption extends StatelessWidget {
  const _RoomOption({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      onTap: onTap,
      title: Text(label),
      trailing: selected
          ? Icon(
              Icons.check_rounded,
              color: Theme.of(context).colorScheme.primary,
            )
          : null,
    );
  }
}
