import '../domain/recording_session.dart';

enum RecordingFlowStatus {
  idle,
  preparing,
  recording,
  paused,
  completed,
  permissionDenied,
  failed,
}

class RecordingState {
  const RecordingState({
    required this.title,
    this.status = RecordingFlowStatus.idle,
    this.elapsed = Duration.zero,
    this.amplitude = 0,
    this.markers = const [],
    this.sessionId,
    this.lectureId,
    this.filePath,
    this.errorMessage,
    this.permissionPermanentlyDenied = false,
  });

  final String title;
  final RecordingFlowStatus status;
  final Duration elapsed;
  final double amplitude;
  final List<RecordingMarker> markers;
  final String? sessionId;
  final String? lectureId;
  final String? filePath;
  final String? errorMessage;
  final bool permissionPermanentlyDenied;

  bool get isActive =>
      status == RecordingFlowStatus.recording ||
      status == RecordingFlowStatus.paused;

  RecordingState copyWith({
    RecordingFlowStatus? status,
    Duration? elapsed,
    double? amplitude,
    List<RecordingMarker>? markers,
    String? sessionId,
    String? lectureId,
    String? filePath,
    String? errorMessage,
    bool? permissionPermanentlyDenied,
  }) {
    return RecordingState(
      title: title,
      status: status ?? this.status,
      elapsed: elapsed ?? this.elapsed,
      amplitude: amplitude ?? this.amplitude,
      markers: markers ?? this.markers,
      sessionId: sessionId ?? this.sessionId,
      lectureId: lectureId ?? this.lectureId,
      filePath: filePath ?? this.filePath,
      errorMessage: errorMessage ?? this.errorMessage,
      permissionPermanentlyDenied:
          permissionPermanentlyDenied ?? this.permissionPermanentlyDenied,
    );
  }
}
