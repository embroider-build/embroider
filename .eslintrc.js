'use strict';

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 2017,
    sourceType: 'module',
  },
  plugins: ['import', 'prettier', '@typescript-eslint'],
  extends: ['prettier', 'prettier/@typescript-eslint'],
  rules: {
    eqeqeq: ['error', 'smart'],
    'no-debugger': 'error',
    'no-new-wrappers': 'error',
    'no-redeclare': 'error',
    'no-unused-labels': 'error',
    'no-var': 'error',

    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          '.eslintrc.js',
          '**/ember-cli-build.js',
          '**/config/ember-try.js',
          'packages/*/tests/**/*.[jt]s',
        ],
      },
    ],

    '@typescript-eslint/class-name-casing': 'error',
    '@typescript-eslint/no-angle-bracket-type-assertion': 'error',
    '@typescript-eslint/no-inferrable-types': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    'prettier/prettier': 'error',
  },
  overrides: [
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
      files: ['types/**/*.ts'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
    // node files
    {
      files: [
        '**/.eslintrc.js',
        '**/.template-lintrc.js',
        '**/ember-cli-build.js',
        '**/index.js',
        '**/testem.js',
        '**/blueprints/*/index.js',
        '**/config/**/*.js',
        '**/tests/dummy/config/**/*.js',
      ],
      excludedFiles: [
        'packages/*/addon/**',
        'packages/*/addon-test-support/**',
        'packages/*/app/**',
        '**/tests/dummy/app/**',
      ],
      parserOptions: {
        sourceType: 'script',
        ecmaVersion: 2015,
      },
      env: {
        browser: false,
        node: true,
      },
      plugins: ['node'],
      rules: Object.assign({}, require('eslint-plugin-node').configs.recommended.rules, {
        // add your custom rules and overrides for node files here
      }),
    },
  ],
};
