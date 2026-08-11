import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Flutter brand assets', () {
    test('wordmark and icon PNG headers retain their approved dimensions', () {
      final wordmark = _readPng('assets/brand/premind_wordmark.png');
      expect(wordmark.width, 1315);
      expect(wordmark.height, 341);
      expect(wordmark.bitDepth, 8);

      final icon = _readPng('assets/brand/premind_icon.png');
      expect(icon.width, 512);
      expect(icon.height, 512);
      expect(icon.bitDepth, 8);
    });
  });

  group('iOS brand assets', () {
    test(
      'marketing icon is a 1024px opaque PNG referenced by Contents.json',
      () {
        const relativePath =
            'ios/Runner/Assets.xcassets/AppIcon.appiconset/'
            'Icon-App-1024x1024@1x.png';
        final icon = _readPng(relativePath);
        expect(icon.width, 1024);
        expect(icon.height, 1024);
        expect(icon.bitDepth, 8);
        expect(
          icon.colorType,
          2,
          reason:
              'The App Store icon must be truecolor without an alpha channel.',
        );

        final contents = _readJson(
          'ios/Runner/Assets.xcassets/AppIcon.appiconset/Contents.json',
        );
        final images = (contents['images']! as List<dynamic>)
            .cast<Map<String, dynamic>>();
        final marketingIcon = images.singleWhere(
          (image) => image['idiom'] == 'ios-marketing',
        );
        expect(marketingIcon['size'], '1024x1024');
        expect(marketingIcon['scale'], '1x');
        expect(marketingIcon['filename'], 'Icon-App-1024x1024@1x.png');
      },
    );

    test('LaunchImage variants are branded, non-placeholder assets', () {
      const expected = <String, ({int width, int height, int minimumBytes})>{
        'LaunchImage.png': (width: 168, height: 44, minimumBytes: 3000),
        'LaunchImage@2x.png': (width: 336, height: 88, minimumBytes: 6000),
        'LaunchImage@3x.png': (width: 504, height: 132, minimumBytes: 9000),
      };

      for (final entry in expected.entries) {
        final path =
            'ios/Runner/Assets.xcassets/LaunchImage.imageset/${entry.key}';
        final image = _readPng(path);
        expect(image.width, entry.value.width, reason: entry.key);
        expect(image.height, entry.value.height, reason: entry.key);
        expect(
          _file(path).lengthSync(),
          greaterThan(entry.value.minimumBytes),
          reason: '${entry.key} must not regress to Flutter\'s placeholder.',
        );
      }

      final contents = _readJson(
        'ios/Runner/Assets.xcassets/LaunchImage.imageset/Contents.json',
      );
      final filenames = (contents['images']! as List<dynamic>)
          .cast<Map<String, dynamic>>()
          .map((image) => image['filename'])
          .toSet();
      expect(filenames, expected.keys.toSet());
    });
  });

  group('Android brand assets', () {
    test('legacy launcher icons retain the standard density dimensions', () {
      const dimensions = <String, int>{
        'mdpi': 48,
        'hdpi': 72,
        'xhdpi': 96,
        'xxhdpi': 144,
        'xxxhdpi': 192,
      };

      for (final entry in dimensions.entries) {
        for (final filename in <String>[
          'ic_launcher.png',
          'ic_launcher_round.png',
        ]) {
          final path = 'android/app/src/main/res/mipmap-${entry.key}/$filename';
          final image = _readPng(path);
          expect(image.width, entry.value, reason: path);
          expect(image.height, entry.value, reason: path);
        }
      }
    });

    test('launch wordmarks retain branded density variants', () {
      const dimensions = <String, ({int width, int height})>{
        'mdpi': (width: 168, height: 44),
        'hdpi': (width: 252, height: 65),
        'xhdpi': (width: 336, height: 87),
        'xxhdpi': (width: 504, height: 131),
        'xxxhdpi': (width: 672, height: 174),
      };

      for (final entry in dimensions.entries) {
        final path =
            'android/app/src/main/res/drawable-${entry.key}/'
            'launch_wordmark.png';
        final image = _readPng(path);
        expect(image.width, entry.value.width, reason: path);
        expect(image.height, entry.value.height, reason: path);
        expect(
          _file(path).lengthSync(),
          greaterThan(3000),
          reason: '$path must not be a placeholder image.',
        );
      }
    });

    test('resource XML points to the official brand colors and artwork', () {
      final colors = _readText('android/app/src/main/res/values/colors.xml');
      expect(colors, contains('<color name="premind_canvas">#F5F0E7</color>'));
      expect(
        colors,
        contains('<color name="premind_brand_soft">#FBE8D7</color>'),
      );

      for (final path in <String>[
        'android/app/src/main/res/drawable/launch_background.xml',
        'android/app/src/main/res/drawable-v21/launch_background.xml',
      ]) {
        final xml = _readText(path);
        expect(xml, contains('@color/premind_brand_soft'), reason: path);
        expect(xml, contains('@drawable/launch_wordmark'), reason: path);
      }

      for (final path in <String>[
        'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
        'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml',
      ]) {
        final xml = _readText(path);
        expect(xml, contains('@color/premind_brand_soft'), reason: path);
        expect(xml, contains('@drawable/ic_launcher_foreground'), reason: path);
      }

      for (final path in <String>[
        'android/app/src/main/res/values-v31/styles.xml',
        'android/app/src/main/res/values-night-v31/styles.xml',
      ]) {
        final xml = _readText(path);
        expect(
          xml,
          contains(
            '<item name="android:windowSplashScreenBackground">'
            '@color/premind_brand_soft</item>',
          ),
          reason: path,
        );
        expect(
          xml,
          contains(
            '<item name="android:windowSplashScreenAnimatedIcon">'
            '@mipmap/ic_launcher</item>',
          ),
          reason: path,
        );
      }
    });
  });

  test('iOS launch storyboard references the branded image and color', () {
    final storyboard = _readText(
      'ios/Runner/Base.lproj/LaunchScreen.storyboard',
    );
    expect(storyboard, contains('image="LaunchImage"'));
    expect(
      storyboard,
      contains('<image name="LaunchImage" width="168" height="44"/>'),
    );
    expect(storyboard, contains('red="0.9843137255"'));
    expect(storyboard, contains('green="0.9098039216"'));
    expect(storyboard, contains('blue="0.8431372549"'));
  });
}

