import 'dart:async';
import 'dart:convert';

import 'package:premind/features/recording/domain/recording_session.dart';
import 'package:shared_preferences/shared_preferences.dart';

class RecordingSessionRepository {
  RecordingSessionRepository({
    Future<SharedPreferences> Function()? preferencesFactory,
  }) : _preferencesFactory =
           preferencesFactory ?? SharedPreferences.getInstance;

  static const _sessionsKey = 'premind.recording_sessions.v1';
  static Future<void> _operationTail = Future<void>.value();

  final Future<SharedPreferences> Function() _preferencesFactory;
  Future<SharedPreferences>? _preferences;

  Future<SharedPreferences> get _prefs =>
      _preferences ??= _preferencesFactory();

  Future<void> save(RecordingSession session) {
    return _serialized(() async {
      final preferences = await _prefs;
      final sessions = _decodeSessions(preferences.getString(_sessionsKey));
      final index = sessions.indexWhere((item) => item.id == session.id);
      if (index == -1) {
        sessions.add(session);
      } else {
        sessions[index] = session;
      }
      await _persist(preferences, sessions);
    });
  }

  Future<RecordingSession?> get(String id) {
    return _serialized(() async {
      final preferences = await _prefs;
      final sessions = _decodeSessions(preferences.getString(_sessionsKey));
      for (final session in sessions) {
        if (session.id == id) {
          return session;
        }
      }
      return null;
    });
  }

  Future<List<RecordingSession>> getAll() {
    return _serialized(() async {
      final preferences = await _prefs;
      return _sortAndFreeze(
        _decodeSessions(preferences.getString(_sessionsKey)),
      );
    });
  }

  Future<List<RecordingSession>> getRecoverable() {
    return _serialized(() async {
      final preferences = await _prefs;
      final sessions = _decodeSessions(preferences.getString(_sessionsKey));
      final recoverable = sessions.where((session) {
        final recordingNeedsRecovery =
            session.status == RecordingSessionStatus.recording ||
            session.status == RecordingSessionStatus.paused ||
            session.status == RecordingSessionStatus.failed;
        final uploadNeedsRecovery =
            session.uploadStatus != UploadStatus.completed;
        return recordingNeedsRecovery || uploadNeedsRecovery;
      }).toList();
      return _sortAndFreeze(recoverable);
    });
  }

  /// Removes only session metadata. The audio file is deliberately untouched.
  Future<void> remove(String id) {
    return _serialized(() async {
      final preferences = await _prefs;
      final sessions = _decodeSessions(preferences.getString(_sessionsKey));
      sessions.removeWhere((session) => session.id == id);
      await _persist(preferences, sessions);
    });
  }

  List<RecordingSession> _decodeSessions(String? encoded) {
    if (encoded == null || encoded.isEmpty) {
      return <RecordingSession>[];
    }

    Object? decoded;
    try {
      decoded = jsonDecode(encoded);
    } on FormatException {
      return <RecordingSession>[];
    }

    if (decoded is! List) {
      return <RecordingSession>[];
    }

    final sessions = <RecordingSession>[];
    for (final value in decoded) {
      if (value is! Map) {
        continue;
      }
      try {
        sessions.add(
          RecordingSession.fromJson(Map<String, Object?>.from(value)),
        );
      } on FormatException {
        // A bad record must not prevent recovery of the remaining sessions.
      } on TypeError {
        // A bad record must not prevent recovery of the remaining sessions.
      }
    }
    return sessions;
  }

  Future<void> _persist(
    SharedPreferences preferences,
    List<RecordingSession> sessions,
  ) async {
    final encoded = jsonEncode(
      sessions.map((session) => session.toJson()).toList(),
    );
    final didSave = await preferences.setString(_sessionsKey, encoded);
    if (!didSave) {
      throw StateError('Could not persist recording sessions.');
    }
  }

  List<RecordingSession> _sortAndFreeze(List<RecordingSession> sessions) {
    sessions.sort((left, right) => right.startedAt.compareTo(left.startedAt));
    return List<RecordingSession>.unmodifiable(sessions);
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
