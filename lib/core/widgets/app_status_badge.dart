import 'package:flutter/material.dart';
import 'package:premind/core/constants/app_colors.dart';
import 'package:premind/core/constants/app_sizes.dart';

enum AppStatusTone { neutral, info, success, warning, danger }

/// Compact semantic status label for upload and AI processing states.
class AppStatusBadge extends StatelessWidget {
  const AppStatusBadge({
    required this.label,
    this.tone = AppStatusTone.neutral,
    this.icon,
    super.key,
  });

  final String label;
  final AppStatusTone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = _colorsFor(tone);
    return Semantics(
      label: '상태: $label',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: BorderRadius.circular(AppSizes.badgeRadius),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppSizes.badgeMinHeight),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSizes.badgeHorizontalPadding,
              vertical: AppSizes.space2,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 13, color: colors.foreground),
                  const SizedBox(width: AppSizes.badgeGap),
                ],
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: colors.foreground,
                    fontSize: 12,
                    height: 1.15,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.12,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  _BadgeColors _colorsFor(AppStatusTone tone) => switch (tone) {
    AppStatusTone.neutral => const _BadgeColors(
      background: AppColors.canvasMuted,
      foreground: AppColors.inkSoft,
    ),
    AppStatusTone.info => const _BadgeColors(
      background: AppColors.brandSoft,
      foreground: AppColors.brandHover,
    ),
    AppStatusTone.success => const _BadgeColors(
      background: AppColors.positiveSoft,
      foreground: AppColors.positiveStrong,
    ),
    AppStatusTone.warning => const _BadgeColors(
      background: AppColors.warningSoft,
      foreground: AppColors.warningStrong,
    ),
    AppStatusTone.danger => const _BadgeColors(
      background: AppColors.negativeSoft,
      foreground: AppColors.negativeStrong,
    ),
  };
}

class _BadgeColors {
  const _BadgeColors({required this.background, required this.foreground});

  final Color background;
  final Color foreground;
}
