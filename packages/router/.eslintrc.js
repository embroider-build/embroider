'use strict';

module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    ecmaFeatures: {
      legacyDecorators: true,
    },
  },
  plugins: ['ember'],
  extends: [
    'eslint:recommended',
    'plugin:ember/recommended',
    'plugin:n/recommended',
    'plugin:prettier/recommended',
  ],
  env: {
    browser: true,
  },
  rules: {
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
  },
  overrides: [
    // node files
    {
      files: [
        './.eslintrc.js',
        './.prettierrc.js',
        './.template-lintrc.js',
        './ember-cli-build.js',
        './index.js',
        './testem.js',
        './blueprints/*/index.js',
        './config/**/*.js',
        './tests/dummy/config/**/*.js',
      ],
      excludedFiles: [
        'addon/**',
        'addon-test-support/**',
        'app/**',
        'tests/dummy/app/**',
      ],
      parserOptions: {
        sourceType: 'script',
      },
      env: {
        browser: false,
        node: true,
      },
      extends: ['plugin:n/recommended'],
    },
    {
      // test files
      files: ['tests/**/*-test.{js,ts}'],
      extends: ['plugin:qunit/recommended'],
    },
  ],
};
