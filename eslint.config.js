import loguxTsConfig from '@logux/eslint-config/ts'

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: ['**/errors.ts', 'coverage']
  },
  ...loguxTsConfig,
  {
    languageOptions: {
      globals: {
        WebSocket: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-invalid-this': 'off'
    }
  },
  {
    files: ['server-connection/*.ts', 'ws-connection/*.ts'],
    rules: {
      'import/order': 'off'
    }
  }
]
