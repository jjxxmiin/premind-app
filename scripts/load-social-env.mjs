// Print only shell-quoted public OAuth settings. Never source arbitrary .env
// shell code or export server secrets. Existing shell settings take precedence.
import { parseProjectEnv } from '@expo/env';
const keys = [
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID', 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB',
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS', 'EXPO_PUBLIC_KAKAO_REST_KEY',
  'EXPO_PUBLIC_ENABLE_KAKAO_AUTH',
];
const { env } = parseProjectEnv(process.cwd(), { mode: 'production', silent: true });
for (const key of keys) {
  const value = process.env[key] ?? env[key] ?? '';
  const quoted = "'" + value.replaceAll("'", "'\\''") + "'";
  process.stdout.write(`export ${key}=${quoted}\n`);
}
