/// Typography tokens shared by the theme and by widgets that declare their own
/// [TextStyle].
///
/// `ThemeData.fontFamily` only reaches the base text theme. Any standalone
/// `TextStyle` — button labels, app bar titles, input hints — falls back to the
/// system font unless it names the family, which reads as a different typeface
/// beside body copy. Those call sites use [brandFamily].
abstract final class AppTypography {
  /// The bundled Pretendard family (see `pubspec.yaml`).
  static const brandFamily = 'Pretendard';
}
