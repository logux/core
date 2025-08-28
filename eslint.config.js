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
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/require-await': 'off',
      'n/no-unsupported-features/node-builtins': [
        'error',
        {
          ignores: [
            'navigator',
            'WebSocket',
            'test',
            'test.afterEach',
            'test.beforeEach'
          ]
        }
      ],
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
