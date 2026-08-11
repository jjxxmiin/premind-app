import 'package:flutter/material.dart';
import 'package:premind/core/constants/app_colors.dart';
import 'package:premind/core/constants/app_sizes.dart';

/// The default light theme for PREMIND.
///
/// The bundled Pretendard family matches the production PREMIND web product
/// and keeps Korean typography consistent across supported platforms.
ThemeData get appTheme {
  const colorScheme = ColorScheme(
    brightness: Brightness.light,
    primary: AppColors.brand,
    onPrimary: Colors.white,
    primaryContainer: AppColors.brandSoft,
    onPrimaryContainer: AppColors.brandHover,
    secondary: AppColors.ink,
    onSecondary: Colors.white,
    secondaryContainer: AppColors.canvasMuted,
    onSecondaryContainer: AppColors.ink,
    tertiary: AppColors.positive,
    onTertiary: Colors.white,
    tertiaryContainer: AppColors.positiveSoft,
    onTertiaryContainer: AppColors.positiveStrong,
    error: AppColors.negative,
    onError: Colors.white,
    errorContainer: AppColors.negativeSoft,
    onErrorContainer: AppColors.negativeStrong,
    surface: AppColors.paper,
    onSurface: AppColors.ink,
    surfaceContainerHighest: AppColors.canvasSoft,
    onSurfaceVariant: AppColors.muted,
    outline: AppColors.lineStrong,
    outlineVariant: AppColors.line,
    shadow: Color(0x14171717),
    scrim: Color(0x661F1813),
    inverseSurface: AppColors.ink,
    onInverseSurface: AppColors.paper,
    inversePrimary: AppColors.brandSoft,
  );

  final baseTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: colorScheme,
    fontFamily: 'Pretendard',
    visualDensity: VisualDensity.standard,
    materialTapTargetSize: MaterialTapTargetSize.padded,
  );

  return baseTheme.copyWith(
    scaffoldBackgroundColor: AppColors.canvas,
    canvasColor: AppColors.canvas,
    splashFactory: InkRipple.splashFactory,
    splashColor: AppColors.brandInteraction,
    highlightColor: Colors.transparent,
    focusColor: AppColors.brandFocusRing,
    hoverColor: AppColors.inkInteraction,
    textTheme: _buildTextTheme(baseTheme.textTheme),
    appBarTheme: const AppBarTheme(
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      toolbarHeight: 60,
      titleSpacing: AppSizes.pagePadding,
      backgroundColor: AppColors.canvas,
      foregroundColor: AppColors.ink,
      surfaceTintColor: Colors.transparent,
      iconTheme: IconThemeData(color: AppColors.ink, size: 24),
      actionsIconTheme: IconThemeData(color: AppColors.ink, size: 24),
      titleTextStyle: TextStyle(
        color: AppColors.ink,
        fontSize: 20,
        height: 1.35,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.3,
      ),
    ),
    cardTheme: const CardThemeData(
      elevation: 0,
      color: AppColors.cardSurface,
      shadowColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppSizes.cardRadius)),
        side: BorderSide(color: AppColors.cardBorder),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.divider,
      thickness: 1,
      space: 1,
    ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: AppColors.inputSurface,
      contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      hintStyle: TextStyle(
        color: AppColors.faint,
        fontSize: 15,
        fontWeight: FontWeight.w400,
      ),
      labelStyle: TextStyle(
        color: AppColors.muted,
        fontSize: 15,
        fontWeight: FontWeight.w500,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppSizes.inputRadius)),
        borderSide: BorderSide(color: AppColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppSizes.inputRadius)),
        borderSide: BorderSide(color: AppColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppSizes.inputRadius)),
        borderSide: BorderSide(color: AppColors.brand, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppSizes.inputRadius)),
        borderSide: BorderSide(color: AppColors.negative),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppSizes.inputRadius)),
        borderSide: BorderSide(color: AppColors.negative, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: ButtonStyle(
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.disabled)
              ? AppColors.faint
              : Colors.white;
        }),
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.disabled)) {
            return AppColors.canvasMuted;
          }
          if (states.contains(WidgetState.pressed) ||
              states.contains(WidgetState.hovered)) {
            return AppColors.brandHover;
          }
          return AppColors.brand;
        }),
        overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        elevation: const WidgetStatePropertyAll(0),
        minimumSize: const WidgetStatePropertyAll(
          Size(0, AppSizes.buttonHeightLarge),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: AppSizes.space24),
        ),
        shape: const WidgetStatePropertyAll(StadiumBorder()),
        textStyle: const WidgetStatePropertyAll(
          TextStyle(
            fontSize: 16,
            height: 1.2,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.15,
          ),
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: ButtonStyle(
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.disabled)
              ? AppColors.faint
              : AppColors.ink;
        }),
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.disabled)) {
            return AppColors.canvasMuted;
          }
          if (states.contains(WidgetState.pressed) ||
              states.contains(WidgetState.hovered)) {
            return AppColors.paper;
          }
          return AppColors.secondaryButtonSurface;
        }),
        overlayColor: const WidgetStatePropertyAll(AppColors.inkInteraction),
        elevation: const WidgetStatePropertyAll(0),
        minimumSize: const WidgetStatePropertyAll(
          Size(0, AppSizes.buttonHeightLarge),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: AppSizes.space24),
        ),
        side: const WidgetStatePropertyAll(BorderSide(color: AppColors.line)),
        shape: const WidgetStatePropertyAll(StadiumBorder()),
        textStyle: const WidgetStatePropertyAll(
          TextStyle(
            fontSize: 16,
            height: 1.2,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.15,
          ),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: ButtonStyle(
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.disabled)) {
            return AppColors.faint;
          }
          if (states.contains(WidgetState.pressed)) {
            return AppColors.brandHover;
          }
          return AppColors.brand;
        }),
        overlayColor: const WidgetStatePropertyAll(AppColors.brandInteraction),
        minimumSize: const WidgetStatePropertyAll(
          Size(0, AppSizes.minimumTouchTarget),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: AppSizes.space12),
        ),
        shape: const WidgetStatePropertyAll(StadiumBorder()),
        textStyle: const WidgetStatePropertyAll(
          TextStyle(fontSize: 15, height: 1.3, fontWeight: FontWeight.w700),
        ),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        foregroundColor: AppColors.ink,
        minimumSize: const Size.square(AppSizes.minimumTouchTarget),
        hoverColor: AppColors.inkInteraction,
        highlightColor: AppColors.brandInteraction,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: AppSizes.navigationBarHeight,
      backgroundColor: AppColors.paper,
      surfaceTintColor: Colors.transparent,
      shadowColor: Colors.transparent,
      indicatorColor: Colors.transparent,
      elevation: 0,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      labelPadding: const EdgeInsets.only(top: 2),
      overlayColor: const WidgetStatePropertyAll(AppColors.brandInteraction),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final isSelected = states.contains(WidgetState.selected);
        return TextStyle(
          color: isSelected ? AppColors.brand : AppColors.faint,
          fontSize: 12,
          height: 1.2,
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final isSelected = states.contains(WidgetState.selected);
        return IconThemeData(
          color: isSelected ? AppColors.brand : AppColors.faint,
          size: 24,
        );
      }),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      elevation: 0,
      modalElevation: 0,
      backgroundColor: AppColors.paper,
      modalBackgroundColor: AppColors.paper,
      modalBarrierColor: Color(0x521F1813),
      shadowColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      showDragHandle: false,
      dragHandleColor: AppColors.line,
      dragHandleSize: Size(40, 4),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppSizes.bottomSheetRadius),
        ),
      ),
    ),
    dialogTheme: const DialogThemeData(
      elevation: 0,
      backgroundColor: AppColors.paper,
      surfaceTintColor: Colors.transparent,
      shadowColor: Color(0x14171717),
      insetPadding: EdgeInsets.symmetric(horizontal: AppSizes.pagePadding),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppSizes.radiusLarge)),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      elevation: 0,
      backgroundColor: AppColors.ink,
      insetPadding: EdgeInsets.fromLTRB(
        AppSizes.pagePadding,
        0,
        AppSizes.pagePadding,
        AppSizes.space16,
      ),
      contentTextStyle: TextStyle(
        color: Colors.white,
        fontSize: 14,
        height: 1.45,
        fontWeight: FontWeight.w500,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppSizes.radiusMedium)),
      ),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: AppColors.brand,
      linearTrackColor: AppColors.line,
      circularTrackColor: AppColors.line,
    ),
  );
}

