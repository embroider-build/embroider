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
* fix a rebuild crash in dummy apps on windows, #1247 (@ef4)
* Support TypeScript without ember-cli-typescript, #1236 (@NullVoxPopuli)

## `@embroider/addon-dev`

* Extensions in addon-dev's rollup plugin are now all normalized to .js, #1223 (@NullVoxPopuli)

  Previously, when addonEntrypoints would include `.{js,ts}`, these entries should no only say .js.
  All files are in terms of "the outputs", which are JavaScript.

  Also in #1223, this PR fixes an issue where components authored in typescript could not be used

* Default 'hoiseTransitiveImports' to 'false', #1233 (@NullVoxPopuli)

  Module load optimzations are an app concern, rather than an addon/library concern.
  This also resolves the issue that is described in [babel-plugin-ember-template-compilation#7](https://github.com/emberjs/babel-plugin-ember-template-compilation/pull/7#event-6996575186)

* Default `sourcemap: true` for the rollup output defaults, #1234 (@NullVoxPopuli)

  These are very hi-fi sourcemaps -- for example, in TypeScript projects, you see TypeScript in the dev tools.
  Because rollup/webpack/etc output can be really hard for humans to read, enabling sourcemaps as a default should hopefully help folks debug their addons more easily.


