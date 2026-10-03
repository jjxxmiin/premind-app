# Social sign-in assets

These files are unmodified provider artwork and must only be used for their
respective sign-in buttons.

- `google-g.png`: Google Identity branding asset from
  <https://developers.google.com/identity/branding-guidelines>
  (legacy raster; no longer used by the app).
- `kakao-login-medium-wide.png`: Kakao Login button asset from
  <https://developers.kakao.com/docs/latest/ko/kakaologin/design-guide>
  (legacy 300×45 raster; no longer used by the app because text blurred on
  high-density displays).

Both buttons in `src/components/SocialSignInButtons.tsx` use the shared UI
Button, real localized text and `react-native-svg` symbols, not PNGs. Google
uses the vector paths supplied by the official HTML button configurator linked
from its branding guide. Kakao uses the unmodified symbol path from:
<https://developers.kakao.com/tool/images/resource/preview/login-complete-ko.svg>.
Its original viewBox bounds preserve the symbol's proportions. The yellow
container (#FEE500), black symbol, and 85% black label follow the design guide;
the label is localized as “카카오 로그인” / “Login with Kakao”. No text is
embedded in a low-resolution image.

Provider names and marks remain the property of their respective owners. Keep
the surrounding UI compliant with the current provider branding guides when
these assets are updated.
