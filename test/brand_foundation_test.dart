import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:premind/app/theme.dart';
import 'package:premind/core/constants/app_assets.dart';
import 'package:premind/core/constants/app_colors.dart';
import 'package:premind/core/widgets/app_brand_mark.dart';
import 'package:premind/core/widgets/app_wordmark.dart';

void main() {
  group('official PREMIND palette', () {
    test('uses the canonical product color tokens', () {
      expect(AppColors.canvas, const Color(0xFFF5F0E7));
      expect(AppColors.canvasSoft, const Color(0xFFFAF6ED));
      expect(AppColors.paper, const Color(0xFFFFFFFF));
      expect(AppColors.ink, const Color(0xFF1F1813));
      expect(AppColors.inkSoft, const Color(0xFF382F28));
      expect(AppColors.muted, const Color(0xFF6F665A));
      expect(AppColors.faint, const Color(0xFF756B5E));
      expect(AppColors.line, const Color(0xFFE7E0D3));
      expect(AppColors.lineStrong, const Color(0xFFD6CCBB));
      expect(AppColors.brand, const Color(0xFFD25417));
      expect(AppColors.brandHover, const Color(0xFFB8460F));
      expect(AppColors.brandSoft, const Color(0xFFFBE8D7));
      expect(AppColors.canvasMuted, const Color(0xFFECE4D5));

      expect(AppColors.positiveLight, const Color(0xFF4FB99F));
      expect(AppColors.positive, const Color(0xFF0F8A72));
      expect(AppColors.positiveStrong, const Color(0xFF0A6455));
      expect(AppColors.positiveSoft, const Color(0xFFE4F1EC));
      expect(AppColors.warning, const Color(0xFFB9761A));
      expect(AppColors.warningStrong, const Color(0xFF8A5411));
      expect(AppColors.warningSoft, const Color(0xFFF9EFDB));
      expect(AppColors.negativeLight, const Color(0xFFE2808F));
      expect(AppColors.negative, const Color(0xFFB5283A));
      expect(AppColors.negativeStrong, const Color(0xFF8F1E2F));
      expect(AppColors.negativeSoft, const Color(0xFFF9E8EA));

      expect(AppColors.cardSurface, const Color(0x80FFFFFF));
      expect(AppColors.cardBorder, const Color(0x73D8D2C6));
      expect(AppColors.inputSurface, const Color(0xCCFFFFFF));
      expect(AppColors.secondaryButtonSurface, const Color(0xB8FFFFFF));
      expect(AppColors.inkInteraction, const Color(0x0D171717));
      expect(AppColors.brandInteraction, const Color(0x1AD25417));
      expect(AppColors.brandFocusRing, const Color(0x29D25417));
    });
  });

  group('official PREMIND theme', () {
    test('maps the product palette into the Material color scheme', () {
      final theme = appTheme;
      final scheme = theme.colorScheme;

      expect(scheme.primary, AppColors.brand);
      expect(scheme.onPrimary, const Color(0xFFFFFFFF));
      expect(scheme.primaryContainer, AppColors.brandSoft);
      expect(scheme.onPrimaryContainer, AppColors.brandHover);
      expect(scheme.secondary, AppColors.ink);
      expect(scheme.onSecondary, const Color(0xFFFFFFFF));
      expect(scheme.secondaryContainer, AppColors.canvasMuted);
      expect(scheme.onSecondaryContainer, AppColors.ink);
      expect(scheme.tertiary, AppColors.positive);
      expect(scheme.onTertiary, const Color(0xFFFFFFFF));
      expect(scheme.tertiaryContainer, AppColors.positiveSoft);
      expect(scheme.onTertiaryContainer, AppColors.positiveStrong);
      expect(scheme.error, AppColors.negative);
      expect(scheme.onError, const Color(0xFFFFFFFF));
      expect(scheme.errorContainer, AppColors.negativeSoft);
      expect(scheme.onErrorContainer, AppColors.negativeStrong);
      expect(scheme.surface, AppColors.paper);
      expect(scheme.onSurface, AppColors.ink);
      expect(scheme.surfaceContainerHighest, AppColors.canvasSoft);
      expect(scheme.onSurfaceVariant, AppColors.muted);
      expect(scheme.outline, AppColors.lineStrong);
      expect(scheme.outlineVariant, AppColors.line);
      expect(scheme.inverseSurface, AppColors.ink);
      expect(scheme.onInverseSurface, AppColors.paper);
      expect(scheme.inversePrimary, AppColors.brandSoft);
      expect(theme.scaffoldBackgroundColor, AppColors.canvas);
      expect(theme.canvasColor, AppColors.canvas);
      expect(theme.focusColor, AppColors.brandFocusRing);
      expect(theme.splashColor, AppColors.brandInteraction);
    });

    test('uses Pretendard throughout the text theme', () {
      final textTheme = appTheme.textTheme;

      expect(textTheme.displayLarge?.fontFamily, 'Pretendard');
      expect(textTheme.headlineMedium?.fontFamily, 'Pretendard');
      expect(textTheme.titleLarge?.fontFamily, 'Pretendard');
      expect(textTheme.bodyMedium?.fontFamily, 'Pretendard');
      expect(textTheme.labelLarge?.fontFamily, 'Pretendard');
    });

    test('resolves filled button and navigation selection to brand states', () {
      final theme = appTheme;
      final filledStyle = theme.filledButtonTheme.style!;
      final filledBackground = filledStyle.backgroundColor!;
      final filledForeground = filledStyle.foregroundColor!;

      expect(filledBackground.resolve(const <WidgetState>{}), AppColors.brand);
      expect(
        filledBackground.resolve(const <WidgetState>{WidgetState.hovered}),
        AppColors.brandHover,
      );
      expect(
        filledBackground.resolve(const <WidgetState>{WidgetState.pressed}),
        AppColors.brandHover,
      );
      expect(
        filledBackground.resolve(const <WidgetState>{WidgetState.disabled}),
        AppColors.canvasMuted,
      );
      expect(
        filledForeground.resolve(const <WidgetState>{}),
        const Color(0xFFFFFFFF),
      );

      final navigationTheme = theme.navigationBarTheme;
      final selected = const <WidgetState>{WidgetState.selected};
      expect(
        navigationTheme.iconTheme!.resolve(selected)?.color,
        AppColors.brand,
      );
      expect(
        navigationTheme.labelTextStyle!.resolve(selected)?.color,
        AppColors.brand,
      );
      expect(
        navigationTheme.iconTheme!.resolve(const <WidgetState>{})?.color,
        AppColors.faint,
      );
      expect(
        navigationTheme.labelTextStyle!.resolve(const <WidgetState>{})?.color,
        AppColors.faint,
      );
    });
  });

  test('every themed component text style uses the brand typeface', () {
    // ThemeData.fontFamily only reaches the base text theme; component styles
    // declared as standalone TextStyles silently fall back to the system font,
    // which ships button and app bar text in the wrong typeface.
    final theme = appTheme;
    final styles = <String, TextStyle?>{
      'appBar.title': theme.appBarTheme.titleTextStyle,
      'input.hint': theme.inputDecorationTheme.hintStyle,
      'input.label': theme.inputDecorationTheme.labelStyle,
      'snackBar.content': theme.snackBarTheme.contentTextStyle,
      'filledButton': theme.filledButtonTheme.style?.textStyle?.resolve(
        <WidgetState>{},
      ),
      'outlinedButton': theme.outlinedButtonTheme.style?.textStyle?.resolve(
        <WidgetState>{},
      ),
      'textButton': theme.textButtonTheme.style?.textStyle?.resolve(
        <WidgetState>{},
      ),
      'navigationBar.label': theme.navigationBarTheme.labelTextStyle?.resolve(
        <WidgetState>{},
      ),
      'navigationBar.label(selected)': theme.navigationBarTheme.labelTextStyle
          ?.resolve(<WidgetState>{WidgetState.selected}),
    };

    styles.forEach((name, style) {
      expect(style, isNotNull, reason: '$name has no themed style');
      expect(
        style!.fontFamily,
        'Pretendard',
        reason: '$name would render in the system font',
      );
    });
  });

  testWidgets(
    'wordmark and brand mark load official assets with semantics at compact widths',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final semantics = tester.ensureSemantics();

      for (final width in <double>[390, 320]) {
        await _pumpBrandWidget(
          tester,
          viewportWidth: width,
          child: const AppWordmark(height: 32),
        );

        expect(find.byType(AppWordmark), findsOneWidget);
        expect(find.bySemanticsLabel('PREMIND 로고'), findsOneWidget);
        expect(tester.getSize(find.byType(AppWordmark)).width, lessThan(width));
        _expectAssetImage(tester, AppAssets.wordmark);
        expect(tester.takeException(), isNull);

        await _pumpBrandWidget(
          tester,
          viewportWidth: width,
          child: const AppBrandMark(size: 96),
        );

        expect(find.byType(AppBrandMark), findsOneWidget);
        expect(find.bySemanticsLabel('PREMIND 로고'), findsOneWidget);
        expect(
          tester.getSize(find.byType(AppBrandMark)).width,
          lessThan(width),
        );
        _expectAssetImage(tester, AppAssets.brandIcon);
        expect(tester.takeException(), isNull);
      }

      semantics.dispose();
    },
  );
}

Future<void> _pumpBrandWidget(
  WidgetTester tester, {
  required double viewportWidth,
  required Widget child,
}) async {
  tester.view.physicalSize = Size(viewportWidth, 640);
  await tester.pumpWidget(
    MaterialApp(
      theme: appTheme,
      home: Scaffold(body: Center(child: child)),
    ),
  );
  await tester.pumpAndSettle();
}

void _expectAssetImage(WidgetTester tester, String expectedAsset) {
  final image = tester.widget<Image>(find.byType(Image));
  expect(image.image, isA<AssetImage>());
  expect((image.image as AssetImage).assetName, expectedAsset);
}
