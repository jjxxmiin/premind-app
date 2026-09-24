#!/usr/bin/env bash
# Build a signed Android release APK + AAB locally, without EAS.
#
# Usage:
#   scripts/build-android.sh                       # demo-mode build (no server)
#   EXPO_PUBLIC_API_URL=https://api.example.com scripts/build-android.sh
#
# Requirements (one-time, all user-space — no sudo):
#   - JDK 17 at $JAVA_HOME (default ~/.jdks/jdk-17*)
#   - Android SDK at $ANDROID_HOME (default ~/Android/Sdk) with
#     platforms;android-36, build-tools;36.0.0, ndk;27.1.12297006, cmake;3.22.1
#   - A release keystore at ~/.premind/premind-release.keystore with its
#     password in ~/.premind/keystore.password (alias "premind").
#     Keep that directory backed up: Play Store updates must use the same key.
#
# Output: dist/android/premind-<version>-release.apk and .aab
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-$(ls -d "$HOME"/.jdks/jdk-17* | head -1)}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

KEYSTORE="${PREMIND_KEYSTORE:-$HOME/.premind/premind-release.keystore}"
KEY_ALIAS="${PREMIND_KEY_ALIAS:-premind}"
KEY_PASSWORD="${PREMIND_KEYSTORE_PASSWORD:-$(cat "$HOME/.premind/keystore.password")}"
BUILD_TOOLS="$ANDROID_HOME/build-tools/36.0.0"

# The API URL is baked into the JS bundle at build time. An empty value makes
# a demo-only build; .env's localhost default would never be reachable from a
# phone, so it is deliberately not inherited.
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-}"
echo "API URL: '${EXPO_PUBLIC_API_URL:-<demo mode>}'"

# RevenueCat: without a key the billing module is never loaded and the
# subscription screen simply cannot sell, so a keyless build still runs.
# A key starting `test_` is RevenueCat's Test Store — the paywall works end to
# end but no real money moves; the Play key (`goog_...`) is what ships.
export EXPO_PUBLIC_REVENUECAT_ANDROID_KEY="${EXPO_PUBLIC_REVENUECAT_ANDROID_KEY:-}"
export EXPO_PUBLIC_REVENUECAT_IOS_KEY="${EXPO_PUBLIC_REVENUECAT_IOS_KEY:-}"
export EXPO_PUBLIC_REVENUECAT_ENTITLEMENT="${EXPO_PUBLIC_REVENUECAT_ENTITLEMENT:-}"
case "${EXPO_PUBLIC_REVENUECAT_ANDROID_KEY}" in
  "") echo "RevenueCat: <no key, cannot sell>" ;;
  test_*) echo "RevenueCat: TEST store key (no real charges)" ;;
  *) echo "RevenueCat: live key" ;;
esac

# Social sign-in. A provider with no key here shows no button at all
# (src/features/auth/use-social-sign-in.ts), and the server has to have the
# matching id too or it would refuse the token — so both ends are configured
# or neither is offered.
# Read only public social settings from Expo's production env files; the
# helper shell-quotes values and preserves explicit shell overrides.
eval "$(node scripts/load-social-env.mjs)"
SOCIAL=""
[ -n "$EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID" ] && [ -n "$EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB" ] && SOCIAL="$SOCIAL google"
[ -n "$EXPO_PUBLIC_KAKAO_REST_KEY" ] && [ "$EXPO_PUBLIC_ENABLE_KAKAO_AUTH" = "true" ] && SOCIAL="$SOCIAL kakao"
echo "간편 로그인:${SOCIAL:- <none>}"

VERSION="$(node -p "require('./app.json').expo.version")"
OUT="$ROOT/dist/android"
mkdir -p "$OUT"

echo "==> prebuild (android)"
npx expo prebuild --platform android --no-install --clean

echo "==> gradle assembleRelease + bundleRelease"
(
  cd android
  export GRADLE_OPTS="${GRADLE_OPTS:--Dorg.gradle.jvmargs=-Xmx8g}"
  ./gradlew --no-daemon :app:assembleRelease :app:bundleRelease -x lint
)

echo "==> sign"
UNSIGNED_APK="android/app/build/outputs/apk/release/app-release.apk"
UNSIGNED_AAB="android/app/build/outputs/bundle/release/app-release.aab"
"$BUILD_TOOLS/zipalign" -f -p 4 "$UNSIGNED_APK" "$OUT/aligned.apk"
"$BUILD_TOOLS/apksigner" sign --ks "$KEYSTORE" --ks-key-alias "$KEY_ALIAS" \
  --ks-pass "pass:$KEY_PASSWORD" --key-pass "pass:$KEY_PASSWORD" \
  --out "$OUT/premind-$VERSION-release.apk" "$OUT/aligned.apk"
rm -f "$OUT/aligned.apk"
"$BUILD_TOOLS/apksigner" verify --print-certs "$OUT/premind-$VERSION-release.apk" | head -3

AAB_OUT="$OUT/premind-$VERSION-release.aab"
cp "$UNSIGNED_AAB" "$AAB_OUT"
# Gradle has already signed the bundle with the debug keystore (Expo's default
# release signingConfig falls back to it), and jarsigner ADDS a signature
# rather than replacing one. Two signatures means two certificate chains, and
# Play rejects that outright: "인증서 체인이 2개 이상 포함되어 있습니다".
# So every existing top-level signature is removed before ours goes on. Only
# META-INF/*.SF|RSA|DSA at the root are signatures; base/root/META-INF holds
# library version files that must survive.
OLD_SIGS="$(unzip -Z1 "$AAB_OUT" 'META-INF/*' 2>/dev/null \
  | grep -Ei '^META-INF/[^/]+\.(SF|RSA|DSA|EC)$' || true)"
if [ -n "$OLD_SIGS" ]; then
  echo "==> removing $(echo "$OLD_SIGS" | wc -l) pre-existing signature file(s)"
  # shellcheck disable=SC2086
  (cd "$OUT" && zip -q -d "$(basename "$AAB_OUT")" $OLD_SIGS)
fi
"$JAVA_HOME/bin/jarsigner" -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore "$KEYSTORE" -storepass "$KEY_PASSWORD" -keypass "$KEY_PASSWORD" \
  "$AAB_OUT" "$KEY_ALIAS" >/dev/null
"$JAVA_HOME/bin/jarsigner" -verify "$AAB_OUT" | tail -1
# One chain, or Play will refuse the upload.
CHAINS="$(unzip -Z1 "$AAB_OUT" 'META-INF/*' | grep -Eic '^META-INF/[^/]+\.(RSA|DSA|EC)$')"
if [ "$CHAINS" != "1" ]; then
  echo "ERROR: AAB carries $CHAINS certificate chains; Play accepts exactly 1" >&2
  exit 1
fi
echo "AAB certificate chains: $CHAINS"

ls -la "$OUT"
