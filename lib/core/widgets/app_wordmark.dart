import 'package:flutter/material.dart';
import 'package:premind/core/constants/app_assets.dart';

/// The approved PREMIND wordmark at its original canvas aspect ratio.
class AppWordmark extends StatelessWidget {
  const AppWordmark({this.height = 24, super.key}) : assert(height > 0);

  final double height;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      image: true,
      label: 'PREMIND 로고',
      child: ExcludeSemantics(
        child: SizedBox(
          width: height * AppAssets.wordmarkAspectRatio,
          height: height,
          child: Image.asset(
            AppAssets.wordmark,
            fit: BoxFit.contain,
            filterQuality: FilterQuality.high,
          ),
        ),
      ),
    );
  }
}
