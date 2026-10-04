import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const executable = fileURLToPath(import.meta.resolve('expo/bin/cli'));
const child = spawn(process.execPath, [executable, 'export', '--platform', 'web', '--clear'], {
  env: {
    ...process.env,
    // A same-origin base keeps tunneled previews functional. The preview
    // server forwards /api to PREMIND_API_TARGET without browser CORS.
    EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_API_URL: '/',
  },
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Expo export stopped by ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
