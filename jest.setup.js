// AsyncStorage and SecureStore are native modules: without these mocks any test
// that touches the storage boundary — now including everything that reaches it
// through the session manager — fails at import time rather than on an
// assertion.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    isAvailableAsync: jest.fn(async () => true),
    getItemAsync: jest.fn(async (key) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
  };
});

// The app follows the device language when none was chosen (src/lib/i18n/locale-store.ts).
// jsdom reports 'en-US', which would turn web tests' screens English; tests assert the
// Korean screens, so pin the browser language to Korean.
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'language', { configurable: true, value: 'ko-KR' });
}
