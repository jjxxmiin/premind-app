import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'core/brand/app_brand_licenses.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  AppBrandLicenses.register();
  runApp(const ProviderScope(child: PremindApp()));
}
