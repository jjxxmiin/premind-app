# Expo SDK 57 workspace

This is an Expo SDK 57 / React Native 0.86 application using Expo Router and TypeScript.

- Use the exact SDK 57 documentation at https://docs.expo.dev/versions/v57.0.0/.
- Treat `../premind` as read-only reference material. Never edit it.
- Treat `legacy_flutter/` as preserved migration history. Do not rewrite it unless explicitly requested.
- Native `android/` and `ios/` directories are generated with Expo CNG and are intentionally ignored.
- Keep product UI aligned with `src/theme/tokens.ts` and Pretendard assets.

- UI/UX follows `docs/design-system.md` (white canvas, ink CTAs, one accent). Compose screens from `src/components/ui`; do not invent per-screen styles.
