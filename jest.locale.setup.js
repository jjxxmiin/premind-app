// Native tests read Intl rather than navigator.language. Pin the app's locale
// for every test, independent of the host language or a previous language switch.
const { resetLocaleForTests } = require('./src/lib/i18n/locale-store');

beforeEach(() => {
  resetLocaleForTests('ko');
});
