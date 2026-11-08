import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // 設定檔在 Node 執行，不是瀏覽器
    files: ['vite.config.js', 'vitest.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // 測試在 Node（jsdom）執行，可以用 process；不需要 Fast Refresh
    files: ['src/test/**', '**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
