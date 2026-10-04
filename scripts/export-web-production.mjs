import { spawn } from 'node:child_process';
import { parseProjectEnv } from '@expo/env';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const output = path.resolve(process.argv[2] ?? 'dist/web-production');
// Expo owns only generated output: never allow its cleanup to target source
// directories or another repository through the deployment wrapper's argument.
if (output !== path.join(root, 'dist-web') && !output.startsWith(path.join(root, 'dist') + path.sep)) {
  throw new Error('Web output must be dist-web or a directory beneath dist/');
}
if (process.env.PREMIND_WEB_BASE_URL && process.env.PREMIND_WEB_BASE_URL !== '/app') {
  throw new Error('Production OAuth callbacks require the /app base path');
}
if (process.env.PREMIND_STUDENT_API_URL && process.env.PREMIND_STUDENT_API_URL !== 'https://api.premind.co.kr') {
  throw new Error('This production exporter requires https://api.premind.co.kr');
}

// Do not load server secrets or allow .env's localhost API into a release.
const { env: projectEnv } = parseProjectEnv(process.cwd(), { mode: 'production', silent: true });
const publicKeys = ['EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB', 'EXPO_PUBLIC_KAKAO_REST_KEY', 'EXPO_PUBLIC_ENABLE_KAKAO_AUTH'];
const social = Object.fromEntries(publicKeys.map((key) => [key, process.env[key] ?? projectEnv[key] ?? '']));
for (const key of publicKeys) {
  if (!social[key].trim()) throw new Error(`Missing web release setting: ${key}`);
}
if (social.EXPO_PUBLIC_ENABLE_KAKAO_AUTH !== 'true') throw new Error('Kakao must be enabled for this web release');
const executable = fileURLToPath(import.meta.resolve('expo/bin/cli'));
const child = spawn(process.execPath, [executable, 'export', '--platform', 'web', '--clear', '--output-dir', output], {
  stdio: 'inherit',
  env: { ...process.env, ...social, NODE_ENV: 'production', EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_API_URL: 'https://api.premind.co.kr', PREMIND_WEB_BASE_URL: '/app', EXPO_PUBLIC_WEB_BASE_PATH: '/app' },
});
child.on('error', (error) => { console.error(error); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
