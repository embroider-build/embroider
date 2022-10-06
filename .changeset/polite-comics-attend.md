---
'@embroider/addon-dev': major
'@embroider/compat': minor
'@embroider/core': minor
---

<!-- GH Filter: `is:pr closed:>=2022-07-04T20:22:08.544Z `  (Datetime of 1.8.3 release) -->

## `@embroider/core`

* extends existing EmberENV for ember-inspector, #1252 (@patricklx)

  Resolves: [#1251 - production build breaks ember-inspector component tab](https://github.com/embroider-build/embroider/issues/1251)

## `@embroider/compat`

* Fix an order bug in linkNonCopiedDeps, #1256 (@ef4)
* Use consistent separator on windows, #1248 (@ef4)
* fix a rebuild crash in dummy apps on windows, #1247 (@ef4)
* Support TypeScript without ember-cli-typescript, #1236 (@NullVoxPopuli)
* Add `unique-id` helper to `builtInHelpers` list, #1239 (@jakesjews)

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

* Run the `clean` plugin as late as possible, #1229 (@simonihmig)

  Previously the cleanup would happen at the earliest point in time, at buildStart,
  making the time window large enough for Ember CLI to see the transient build output in an inconsistent state.
  Now it happens at the latest possible time, at generateBundle right before files are written,
  making the time window small enough to not cause any problems in practice.