TextTheme _buildTextTheme(TextTheme base) {
  return base.copyWith(
    displayLarge: base.displayLarge?.copyWith(
      color: AppColors.ink,
      fontSize: 48,
      height: 1.16,
      fontWeight: FontWeight.w700,
      letterSpacing: -1.2,
    ),
    displayMedium: base.displayMedium?.copyWith(
      color: AppColors.ink,
      fontSize: 40,
      height: 1.2,
      fontWeight: FontWeight.w700,
      letterSpacing: -1,
    ),
    displaySmall: base.displaySmall?.copyWith(
      color: AppColors.ink,
      fontSize: 32,
      height: 1.28,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.8,
    ),
    headlineLarge: base.headlineLarge?.copyWith(
      color: AppColors.ink,
      fontSize: 28,
      height: 1.32,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.6,
    ),
    headlineMedium: base.headlineMedium?.copyWith(
      color: AppColors.ink,
      fontSize: 26,
      height: 1.34,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.5,
    ),
    headlineSmall: base.headlineSmall?.copyWith(
      color: AppColors.ink,
      fontSize: 22,
      height: 1.38,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.3,
    ),
    titleLarge: base.titleLarge?.copyWith(
      color: AppColors.ink,
      fontSize: 20,
      height: 1,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.2,
    ),
    titleMedium: base.titleMedium?.copyWith(
      color: AppColors.ink,
      fontSize: 18,
      height: 1.4,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.1,
    ),
    titleSmall: base.titleSmall?.copyWith(
      color: AppColors.ink,
      fontSize: 17,
      height: 1.4,
      fontWeight: FontWeight.w600,
    ),
    bodyLarge: base.bodyLarge?.copyWith(
      color: AppColors.ink,
      fontSize: 16,
      height: 1.55,
      fontWeight: FontWeight.w400,
      letterSpacing: 0,
    ),
    bodyMedium: base.bodyMedium?.copyWith(
      color: AppColors.secondary,
      fontSize: 15,
      height: 1.55,
      fontWeight: FontWeight.w400,
      letterSpacing: 0,
    ),
    bodySmall: base.bodySmall?.copyWith(
      color: AppColors.secondary,
      fontSize: 14,
      height: 1.45,
      fontWeight: FontWeight.w400,
      letterSpacing: 0,
    ),
    labelLarge: base.labelLarge?.copyWith(
      color: AppColors.ink,
      fontSize: 16,
      height: 1.3,
      fontWeight: FontWeight.w600,
      letterSpacing: 0,
    ),
    labelMedium: base.labelMedium?.copyWith(
      color: AppColors.secondary,
      fontSize: 13,
      height: 1.4,
      fontWeight: FontWeight.w500,
      letterSpacing: 0,
    ),
    labelSmall: base.labelSmall?.copyWith(
      color: AppColors.tertiary,
      fontSize: 12,
      height: 1.4,
      fontWeight: FontWeight.w500,
      letterSpacing: 0,
    ),
  );
}

/// Alias retained for call sites that prefer a theme namespace.
abstract final class AppTheme {
  static ThemeData get light => appTheme;
}
