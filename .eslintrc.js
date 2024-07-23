'use strict';

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module',
  },
  plugins: ['import', 'prettier', '@typescript-eslint'],
  extends: ['prettier'],
  rules: {
    eqeqeq: ['error', 'smart'],
    'no-debugger': 'error',
    'no-new-wrappers': 'error',
    'no-unused-labels': 'error',
    'no-var': 'error',

    'import/no-extraneous-dependencies': ['error', { devDependencies: ['packages/*/tests/**/*.ts'] }],

    'prettier/prettier': 'error',
  },
  overrides: [
    {
      files: ['**/*.ts'],
      parserOptions: {
        project: './tsconfig.json',
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/naming-convention': [
          'error',
          {
            selector: 'typeLike',
            format: ['PascalCase'],
          },
        ],
        '@typescript-eslint/consistent-type-assertions': 'error',
        '@typescript-eslint/no-inferrable-types': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      },
    },
    {
      files: ['packages/**/*.ts'],
      rules: {
        '@typescript-eslint/no-require-imports': 'error',
      },
    },
    {
      files: ['test-packages/**/*.[jt]s'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: ['tests/scenarios/**/*.ts'],
      parserOptions: {
        project: './tests/scenarios/tsconfig.json',
      },
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: ['types/**/*.ts'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: ['tests/**/*'],
      rules: {
        'node/no-missing-require': 'off',
      },
    },
  ],
};
