import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:premind/features/auth/data/auth_token_store.dart';
import 'package:premind/features/upload/data/upload_driver.dart';
import 'package:premind/features/upload/data/upload_queue_repository.dart';
import 'package:premind/features/upload/domain/upload_job.dart';
import 'package:shared_preferences/shared_preferences.dart';
// ignore: depend_on_referenced_packages
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
// ignore: depend_on_referenced_packages
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

void main() {
  late AuthTokenStore tokenStore;
  late UploadQueueRepository queue;
  late int drains;

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    tokenStore = AuthTokenStore();
    queue = UploadQueueRepository();
    drains = 0;
  });

  Future<void> signIn() => tokenStore.save(
    AuthTokens(
      accessToken: 'access',
      accessTokenExpiresAt: DateTime.now().add(const Duration(hours: 1)),
      refreshToken: 'refresh',
    ),
  );

  UploadDriver buildDriver({
    Completer<void>? gate,
    bool throws = false,
    DateTime Function()? now,
  }) {
    final driver = UploadDriver(
      processQueue: () async {
        drains++;
        if (gate != null) {
          await gate.future;
        }
        if (throws) {
          throw StateError('upload exploded');
        }
      },
      queueRepository: queue,
      tokenStore: tokenStore,
      now: now,
    );
    addTearDown(driver.dispose);
    return driver;
  }

  test('does not run the queue when the device holds no API tokens', () async {
    await queue.enqueue(_job(id: 'a'));
    final driver = buildDriver();

    await driver.drain();

    // The development login stores a session but no tokens; draining without
    // them would burn every queued recording as a terminal failure.
    expect(drains, 0);
    expect((await queue.getPending()).single.status, UploadJobStatus.queued);
  });

  test('runs the queue once signed in', () async {
    await signIn();
    await queue.enqueue(_job(id: 'a'));
    final driver = buildDriver();

    await driver.drain();

    expect(drains, 1);
  });

  test('overlapping drains collapse into a single pass', () async {
    await signIn();
    final gate = Completer<void>();
    final driver = buildDriver(gate: gate);

    final first = driver.drain();
    final second = driver.drain();
    expect(driver.isDraining, isTrue);
    gate.complete();
    await Future.wait(<Future<void>>[first, second]);

    expect(drains, 1);
  });

  test('an upload failure never escapes the driver', () async {
    await signIn();
    final driver = buildDriver(throws: true);

    await expectLater(driver.drain(), completes);
    expect(driver.isDraining, isFalse);
  });

  test('a backoff that is still in the future does not fire early', () async {
    await signIn();
    final now = DateTime.utc(2026, 8, 20, 12);
    await queue.enqueue(
      _job(id: 'later').copyWith(
        status: UploadJobStatus.failed,
        nextAttemptAt: now.add(const Duration(minutes: 5)),
      ),
    );
    final driver = buildDriver(now: () => now);

    await driver.drain();
    expect(drains, 1);

    await Future<void>.delayed(const Duration(milliseconds: 80));
    expect(drains, 1, reason: 'the retry is five minutes out');
  });

  test('an elapsed backoff retries without another trigger', () async {
    await signIn();
    final now = DateTime.utc(2026, 8, 20, 12);
    await queue.enqueue(
      _job(id: 'due').copyWith(
        status: UploadJobStatus.failed,
        // Already elapsed, so the driver clamps to its one-second floor.
        nextAttemptAt: now.subtract(const Duration(minutes: 1)),
      ),
    );
    final driver = buildDriver(now: () => now);

    await driver.drain();
    expect(drains, 1);

    await Future<void>.delayed(const Duration(milliseconds: 1300));
    expect(drains, greaterThan(1), reason: 'the retry timer fired on its own');
  });

  test('a queue with nothing pending arms no timer', () async {
    await signIn();
    final driver = buildDriver();

    await driver.drain();
    expect(drains, 1);

    await Future<void>.delayed(const Duration(milliseconds: 1300));
    expect(drains, 1);
  });

  test('disposing stops further drains', () async {
    await signIn();
    final driver = buildDriver();

    driver.dispose();
    await driver.drain();

    expect(drains, 0);
  });
}

UploadJob _job({required String id}) {
  final now = DateTime.utc(2026, 8, 20);
  return UploadJob(
    id: id,
    lectureId: 'lecture-$id',
    filePath: '/tmp/$id.m4a',
    title: '강의 $id',
    durationMs: 1000,
    totalBytes: 2048,
    uploadedChunks: const <int>[],
    status: UploadJobStatus.queued,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  );
}
