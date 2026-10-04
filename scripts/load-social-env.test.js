/** @jest-environment node */
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { beforeEach, afterEach, test, expect } = require('@jest/globals');

const script = require.resolve('./load-social-env.mjs');
let directory;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'premind-release-env-'));
  writeFileSync(path.join(directory, '.env'), [
    'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_fixture',
    'EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_fixture',
    'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT=premium_fixture',
    'EXPO_PUBLIC_KAKAO_REST_KEY=kakao_fixture',
    'SERVER_SECRET=private_fixture',
  ].join('\n'));
});

afterEach(() => {
  unlinkSync(path.join(directory, '.env'));
  rmdirSync(directory);
});

test('loads public billing and sign-in settings without exporting server secrets', () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('EXPO_')));
  const result = spawnSync(process.execPath, [script], { cwd: directory, env, encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("export EXPO_PUBLIC_REVENUECAT_ANDROID_KEY='goog_fixture'");
  expect(result.stdout).toContain("export EXPO_PUBLIC_REVENUECAT_IOS_KEY='appl_fixture'");
  expect(result.stdout).toContain("export EXPO_PUBLIC_REVENUECAT_ENTITLEMENT='premium_fixture'");
  expect(result.stdout).toContain("export EXPO_PUBLIC_KAKAO_REST_KEY='kakao_fixture'");
  expect(result.stdout).not.toContain('private_fixture');
});

test('preserves an explicit build-time billing key override', () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('EXPO_')));
  env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'goog_override';
  const result = spawnSync(process.execPath, [script], { cwd: directory, env, encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("export EXPO_PUBLIC_REVENUECAT_ANDROID_KEY='goog_override'");
});
