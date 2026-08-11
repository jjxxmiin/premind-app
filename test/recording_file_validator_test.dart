import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:premind/features/recording/data/recording_file_validator.dart';

void main() {
  late Directory temporaryDirectory;

  setUp(() async {
    temporaryDirectory = await Directory.systemTemp.createTemp(
      'premind-recording-validator-',
    );
  });

  tearDown(() async {
    if (await temporaryDirectory.exists()) {
      await temporaryDirectory.delete(recursive: true);
    }
  });

  test(
    'accepts a finalized M4A container without reading its payload',
    () async {
      final file = File('${temporaryDirectory.path}/valid.m4a');
      await file.writeAsBytes([
        ..._atom('ftyp', 4),
        ..._atom('free', 500),
        ..._atom('moov', 0),
      ]);

      await expectLater(validateM4aRecording(file.path), completes);
    },
  );

  test('rejects a container that has no finalized movie metadata', () async {
    final file = File('${temporaryDirectory.path}/unfinished.m4a');
    await file.writeAsBytes([..._atom('ftyp', 4), ..._atom('mdat', 500)]);

    await expectLater(
      validateM4aRecording(file.path),
      throwsA(
        isA<RecordingFileValidationException>().having(
          (error) => error.issue,
          'issue',
          RecordingFileIssue.incompleteContainer,
        ),
      ),
    );
  });

  test('distinguishes a missing file from a tiny partial file', () async {
    final missingPath = '${temporaryDirectory.path}/missing.m4a';
    await expectLater(
      validateM4aRecording(missingPath),
      throwsA(
        isA<RecordingFileValidationException>().having(
          (error) => error.issue,
          'issue',
          RecordingFileIssue.missing,
        ),
      ),
    );

    final tinyFile = File('${temporaryDirectory.path}/tiny.m4a');
    await tinyFile.writeAsBytes(_atom('ftyp', 4));
    await expectLater(
      validateM4aRecording(tinyFile.path),
      throwsA(
        isA<RecordingFileValidationException>().having(
          (error) => error.issue,
          'issue',
          RecordingFileIssue.tooSmall,
        ),
      ),
    );
  });
}

List<int> _atom(String type, int payloadLength) {
  final size = 8 + payloadLength;
  return <int>[
    (size >> 24) & 0xff,
    (size >> 16) & 0xff,
    (size >> 8) & 0xff,
    size & 0xff,
    ...type.codeUnits,
    ...List<int>.filled(payloadLength, 0),
  ];
}
