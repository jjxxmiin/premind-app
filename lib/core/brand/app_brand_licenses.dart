import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:premind/core/constants/app_assets.dart';

/// Registers licenses for assets bundled by the PREMIND brand foundation.
///
/// Call [register] once before `runApp` so Pretendard appears in Flutter's
/// licenses page. Repeated calls are safe.
abstract final class AppBrandLicenses {
  static bool _isRegistered = false;

  static void register() {
    if (_isRegistered) {
      return;
    }
    _isRegistered = true;

    LicenseRegistry.addLicense(() async* {
      final license = await rootBundle.loadString(AppAssets.pretendardLicense);
      yield LicenseEntryWithLineBreaks(const ['Pretendard'], license);
    });
  }
}
