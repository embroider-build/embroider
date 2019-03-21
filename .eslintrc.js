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
    'no-debugger': 'error',
    'no-new-wrappers': 'error',
    'no-var': 'error',

    '@typescript-eslint/no-angle-bracket-type-assertion': 'error',

    'prettier/prettier': 'error',
  },
};
