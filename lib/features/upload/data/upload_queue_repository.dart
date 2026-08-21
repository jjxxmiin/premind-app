import 'dart:async';
import 'dart:convert';

import 'package:premind/features/upload/domain/upload_job.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Durable storage for the resumable upload queue.
///
/// Mirrors `RecordingSessionRepository`: every read-modify-write is serialized
/// through a process-wide future chain so two holders of the queue cannot
/// clobber each other, and a damaged record never takes the rest of the queue
/// down with it.
class UploadQueueRepository {
  UploadQueueRepository({
    Future<SharedPreferences> Function()? preferencesFactory,
  }) : _preferencesFactory =
           preferencesFactory ?? SharedPreferences.getInstance;

  static const _queueKey = 'premind.upload_queue.v1';
  static Future<void> _operationTail = Future<void>.value();

  final Future<SharedPreferences> Function() _preferencesFactory;
  Future<SharedPreferences>? _preferences;

  Future<SharedPreferences> get _prefs =>
      _preferences ??= _preferencesFactory();

  /// Adds [job] to the queue, keeping any job already stored under the same id.
  ///
  /// Re-enqueueing must never discard upload progress, so an existing entry
  /// wins and is returned unchanged.
  Future<UploadJob> enqueue(UploadJob job) {
    return _serialized(() async {
      final preferences = await _prefs;
      final jobs = _decodeJobs(preferences.getString(_queueKey));
      for (final existing in jobs) {
        if (existing.id == job.id) {
          return existing;
        }
      }
      jobs.add(job);
      await _persist(preferences, jobs);
      return job;
    });
  }

  Future<void> save(UploadJob job) {
    return _serialized(() async {
      final preferences = await _prefs;
      final jobs = _decodeJobs(preferences.getString(_queueKey));
      final index = jobs.indexWhere((item) => item.id == job.id);
      if (index == -1) {
        jobs.add(job);
      } else {
        jobs[index] = job;
      }
      await _persist(preferences, jobs);
    });
  }

  Future<UploadJob?> get(String id) {
    return _serialized(() async {
      final preferences = await _prefs;
      final jobs = _decodeJobs(preferences.getString(_queueKey));
      for (final job in jobs) {
        if (job.id == id) {
          return job;
        }
      }
      return null;
    });
  }

  Future<List<UploadJob>> getAll() {
    return _serialized(() async {
      final preferences = await _prefs;
      return _sortAndFreeze(_decodeJobs(preferences.getString(_queueKey)));
    });
  }

  /// Jobs that still owe the server bytes: queued, uploading, or failed.
  ///
  /// Failed jobs are included because most failures are transient and waiting
  /// on a backoff window; permanent ones are filtered by the queue runner.
  Future<List<UploadJob>> getPending() {
    return _serialized(() async {
      final preferences = await _prefs;
      final jobs = _decodeJobs(preferences.getString(_queueKey));
      final pending = jobs.where((job) {
        return job.status == UploadJobStatus.queued ||
            job.status == UploadJobStatus.uploading ||
            job.status == UploadJobStatus.failed;
      }).toList();
      return _sortAndFreeze(pending);
    });
  }

  /// Removes only queue metadata. The recording file is deliberately untouched.
  Future<void> remove(String id) {
    return _serialized(() async {
      final preferences = await _prefs;
      final jobs = _decodeJobs(preferences.getString(_queueKey));
      jobs.removeWhere((job) => job.id == id);
      await _persist(preferences, jobs);
    });
  }

  List<UploadJob> _decodeJobs(String? encoded) {
    if (encoded == null || encoded.isEmpty) {
      return <UploadJob>[];
    }

    Object? decoded;
    try {
      decoded = jsonDecode(encoded);
    } on FormatException {
      return <UploadJob>[];
    }

    if (decoded is! List) {
      return <UploadJob>[];
    }

    final jobs = <UploadJob>[];
    for (final value in decoded) {
      if (value is! Map) {
        continue;
      }
      try {
        jobs.add(UploadJob.fromJson(Map<String, Object?>.from(value)));
      } on FormatException {
        // A bad record must not strand the remaining uploads.
      } on TypeError {
        // A bad record must not strand the remaining uploads.
      }
    }
    return jobs;
  }

  Future<void> _persist(
    SharedPreferences preferences,
    List<UploadJob> jobs,
  ) async {
    final encoded = jsonEncode(jobs.map((job) => job.toJson()).toList());
    final didSave = await preferences.setString(_queueKey, encoded);
    if (!didSave) {
      throw StateError('Could not persist the upload queue.');
    }
  }

  /// Oldest first: the queue drains in the order recordings were finished.
  List<UploadJob> _sortAndFreeze(List<UploadJob> jobs) {
    jobs.sort((left, right) => left.createdAt.compareTo(right.createdAt));
    return List<UploadJob>.unmodifiable(jobs);
  }

  Future<T> _serialized<T>(Future<T> Function() operation) {
    final completer = Completer<T>();
    _operationTail = _operationTail.then((_) async {
      try {
        completer.complete(await operation());
      } on Object catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });
    return completer.future;
  }
}
