---
'@embroider/addon-dev': major
'@embroider/addon-shim': minor
'@embroider/babel-loader-8': minor
'@embroider/compat': minor
'@embroider/core': minor
'@embroider/hbs-loader': minor
'@embroider/macros': minor
'@embroider/router': minor
'@embroider/shared-internals': minor
'@embroider/test-setup': minor
'@embroider/util': minor
'@embroider/webpack': minor
'@embroider/test-support': minor
---

<!-- GH Filter: `is:pr closed:>=2022-07-04T20:22:08.544Z `  (Datetime of 1.8.3 release) -->


## `@embroider/compat`

* Use consistent separator on windows, #1248 (@ef4)
* fix a rebuild crash in dummy apps on windows #1247 (@ef4)
* Support TypeScript without ember-cli-typescript #1236 (@NullVoxPopuli)

## `@embroider/addon-dev`

[#1223][pr-1223] Extensions in addon-dev's rollup plugin are now all normalized to .js.

Previously, when addonEntrypoints would include `.{js,ts}`, these entries should no only say .js.
All files are in terms of "the outputs", which are JavaScript.

Also in #1223, this PR fixes an issue where components authored in typescript could not be used

[pr-1223]: https://github.com/embroider-build/embroider/pull/1223
