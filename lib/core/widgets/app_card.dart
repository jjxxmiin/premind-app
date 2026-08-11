import 'package:flutter/material.dart';
import 'package:premind/core/constants/app_colors.dart';
import 'package:premind/core/constants/app_sizes.dart';

/// An optionally tappable, translucent PREMIND content surface.
class AppCard extends StatelessWidget {
  const AppCard({
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(AppSizes.space20),
    this.backgroundColor = AppColors.cardSurface,
    this.borderColor = AppColors.cardBorder,
    this.borderRadius = AppSizes.cardRadius,
    this.semanticLabel,
    super.key,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color? backgroundColor;
  final Color? borderColor;
  final double borderRadius;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(borderRadius);
    final content = Ink(
      decoration: BoxDecoration(
        color: backgroundColor ?? Theme.of(context).colorScheme.surface,
        borderRadius: radius,
        border: borderColor == null ? null : Border.all(color: borderColor!),
      ),
      child: Padding(padding: padding, child: child),
    );

    final card = Material(
      color: Colors.transparent,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: radius),
      child: onTap == null
          ? content
          : InkWell(onTap: onTap, borderRadius: radius, child: content),
    );

    if (semanticLabel == null) {
      return card;
    }
    return Semantics(label: semanticLabel, button: onTap != null, child: card);
  }
}
