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
  extends: [
    'prettier',
    'prettier/@typescript-eslint',
  ],
  rules: {
    'prettier/prettier': 'error',
  },
};
