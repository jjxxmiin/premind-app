import 'dart:io';

enum RecordingFileIssue { missing, tooSmall, incompleteContainer }

class RecordingFileValidationException implements Exception {
  const RecordingFileValidationException(this.issue);

  final RecordingFileIssue issue;
}

/// Verifies that a local AAC/M4A file has both its file-type and finalized
/// movie metadata atoms without loading the (potentially very large) audio
/// payload into memory.
Future<void> validateM4aRecording(String path) async {
  final file = File(path);
  if (!await file.exists()) {
    throw const RecordingFileValidationException(RecordingFileIssue.missing);
  }

  final length = await file.length();
  if (length < 512) {
    throw const RecordingFileValidationException(RecordingFileIssue.tooSmall);
  }

  final randomAccessFile = await file.open();
  var hasFileType = false;
  var hasMovieMetadata = false;
  try {
    var offset = 0;
    while (offset + 8 <= length) {
      await randomAccessFile.setPosition(offset);
      final header = await randomAccessFile.read(8);
      if (header.length < 8) {
        break;
      }

      var atomSize = _readUint32(header, 0);
      final atomType = String.fromCharCodes(header.sublist(4, 8));
      var headerSize = 8;
      if (atomSize == 1) {
        final extendedSize = await randomAccessFile.read(8);
        if (extendedSize.length < 8) {
          break;
        }
        atomSize = _readUint64(extendedSize, 0);
        headerSize = 16;
      } else if (atomSize == 0) {
        atomSize = length - offset;
      }

      if (atomSize < headerSize || offset + atomSize > length) {
        break;
      }
      hasFileType = hasFileType || atomType == 'ftyp';
      hasMovieMetadata = hasMovieMetadata || atomType == 'moov';
      offset += atomSize;
    }
    if (offset == length && hasFileType && hasMovieMetadata) {
      return;
    }
  } finally {
    await randomAccessFile.close();
  }

  throw const RecordingFileValidationException(
    RecordingFileIssue.incompleteContainer,
  );
}

int _readUint32(List<int> bytes, int offset) {
  return (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
}

int _readUint64(List<int> bytes, int offset) {
  return (_readUint32(bytes, offset) << 32) | _readUint32(bytes, offset + 4);
}
