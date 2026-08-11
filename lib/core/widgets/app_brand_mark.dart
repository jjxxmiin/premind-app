import 'package:flutter/material.dart';
import 'package:premind/core/constants/app_assets.dart';

/// The approved square PREMIND icon for compact brand placements.
class AppBrandMark extends StatelessWidget {
  const AppBrandMark({this.size = 64, super.key}) : assert(size > 0);

  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      image: true,
      label: 'PREMIND 로고',
      child: ExcludeSemantics(
        child: SizedBox.square(
          dimension: size,
          child: Image.asset(
            AppAssets.brandIcon,
            fit: BoxFit.contain,
            filterQuality: FilterQuality.high,
          ),
        ),
      ),
    );
  }
}
