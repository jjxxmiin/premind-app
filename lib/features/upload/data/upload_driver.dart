import 'dart:async';

import 'package:premind/features/auth/data/auth_token_store.dart';
import 'package:premind/features/upload/data/upload_queue_repository.dart';
import 'package:premind/features/upload/domain/upload_job.dart';

/// Drains the upload queue on its own, so a finished recording reaches the
/// server without the user having to open a screen.
///
/// Draining is deliberately gated on the device holding API tokens: the
/// development login stores a session but no tokens, and running the queue
/// without them would mark every recording as permanently failed.
class UploadDriver {
  UploadDriver({
    required Future<void> Function() processQueue,
    required UploadQueueRepository queueRepository,
    required AuthTokenStore tokenStore,
    DateTime Function()? now,
    Future<void> Function()? onDrained,
  }) : _processQueue = processQueue,
       _queueRepository = queueRepository,
       _tokenStore = tokenStore,
       _now = now ?? DateTime.now,
       _onDrained = onDrained;

  /// Floor for the retry timer, so a job that is already due does not busy-loop.
  static const _minimumRetryDelay = Duration(seconds: 1);

  final Future<void> Function() _processQueue;
  final UploadQueueRepository _queueRepository;
  final AuthTokenStore _tokenStore;
  final DateTime Function() _now;
  final Future<void> Function()? _onDrained;

  Timer? _retryTimer;
  bool _draining = false;
  bool _disposed = false;

  /// Whether a drain is currently in flight; exposed for tests.
  bool get isDraining => _draining;

  /// Runs the queue if there is anything due and the device can authenticate.
  ///
  /// Never throws: an upload failing is the queue's business, not the caller's.
  /// After a pass, schedules a timer for the earliest pending retry so a job
  /// that failed on a dead network recovers by itself.
  Future<void> drain() async {
    if (_disposed || _draining) {
      return;
    }
    _draining = true;
    try {
      if (await _tokenStore.read() == null) {
        // Signed out, or signed in with the development account: leave the
        // recordings queued rather than burning them as terminal failures.
        return;
      }
      await _processQueue();
      await _onDrained?.call();
    } on Object {
      // Swallowed on purpose — job outcomes are persisted by the uploader.
    } finally {
      _draining = false;
      if (!_disposed) {
        await _scheduleNextRetry();
      }
    }
  }

  /// Call when the app returns to the foreground.
  void handleResumed() => unawaited(drain());

  void dispose() {
    _disposed = true;
    _retryTimer?.cancel();
    _retryTimer = null;
  }

  /// Arms a timer for the soonest job whose backoff has not elapsed yet.
  Future<void> _scheduleNextRetry() async {
    _retryTimer?.cancel();
    _retryTimer = null;

    final pending = await _queueRepository.getPending();
    if (_disposed) {
      return;
    }

    DateTime? earliest;
    for (final job in pending) {
      final next = job.nextAttemptAt;
      if (job.status == UploadJobStatus.cancelled || next == null) {
        continue;
      }
      if (earliest == null || next.isBefore(earliest)) {
        earliest = next;
      }
    }
    if (earliest == null) {
      return;
    }

    var delay = earliest.difference(_now());
    if (delay < _minimumRetryDelay) {
      delay = _minimumRetryDelay;
    }
    _retryTimer = Timer(delay, () => unawaited(drain()));
  }
}
