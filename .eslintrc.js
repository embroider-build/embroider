'use strict';

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module',
  },
  plugins: ['import', 'prettier', '@typescript-eslint'],
  extends: ['prettier', 'plugin:n/recommended'],
  rules: {
    eqeqeq: ['error', 'smart'],
    'no-debugger': 'error',
    'no-new-wrappers': 'error',
    'no-redeclare': 'error',
    'no-unused-labels': 'error',
    'no-var': 'error',

    /**
     * This rule requires that certain ES features only be allowed
     * if our minimum engines version allows them.
     * Since we transpile the code to CJS, this rule isn't meaningful to us.
     */
    'n/no-unsupported-features/es-syntax': 'off',
    /**
     * eslint-plugin-n doesn't understand type imports as *output* is concerned.
     * See: https://github.com/eslint-community/eslint-plugin-n/issues/66
     *
     * There is no way for a plugin to _know_ that an import is removed at build time,
     * or ever if there is a build time.
     * So we need to disable these two rules.
     *  The downside is that we don't have a way to know (aside from typescript telling us)
     *  if a type-only-dependency is missing
     *
     *  We still have n/no-extraneous-import, which is still valuable
     */
    'n/no-missing-import': 'off',
    'n/no-unpublished-import': 'off',

    /**
     * We manage stdout and stderr output very specifically, and it doesn't always make sense to exit with an error
     * as the error has already been printed.
     */
    'n/no-process-exit': 'off',

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
      files: ['types/**/*.ts'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: ['tests/**/*.ts', 'test-packages/**/*.ts'],
      rules: {
        /**
         * These packages are not published
         */
        'n/no-unpublished-require': 'off',
      },
    },
  ],
};
