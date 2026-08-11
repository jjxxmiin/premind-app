import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/utils/duration_format.dart';
import 'recording_state.dart';

class RecordingCompleteScreen extends StatefulWidget {
  const RecordingCompleteScreen({required this.recording, super.key});

  final RecordingState recording;

  @override
  State<RecordingCompleteScreen> createState() =>
      _RecordingCompleteScreenState();
}

class _RecordingCompleteScreenState extends State<RecordingCompleteScreen> {
  late final Future<_LocalFileInfo> _fileInfo;

  @override
  void initState() {
    super.initState();
    _fileInfo = _inspectFile();
  }

  Future<_LocalFileInfo> _inspectFile() async {
    final path = widget.recording.filePath;
    if (path == null) {
      return const _LocalFileInfo(exists: false, bytes: 0);
    }
    final file = File(path);
    try {
      final exists = await file.exists();
      final bytes = exists ? await file.length() : 0;
      return _LocalFileInfo(exists: exists, bytes: bytes);
    } on FileSystemException {
      return const _LocalFileInfo(exists: false, bytes: 0);
    }
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) {
      return '$bytes B';
    }
    if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    }
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('녹음 저장'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primaryContainer,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.check_rounded,
                      color: theme.colorScheme.primary,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 9),
                  Text(
                    '기기에 저장됨',
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              Text(
                '강의를 안전하게\n저장했어요',
                style: theme.textTheme.headlineMedium?.copyWith(height: 1.25),
              ),
              const SizedBox(height: 10),
              Text(
                '앱을 닫아도 녹음 파일은 이 기기에 그대로 남아 있어요.\n이어서 AI 강의 노트를 만들 수 있어요.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  height: 1.55,
                ),
              ),
              const SizedBox(height: 36),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 18,
                ),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  children: [
                    _ResultRow(label: '강의 제목', value: widget.recording.title),
                    const Divider(height: 28),
                    _ResultRow(
                      label: '녹음 길이',
                      value: formatDuration(widget.recording.elapsed),
                    ),
                    const Divider(height: 28),
                    _ResultRow(
                      label: '중요 표시',
                      value: '${widget.recording.markers.length}개',
                    ),
                    const Divider(height: 28),
                    FutureBuilder<_LocalFileInfo>(
                      future: _fileInfo,
                      builder: (context, snapshot) {
                        if (!snapshot.hasData) {
                          return const _ResultRow(
                            label: '로컬 파일',
                            value: '확인 중',
                          );
                        }
                        final info = snapshot.requireData;
                        return _ResultRow(
                          label: '로컬 파일',
                          value: info.exists
                              ? '${_formatBytes(info.bytes)} · 저장됨'
                              : '파일 확인 필요',
                          valueColor: info.exists
                              ? theme.colorScheme.tertiary
                              : theme.colorScheme.error,
                        );
                      },
                    ),
                  ],
                ),
              ),
              const Spacer(),
              FilledButton(
                onPressed: widget.recording.lectureId == null
                    ? null
                    : () => context.goNamed(
                        'processing',
                        pathParameters: {
                          'lectureId': widget.recording.lectureId!,
                        },
                      ),
                child: const Text('AI 강의 노트 만들기'),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => context.goNamed('home'),
                child: const Text('나중에 정리하기'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({required this.label, required this.value, this.valueColor});

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: valueColor,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

class _LocalFileInfo {
  const _LocalFileInfo({required this.exists, required this.bytes});

  final bool exists;
  final int bytes;
}
