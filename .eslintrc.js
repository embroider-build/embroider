'use strict';

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 2017,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
  },
};
