const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['dist/**', 'coverage/**', 'legacy_flutter/**'],
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]);

