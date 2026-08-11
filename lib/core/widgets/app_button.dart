import 'package:flutter/material.dart';
import 'package:premind/core/constants/app_colors.dart';
import 'package:premind/core/constants/app_sizes.dart';

enum AppButtonVariant { primary, secondary, outline, text, destructive }

enum AppButtonSize { small, medium, large }

/// A shared action button with a stable loading state and touch target.
class AppButton extends StatelessWidget {
  const AppButton({
    required this.label,
    required this.onPressed,
    this.leading,
    this.trailing,
    this.variant = AppButtonVariant.primary,
    this.size = AppButtonSize.large,
    this.isLoading = false,
    this.expand = true,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final Widget? leading;
  final Widget? trailing;
  final AppButtonVariant variant;
  final AppButtonSize size;
  final bool isLoading;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final callback = isLoading ? null : onPressed;
    final dimensions = _dimensionsFor(size);
    final sizeStyle = ButtonStyle(
      minimumSize: WidgetStatePropertyAll(Size(0, dimensions.height)),
      padding: WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: dimensions.horizontalPadding),
      ),
      shape: const WidgetStatePropertyAll(StadiumBorder()),
      textStyle: WidgetStatePropertyAll(
        TextStyle(
          fontSize: dimensions.fontSize,
          height: 1.2,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.15,
        ),
      ),
    );
    final child = _ButtonContent(
      label: label,
      leading: leading,
      trailing: trailing,
      isLoading: isLoading,
      loadingColor: switch (variant) {
        AppButtonVariant.primary => Colors.white,
        AppButtonVariant.secondary => AppColors.ink,
        AppButtonVariant.outline => AppColors.brand,
        AppButtonVariant.text => AppColors.muted,
        AppButtonVariant.destructive => AppColors.negative,
      },
    );
    final button = switch (variant) {
      AppButtonVariant.primary => FilledButton(
        onPressed: callback,
        style: sizeStyle,
        child: child,
      ),
      AppButtonVariant.secondary => OutlinedButton(
        onPressed: callback,
        style: sizeStyle.merge(
          OutlinedButton.styleFrom(
            foregroundColor: AppColors.ink,
            backgroundColor: AppColors.secondaryButtonSurface,
            disabledForegroundColor: AppColors.faint,
            disabledBackgroundColor: AppColors.canvasMuted,
            side: const BorderSide(color: AppColors.line),
          ),
        ),
        child: child,
      ),
      AppButtonVariant.outline => OutlinedButton(
        onPressed: callback,
        style: sizeStyle,
        child: child,
      ),
      AppButtonVariant.text => TextButton(
        onPressed: callback,
        style: sizeStyle.merge(
          TextButton.styleFrom(
            foregroundColor: AppColors.muted,
            disabledForegroundColor: AppColors.faint,
            overlayColor: AppColors.inkInteraction,
          ),
        ),
        child: child,
      ),
      AppButtonVariant.destructive => TextButton(
        onPressed: callback,
        style: sizeStyle.merge(
          TextButton.styleFrom(
            foregroundColor: Theme.of(context).colorScheme.error,
            disabledForegroundColor: AppColors.faint,
            overlayColor: AppColors.negativeInteraction,
          ),
        ),
        child: child,
      ),
    };

    return SizedBox(
      width: expand ? double.infinity : null,
      height: dimensions.height,
      child: button,
    );
  }

  _ButtonDimensions _dimensionsFor(AppButtonSize size) => switch (size) {
    AppButtonSize.small => const _ButtonDimensions(
      height: AppSizes.buttonHeightSmall,
      horizontalPadding: AppSizes.space16,
      fontSize: 14,
    ),
    AppButtonSize.medium => const _ButtonDimensions(
      height: AppSizes.buttonHeightMedium,
      horizontalPadding: AppSizes.space20,
      fontSize: 15,
    ),
    AppButtonSize.large => const _ButtonDimensions(
      height: AppSizes.buttonHeightLarge,
      horizontalPadding: AppSizes.space24,
      fontSize: 16,
    ),
  };
}

class _ButtonDimensions {
  const _ButtonDimensions({
    required this.height,
    required this.horizontalPadding,
    required this.fontSize,
  });

  final double height;
  final double horizontalPadding;
  final double fontSize;
}

class _ButtonContent extends StatelessWidget {
  const _ButtonContent({
    required this.label,
    required this.leading,
    required this.trailing,
    required this.isLoading,
    required this.loadingColor,
  });

  final String label;
  final Widget? leading;
  final Widget? trailing;
  final bool isLoading;
  final Color loadingColor;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return SizedBox.square(
        dimension: 20,
        child: CircularProgressIndicator(strokeWidth: 2, color: loadingColor),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (leading != null) ...[
          leading!,
          const SizedBox(width: AppSizes.space8),
        ],
        Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
        if (trailing != null) ...[
          const SizedBox(width: AppSizes.space8),
          trailing!,
        ],
      ],
    );
  }
}
