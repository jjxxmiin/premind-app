import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:premind/features/recording/data/recording_session_repository.dart';
import 'package:premind/features/recording/domain/recording_session.dart';

final recordingSessionRepositoryProvider = Provider<RecordingSessionRepository>(
  (ref) {
    return RecordingSessionRepository();
  },
);

final recoverableRecordingSessionsProvider =
    FutureProvider<List<RecordingSession>>((ref) {
      return ref.watch(recordingSessionRepositoryProvider).getRecoverable();
    });
