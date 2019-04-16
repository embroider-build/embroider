'use strict';
const path = require('path');

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
          //'.eslintrc.js',
          'packages/*/ember-cli-build.js',
          'packages/*/config/ember-try.js',
          'packages/*/tests/**/*.[jt]s',
          'test-packages/**/*.[jt]s',
          'types/**/*.ts',
          //'types',
          //'index.d.ts',
          //'types/ember-cli-htmlbars/index.d.ts',
          //'**/*.d.ts',
        ],
        //packageDir: [path.join(__dirname, 'package.json'), path.join(__dirname, 'packages/core/package.json')],
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
    // node files
    {
      files: [
        '**/.eslintrc.js',
        '**/.template-lintrc.js',

        'packages/*/ember-cli-build.js',
        'ember-cli-build.js',

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
        'packages/*/tests/dummy/app/**',
        'test-packages/**/*.[jt]s',
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
