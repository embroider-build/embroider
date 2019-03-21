'use strict';

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 2017,
    sourceType: 'module',
  },
  plugins: ['prettier', '@typescript-eslint'],
  extends: ['prettier', 'prettier/@typescript-eslint'],
  rules: {
    eqeqeq: ['error', 'smart'],
    'no-debugger': 'error',
    'no-new-wrappers': 'error',
    'no-var': 'error',

    '@typescript-eslint/class-name-casing': 'error',
    '@typescript-eslint/no-angle-bracket-type-assertion': 'error',
    '@typescript-eslint/no-inferrable-types': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    'prettier/prettier': 'error',
  },
};
