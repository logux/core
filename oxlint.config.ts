import loguxOxlintConfig from '@logux/oxc-configs/lint'
import { defineConfig } from 'oxlint'

export default defineConfig({
  extends: [loguxOxlintConfig],
  ignorePatterns: ['*/errors.ts'],
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
      rules: {
        'typescript/no-unnecessary-type-parameters': 'off',
        'typescript/require-await': 'off'
      }
    }
  ],
  rules: {
    'no-new': 'off',
    'no-underscore-dangle': 'off',
    'import/no-named-as-default': 'off',
    'oxc/no-this-in-exported-function': 'off',
    'typescript/no-extraneous-class': 'off',
    'typescript/no-floating-promises': 'off',
    'unicorn/prefer-add-event-listener': 'off'
  }
})
