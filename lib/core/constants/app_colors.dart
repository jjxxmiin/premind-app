import 'package:flutter/material.dart';

/// PREMIND's shared color palette.
///
/// Feature screens should prefer [Theme.of] colors. These constants are useful
/// for semantic colors and places where a build context is not available.
abstract final class AppColors {
  // Canonical palette from premind.co.kr.
  static const canvas = Color(0xFFF5F0E7);
  static const canvasSoft = Color(0xFFFAF6ED);
  static const paper = Color(0xFFFFFFFF);
  static const ink = Color(0xFF1F1813);
  static const inkSoft = Color(0xFF382F28);
  static const muted = Color(0xFF6F665A);
  static const faint = Color(0xFF756B5E);
  static const line = Color(0xFFE7E0D3);
  static const lineStrong = Color(0xFFD6CCBB);
  static const brand = Color(0xFFD25417);
  static const brandHover = Color(0xFFB8460F);
  static const brandSoft = Color(0xFFFBE8D7);
  static const canvasMuted = Color(0xFFECE4D5);

  // Semantic status colors from the official product CSS.
  static const positiveLight = Color(0xFF4FB99F);
  static const positive = Color(0xFF0F8A72);
  static const positiveStrong = Color(0xFF0A6455);
  static const positiveSoft = Color(0xFFE4F1EC);
  static const warning = Color(0xFFB9761A);
  static const warningStrong = Color(0xFF8A5411);
  static const warningSoft = Color(0xFFF9EFDB);
  static const negativeLight = Color(0xFFE2808F);
  static const negative = Color(0xFFB5283A);
  static const negativeStrong = Color(0xFF8F1E2F);
  static const negativeSoft = Color(0xFFF9E8EA);

  // Official translucent surfaces and interaction states.
  static const cardSurface = Color(0x80FFFFFF);
  static const cardBorder = Color(0x73D8D2C6);
  static const inputSurface = Color(0xCCFFFFFF);
  static const secondaryButtonSurface = Color(0xB8FFFFFF);
  static const inkInteraction = Color(0x0D171717);
  static const brandInteraction = Color(0x1AD25417);
  static const brandFocusRing = Color(0x29D25417);
  static const negativeInteraction = Color(0x14F43F5E);

  // CSS-style aliases make palette comparisons straightforward.
  static const pos400 = positiveLight;
  static const pos500 = positive;
  static const pos700 = positiveStrong;
  static const posSoft = positiveSoft;
  static const warning700 = warningStrong;
  static const neg400 = negativeLight;
  static const neg500 = negative;
  static const neg700 = negativeStrong;
  static const negSoft = negativeSoft;

  // Descriptive aliases make intent clear without breaking existing call sites.
  static const warmWhite = canvas;
  static const surfaceWhite = paper;
  static const secondary = muted;
  static const tertiary = faint;
  static const divider = line;
  static const navy = ink;
  static const indigo = brand;
  static const record = negative;
  static const success = positive;

  static const background = canvas;
  static const surface = paper;
  static const primaryText = ink;
  static const secondaryText = muted;
  static const tertiaryText = faint;
  static const primaryNavy = ink;
  static const premindIndigo = brand;
  static const recordingActive = negative;

  static const surfaceMuted = canvasSoft;
  static const indigoLight = brandSoft;

  static const gray50 = canvasSoft;
  static const gray100 = canvasMuted;
  static const gray200 = line;
  static const gray400 = faint;
  static const gray500 = muted;
  static const gray600 = inkSoft;
  static const gray700 = ink;

  static const successContainer = positiveSoft;
  static const warningContainer = warningSoft;
  static const info = brand;
  static const infoContainer = brandSoft;
  static const danger = negative;
  static const dangerContainer = negativeSoft;
}