Map<String, dynamic> _readJson(String relativePath) {
  return jsonDecode(_readText(relativePath)) as Map<String, dynamic>;
}

String _readText(String relativePath) => _file(relativePath).readAsStringSync();

File _file(String relativePath) {
  return File('${Directory.current.path}/$relativePath');
}

_PngInfo _readPng(String relativePath) {
  final bytes = _file(relativePath).readAsBytesSync();
  expect(bytes.length, greaterThanOrEqualTo(33), reason: relativePath);
  expect(
    bytes.sublist(0, 8),
    orderedEquals(const <int>[137, 80, 78, 71, 13, 10, 26, 10]),
    reason: relativePath,
  );
  expect(
    String.fromCharCodes(bytes.sublist(12, 16)),
    'IHDR',
    reason: relativePath,
  );

  final header = ByteData.sublistView(bytes);
  expect(header.getUint32(8, Endian.big), 13, reason: relativePath);
  return _PngInfo(
    width: header.getUint32(16, Endian.big),
    height: header.getUint32(20, Endian.big),
    bitDepth: header.getUint8(24),
    colorType: header.getUint8(25),
  );
}

class _PngInfo {
  const _PngInfo({
    required this.width,
    required this.height,
    required this.bitDepth,
    required this.colorType,
  });

  final int width;
  final int height;
  final int bitDepth;
  final int colorType;
}
