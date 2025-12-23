# Embroider Changelog

## Release (2025-12-23)

* @embroider/addon-dev 8.2.0 (minor)
* @embroider/compat 4.1.12 (patch)
* @embroider/core 4.4.2 (patch)
* @embroider/macros 1.19.6 (patch)
* @embroider/shared-internals 3.0.2 (patch)
* @embroider/vite 1.5.0 (minor)

#### :rocket: Enhancement
* `@embroider/addon-dev`, `@embroider/vite`
  * [#2650](https://github.com/embroider-build/embroider/pull/2650) Update content-tag to 4.1.0 ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### :bug: Bug Fix
* `@embroider/shared-internals`
  * [#2648](https://github.com/embroider-build/embroider/pull/2648) Fix dependency-aware macros in dummy apps ([@ef4](https://github.com/ef4))

#### Committers: 2
- Edward Faulkner ([@ef4](https://github.com/ef4))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-12-09)

* @embroider/core 4.4.1 (patch)

#### :bug: Bug Fix
* `@embroider/core`
  * [#2639](https://github.com/embroider-build/embroider/pull/2639) Fix `getAppFiles` filters to prevent app.ts from ending up in compatModules ([@BlueCutOfficial](https://github.com/BlueCutOfficial))

#### Committers: 1
- Marine Dunstetter ([@BlueCutOfficial](https://github.com/BlueCutOfficial))

## Release (2025-12-04)

* @embroider/vite 1.4.4 (patch)

#### :bug: Bug Fix
* `@embroider/vite`
  * [#2622](https://github.com/embroider-build/embroider/pull/2622) Protect against the compat build running multiple times in parallel ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### :house: Internal
* `@embroider/vite`
  * [#2642](https://github.com/embroider-build/embroider/pull/2642) Use stable vite by default in development ([@ef4](https://github.com/ef4))
  * [#2640](https://github.com/embroider-build/embroider/pull/2640) Align the rollup versions to latest beta - fixes CI ([@BlueCutOfficial](https://github.com/BlueCutOfficial))

#### Committers: 3
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Marine Dunstetter ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-12-02)

* @embroider/core 4.4.0 (minor)

#### :rocket: Enhancement
* `@embroider/core`
  * [#2161](https://github.com/embroider-build/embroider/pull/2161) Optimize implicit-modules graph ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-11-28)

* @embroider/core 4.3.0 (minor)

#### :rocket: Enhancement
* `@embroider/core`
  * [#2629](https://github.com/embroider-build/embroider/pull/2629) Make route-splitter 10-20x faster when you have > 3000 route splits ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 1
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-11-26)

* @embroider/compat 4.1.11 (patch)
* @embroider/core 4.2.9 (patch)
* @embroider/macros 1.19.5 (patch)
* @embroider/vite 1.4.3 (patch)

#### :bug: Bug Fix
* `@embroider/macros`
  * [#2626](https://github.com/embroider-build/embroider/pull/2626) Fix appEmberSatisfies macro ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-11-25)

* @embroider/router 3.0.6 (patch)

#### :bug: Bug Fix
* `@embroider/router`
  * [#2624](https://github.com/embroider-build/embroider/pull/2624) Embroider router support for ember source less than 4.12 ([@void-mAlex](https://github.com/void-mAlex))

#### Committers: 1
- Alex ([@void-mAlex](https://github.com/void-mAlex))

## Release (2025-11-22)

* @embroider/addon-dev 8.1.2 (patch)

#### :bug: Bug Fix
* `@embroider/addon-dev`
  * [#2619](https://github.com/embroider-build/embroider/pull/2619) Fix rollup incremental plugin ([@bendemboski](https://github.com/bendemboski))

#### Committers: 1
- Ben Demboski ([@bendemboski](https://github.com/bendemboski))

## Release (2025-11-21)

* @embroider/addon-dev 8.1.1 (patch)

#### :bug: Bug Fix
* `@embroider/addon-dev`
  * [#2618](https://github.com/embroider-build/embroider/pull/2618) Cleanup for #2616 ([@bendemboski](https://github.com/bendemboski))
  * [#2616](https://github.com/embroider-build/embroider/pull/2616) Don't let keepAssets plugin corrupt source maps ([@bendemboski](https://github.com/bendemboski))

#### Committers: 1
- Ben Demboski ([@bendemboski](https://github.com/bendemboski))

## Release (2025-11-19)

* @embroider/core 4.2.8 (patch)
* @embroider/reverse-exports 0.2.0 (minor)
* @embroider/vite 1.4.2 (patch)

#### :rocket: Enhancement
* `@embroider/reverse-exports`
  * [#2614](https://github.com/embroider-build/embroider/pull/2614) Extend node support for reverse-exports package back to Node v12 ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-11-18)

* @embroider/router 3.0.5 (patch)

#### :bug: Bug Fix
* `@embroider/router`
  * [#2612](https://github.com/embroider-build/embroider/pull/2612) fix stickly queryParams on lazy routes/engines ([@void-mAlex](https://github.com/void-mAlex))

#### Committers: 1
- Alex ([@void-mAlex](https://github.com/void-mAlex))

## Release (2025-11-11)

* @embroider/addon-shim 1.10.2 (patch)
* @embroider/compat 4.1.10 (patch)
* @embroider/core 4.2.7 (patch)
* @embroider/macros 1.19.4 (patch)
* @embroider/vite 1.4.1 (patch)

#### :bug: Bug Fix
* `@embroider/vite`
  * [#2499](https://github.com/embroider-build/embroider/pull/2499) Use options hook for running compat-prebuild ([@simonihmig](https://github.com/simonihmig))
  * [#2600](https://github.com/embroider-build/embroider/pull/2600) Use Vite's resolved cacheDir to determine cache location ([@mogstad](https://github.com/mogstad))
* `@embroider/addon-shim`
  * [#2608](https://github.com/embroider-build/embroider/pull/2608) fix deployment of addon-shim ([@mansona](https://github.com/mansona))

#### :memo: Documentation
* Other
  * [#2448](https://github.com/embroider-build/embroider/pull/2448) Document adding app reexports to package.json#exports ([@fdeters](https://github.com/fdeters))
* `@embroider/macros`
  * [#2606](https://github.com/embroider-build/embroider/pull/2606) Fix typo in README.md regarding macroCondition ([@MelSumner](https://github.com/MelSumner))

#### Committers: 5
- Bjarne Mogstad ([@mogstad](https://github.com/mogstad))
- Chris Manson ([@mansona](https://github.com/mansona))
- Forrest Deters ([@fdeters](https://github.com/fdeters))
- Melanie Sumner ([@MelSumner](https://github.com/MelSumner))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))

## Release (2025-11-11)

* @embroider/addon-shim 1.10.1 (patch)
* @embroider/compat 4.1.9 (patch)
* @embroider/core 4.2.6 (patch)
* @embroider/macros 1.19.3 (patch)
* @embroider/template-tag-codemod 1.3.4 (patch)
* @embroider/vite 1.4.0 (minor)

#### :rocket: Enhancement
* `@embroider/vite`
  * [#2597](https://github.com/embroider-build/embroider/pull/2597) Pull out and export configTargets plugin ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### :bug: Bug Fix
* `@embroider/addon-shim`
  * [#2604](https://github.com/embroider-build/embroider/pull/2604) Drop the need for ember-auto-import dependency on app for @embroider/addon-shim ([@mansona](https://github.com/mansona))
* `@embroider/vite`
  * [#2601](https://github.com/embroider-build/embroider/pull/2601) Support `content-for` with single quotes as well ([@bertdeblock](https://github.com/bertdeblock))
* `@embroider/macros`
  * [#2599](https://github.com/embroider-build/embroider/pull/2599) Fix runtime implementation of negated macroCondition ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### :memo: Documentation
* `@embroider/template-tag-codemod`
  * [#2588](https://github.com/embroider-build/embroider/pull/2588) Add warning about losing non-template-tag changes in merge-history ([@balinterdi](https://github.com/balinterdi))

#### :house: Internal
* [#2605](https://github.com/embroider-build/embroider/pull/2605) Regenerate lockfile ([@ef4](https://github.com/ef4))
* [#2585](https://github.com/embroider-build/embroider/pull/2585) Split windows tests ([@mansona](https://github.com/mansona))

#### Committers: 5
- Balint Erdi ([@balinterdi](https://github.com/balinterdi))
- Bert De Block ([@bertdeblock](https://github.com/bertdeblock))
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-10-21)

* @embroider/vite 1.3.6 (patch)

#### :bug: Bug Fix
* `@embroider/vite`
  * [#2593](https://github.com/embroider-build/embroider/pull/2593) Fix race between multiple builds creating embroider-vite-jump ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-10-17)

* @embroider/vite 1.3.5 (patch)

#### :bug: Bug Fix
* `@embroider/vite`
  * [#2584](https://github.com/embroider-build/embroider/pull/2584) Conditianlly add entrypoints for the index.html files IFF they exist ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 1
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-10-15)

* @embroider/compat 4.1.8 (patch)
* @embroider/core 4.2.5 (patch)
* @embroider/macros 1.19.2 (patch)
* @embroider/vite 1.3.4 (patch)

#### :bug: Bug Fix
* `@embroider/macros`
  * [#2590](https://github.com/embroider-build/embroider/pull/2590) tolerate negation before macroCondition ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-10-14)

* @embroider/vite 1.3.3 (patch)

#### :bug: Bug Fix
* `@embroider/vite`
  * [#2586](https://github.com/embroider-build/embroider/pull/2586) Fix {{content-for "head"}} being moved to body and add a regression test ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-10-07)

* @embroider/vite 1.3.2 (patch)

#### :bug: Bug Fix
* `@embroider/vite`
  * [#2581](https://github.com/embroider-build/embroider/pull/2581) fix error on windows build with lazy engines or re-written packages ([@void-mAlex](https://github.com/void-mAlex))

#### Committers: 1
- Alex ([@void-mAlex](https://github.com/void-mAlex))

## Release (2025-10-07)

* @embroider/legacy-inspector-support 0.1.3 (patch)
* @embroider/template-tag-codemod 1.3.3 (patch)
* @embroider/vite 1.3.1 (patch)

#### :bug: Bug Fix
* `@embroider/vite`
  * [#2580](https://github.com/embroider-build/embroider/pull/2580) allow FORCE_BUILD_TESTS to work in mode=production ([@mansona](https://github.com/mansona))
* `@embroider/template-tag-codemod`
  * [#2478](https://github.com/embroider-build/embroider/pull/2478) allow merging histories for independent codemod invocations of components routes and tests ([@void-mAlex](https://github.com/void-mAlex))

#### :memo: Documentation
* `@embroider/legacy-inspector-support`
  * [#2578](https://github.com/embroider-build/embroider/pull/2578) Add installation section to `@embroider/legacy-inspector-support` README.md ([@johanrd](https://github.com/johanrd))

#### Committers: 3
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- Chris Manson ([@mansona](https://github.com/mansona))
- [@johanrd](https://github.com/johanrd)

## Release (2025-10-02)

* @embroider/compat 4.1.7 (patch)
* @embroider/core 4.2.4 (patch)
* @embroider/legacy-inspector-support 0.1.2 (patch)
* @embroider/macros 1.19.1 (patch)
* @embroider/vite 1.3.0 (minor)

#### :rocket: Enhancement
* `@embroider/vite`
  * [#2552](https://github.com/embroider-build/embroider/pull/2552) Warn if `{{rootURL}}` is present in index.html ([@pichfl](https://github.com/pichfl))

#### :bug: Bug Fix
* `@embroider/legacy-inspector-support`
  * [#2574](https://github.com/embroider-build/embroider/pull/2574) fix deploying of types for inspector-support ([@mansona](https://github.com/mansona))
  * [#2576](https://github.com/embroider-build/embroider/pull/2576) don't break SSR with legacy-inspector-support ([@mansona](https://github.com/mansona))
* `@embroider/macros`
  * [#2571](https://github.com/embroider-build/embroider/pull/2571) Drop `node:` prefix on imports in app-ember-satisfies to accomodate node < 16 ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### :house: Internal
* `@embroider/vite`
  * [#2575](https://github.com/embroider-build/embroider/pull/2575) simplify gitignore for @embroider/vite ([@mansona](https://github.com/mansona))

#### Committers: 3
- Chris Manson ([@mansona](https://github.com/mansona))
- Florian Pichler ([@pichfl](https://github.com/pichfl))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-09-30)

* @embroider/compat 4.1.6 (patch)
* @embroider/core 4.2.3 (patch)
* @embroider/legacy-inspector-support 0.1.1 (patch)
* @embroider/macros 1.19.0 (minor)
* @embroider/vite 1.2.3 (patch)

#### :rocket: Enhancement
* `@embroider/macros`
  * [#2550](https://github.com/embroider-build/embroider/pull/2550) new Macro: `appEmberSatisfies(range)` ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### :bug: Bug Fix
* `@embroider/legacy-inspector-support`
  * [#2569](https://github.com/embroider-build/embroider/pull/2569) fix release of legacy-inspector-support ([@mansona](https://github.com/mansona))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-09-30)

* @embroider/compat 4.1.5 (patch)
* @embroider/core 4.2.2 (patch)
* @embroider/legacy-inspector-support 0.1.0 (minor)
* @embroider/macros 1.18.3 (patch)
* @embroider/router 3.0.4 (patch)
* @embroider/vite 1.2.2 (patch)

#### :rocket: Enhancement
* `@embroider/legacy-inspector-support`
  * [#2522](https://github.com/embroider-build/embroider/pull/2522) Add compat ember-inspector support ([@BlueCutOfficial](https://github.com/BlueCutOfficial))

#### :bug: Bug Fix
* `@embroider/vite`
  * [#2566](https://github.com/embroider-build/embroider/pull/2566) Fix CI for upstream rolldown and webpack changes ([@ef4](https://github.com/ef4))

#### :house: Internal
* `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/router`, `@embroider/vite`
  * [#2562](https://github.com/embroider-build/embroider/pull/2562) Move jest-suites out of scenario tester and make it so we can swap individual packages to vitest ([@mansona](https://github.com/mansona))

#### Committers: 3
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Marine Dunstetter ([@BlueCutOfficial](https://github.com/BlueCutOfficial))

## Release (2025-09-24)

* @embroider/compat 4.1.4 (patch)
* @embroider/core 4.2.1 (patch)
* @embroider/macros 1.18.2 (patch)
* @embroider/shared-internals 3.0.1 (patch)
* @embroider/vite 1.2.1 (patch)

#### :bug: Bug Fix
* `@embroider/compat`
  * [#2561](https://github.com/embroider-build/embroider/pull/2561) `@embroider/compat`: Remove `ember-source` from dependencies ([@mkszepp](https://github.com/mkszepp))
* `@embroider/shared-internals`
  * [#2553](https://github.com/embroider-build/embroider/pull/2553) Update pkg-entry-points dependency version ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 2
- Markus Sanin ([@mkszepp](https://github.com/mkszepp))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-09-11)

* @embroider/core 4.2.0 (minor)

#### :rocket: Enhancement
* `@embroider/core`
  * [#2456](https://github.com/embroider-build/embroider/pull/2456) Ember engines compatibility ([@void-mAlex](https://github.com/void-mAlex))

#### :bug: Bug Fix
* `@embroider/core`
  * [#2465](https://github.com/embroider-build/embroider/pull/2465) Engine-specific module resolver fixes ([@ef4](https://github.com/ef4))

#### Committers: 2
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-08-28)

* @embroider/compat 4.1.3 (patch)

#### :bug: Bug Fix
* `@embroider/compat`
  * [#2544](https://github.com/embroider-build/embroider/pull/2544) Chore: Upgrade jsdom ([@nikolasrieble](https://github.com/nikolasrieble))
  * [#2545](https://github.com/embroider-build/embroider/pull/2545) chore: upgrade @babel/runtime in compat ([@nikolasrieble](https://github.com/nikolasrieble))

#### Committers: 1
- Nikolas Rieble ([@nikolasrieble](https://github.com/nikolasrieble))

## Release (2025-08-26)

* @embroider/router 3.0.3 (patch)
* @embroider/vite 1.2.0 (minor)

#### :rocket: Enhancement
* `@embroider/vite`
  * [#2538](https://github.com/embroider-build/embroider/pull/2538) Add support for rolldown-vite ([@mansona](https://github.com/mansona))

#### :bug: Bug Fix
* `@embroider/router`
  * [#2543](https://github.com/embroider-build/embroider/pull/2543) Protect against early destruction ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### :house: Internal
* [#2485](https://github.com/embroider-build/embroider/pull/2485) Delete @embroider/util ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* [#2535](https://github.com/embroider-build/embroider/pull/2535) add vite 7 to scenario tester ([@mansona](https://github.com/mansona))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-08-05)

* @embroider/compat 4.1.2 (patch)

#### :bug: Bug Fix
* `@embroider/compat`
  * [#2501](https://github.com/embroider-build/embroider/pull/2501) Ensure @ember/debug methods behave correctly in development vs production builds ([@robbytx](https://github.com/robbytx))

#### :house: Internal
* [#2534](https://github.com/embroider-build/embroider/pull/2534) update pnpm to 10 ([@mansona](https://github.com/mansona))
* [#2531](https://github.com/embroider-build/embroider/pull/2531) Upstream webpack types broke our build ([@ef4](https://github.com/ef4))

#### Committers: 3
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Robby Morgan ([@robbytx](https://github.com/robbytx))

## Release (2025-07-23)

* @embroider/core 4.1.3 (patch)

#### :bug: Bug Fix
* `@embroider/core`
  * [#2525](https://github.com/embroider-build/embroider/pull/2525) App tree merging should be insensitive to file extensions ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-07-22)

* @embroider/router 3.0.2 (patch)

#### :bug: Bug Fix
* `@embroider/router`
  * [#2524](https://github.com/embroider-build/embroider/pull/2524) Fix loading route in @embroider/router ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-07-22)

* @embroider/compat 4.1.1 (patch)
* @embroider/core 4.1.2 (patch)
* @embroider/macros 1.18.1 (patch)
* @embroider/vite 1.1.6 (patch)

#### :bug: Bug Fix
* `@embroider/compat`, `@embroider/macros`
  * [#2511](https://github.com/embroider-build/embroider/pull/2511) Fixing lazy importSync ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-06-24)

* @embroider/core 4.1.1 (patch)
* @embroider/template-tag-codemod 1.3.2 (patch)

#### :memo: Documentation
* Other
  * [#2498](https://github.com/embroider-build/embroider/pull/2498) Update porting-addons-to-v2.md: add auto rebuild explanation ([@x-m-el](https://github.com/x-m-el))
  * [#2492](https://github.com/embroider-build/embroider/pull/2492) Update porting-addons-to-v2.md ([@x-m-el](https://github.com/x-m-el))
* `@embroider/template-tag-codemod`
  * [#2495](https://github.com/embroider-build/embroider/pull/2495) Fix merge-history commands (remove `) ([@mkszepp](https://github.com/mkszepp))

#### :house: Internal
* Other
  * [#2505](https://github.com/embroider-build/embroider/pull/2505) stop publishing unstable on every merge to master ([@mansona](https://github.com/mansona))
* `@embroider/core`
  * [#2503](https://github.com/embroider-build/embroider/pull/2503) Merge stable ([@ef4](https://github.com/ef4))

#### Committers: 4
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Markus Sanin ([@mkszepp](https://github.com/mkszepp))
- [@x-m-el](https://github.com/x-m-el)

## Release (2025-05-21)

* @embroider/template-tag-codemod 1.3.1 (patch)

#### :memo: Documentation
* `@embroider/template-tag-codemod`
  * [#2489](https://github.com/embroider-build/embroider/pull/2489) [template-tag-codemod] Add version to `--nativeLexicalThis` & update ReadMe ([@mkszepp](https://github.com/mkszepp))

#### Committers: 1
- Markus Sanin ([@mkszepp](https://github.com/mkszepp))

## Release (2025-05-20)

* @embroider/vite 1.1.5 (patch)

#### :bug: Bug Fix
* `@embroider/vite`
  * [#2473](https://github.com/embroider-build/embroider/pull/2473) Update scenarios to supported versions of Ember Data as v2 addon ([@robbytx](https://github.com/robbytx))

#### Committers: 1
- Robby Morgan ([@robbytx](https://github.com/robbytx))

## Release (2025-05-20)

* @embroider/compat 4.1.0 (minor)
* @embroider/core 4.1.0 (minor)
* @embroider/macros 1.18.0 (minor)
* @embroider/template-tag-codemod 1.3.0 (minor)
* @embroider/vite 1.1.4 (patch)

#### :rocket: Enhancement
* `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/template-tag-codemod`
  * [#2415](https://github.com/embroider-build/embroider/pull/2415) Use babel-plugin-ember-template-compilation 3.x ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-05-20)

* @embroider/compat 4.0.4 (patch)
* @embroider/core 4.0.4 (patch)

#### :bug: Bug Fix
* `@embroider/compat`, `@embroider/core`
  * [#2458](https://github.com/embroider-build/embroider/pull/2458) Fix splitAtRoutes when they are defined as a regex ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-05-15)

* @embroider/vite 1.1.3 (patch)

#### :bug: Bug Fix
* `@embroider/vite`
  * [#2482](https://github.com/embroider-build/embroider/pull/2482) Propagate other plugin's custom metadata ([@ef4](https://github.com/ef4))
  * [#2481](https://github.com/embroider-build/embroider/pull/2481) Vite build should resolve ember-cli from working dir ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-05-13)

* @embroider/addon-dev 8.1.0 (minor)
* @embroider/vite 1.1.2 (patch)

#### :rocket: Enhancement
* `@embroider/addon-dev`
  * [#2474](https://github.com/embroider-build/embroider/pull/2474) Allow declarations plugin to have its command customized ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### :bug: Bug Fix
* `@embroider/vite`
  * [#2469](https://github.com/embroider-build/embroider/pull/2469) fix: ensure minify can be disabled ([@Techn1x](https://github.com/Techn1x))

#### Committers: 2
- Brad Overton ([@Techn1x](https://github.com/Techn1x))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-05-06)

* @embroider/compat 4.0.3 (patch)
* @embroider/core 4.0.3 (patch)
* @embroider/macros 1.17.3 (patch)
* @embroider/vite 1.1.1 (patch)

#### :bug: Bug Fix
* `@embroider/vite`
  * [#2464](https://github.com/embroider-build/embroider/pull/2464) Don't run terser when --mode=test ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### :house: Internal
* `@embroider/macros`
  * [#2467](https://github.com/embroider-build/embroider/pull/2467) upstream changed generated identifiers and this test is fragile ([@ef4](https://github.com/ef4))

#### Committers: 2
- Edward Faulkner ([@ef4](https://github.com/ef4))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-04-30)

* @embroider/vite 1.1.0 (minor)

#### :rocket: Enhancement
* `@embroider/vite`
  * [#2462](https://github.com/embroider-build/embroider/pull/2462) Terser by default in prod ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 1
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-04-18)

* @embroider/compat 4.0.2 (patch)
* @embroider/core 4.0.2 (patch)
* @embroider/macros 1.17.2 (patch)
* @embroider/reverse-exports 0.1.2 (patch)
* @embroider/router 3.0.1 (patch)
* @embroider/vite 1.0.3 (patch)

#### :bug: Bug Fix
* `@embroider/reverse-exports`
  * [#2449](https://github.com/embroider-build/embroider/pull/2449) Major speedup of reverse-exports ([@simonihmig](https://github.com/simonihmig))
* `@embroider/router`
  * [#2443](https://github.com/embroider-build/embroider/pull/2443) Widen Range for @ember/test-waiters ([@jrjohnson](https://github.com/jrjohnson))

#### :house: Internal
* `@embroider/reverse-exports`
  * [#2450](https://github.com/embroider-build/embroider/pull/2450) convert reverse-exports to a tsconfig project ([@mansona](https://github.com/mansona))
* `@embroider/core`, `@embroider/macros`
  * [#2451](https://github.com/embroider-build/embroider/pull/2451) move core to a tsconfig project ([@mansona](https://github.com/mansona))
* `@embroider/compat`
  * [#2324](https://github.com/embroider-build/embroider/pull/2324) move embroider compat to a tsconfig reference project ([@mansona](https://github.com/mansona))

#### Committers: 3
- Chris Manson ([@mansona](https://github.com/mansona))
- Jon Johnson ([@jrjohnson](https://github.com/jrjohnson))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))

## Release (2025-04-04)

* @embroider/template-tag-codemod 1.2.0 (minor)

#### :rocket: Enhancement
* `@embroider/template-tag-codemod`
  * [#2419](https://github.com/embroider-build/embroider/pull/2419) Add `--custom-resolver` option to template-tag-codemod ([@CvX](https://github.com/CvX))
  * [#2408](https://github.com/embroider-build/embroider/pull/2408) Support `templateOnlyComponent()` usages in template tag codemod ([@bendemboski](https://github.com/bendemboski))

#### Committers: 2
- Ben Demboski ([@bendemboski](https://github.com/bendemboski))
- Jarek Radosz ([@CvX](https://github.com/CvX))

## Release (2025-04-04)

* @embroider/addon-dev 8.0.1 (patch)
* @embroider/vite 1.0.2 (patch)

#### :bug: Bug Fix
* `@embroider/addon-dev`
  * [#2435](https://github.com/embroider-build/embroider/pull/2435) Fix issue when your library has no prior app-js entry in package.json ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `@embroider/vite`
  * [#2436](https://github.com/embroider-build/embroider/pull/2436) Fix resolving EmberCLI in vite prebuild ([@simonihmig](https://github.com/simonihmig))

#### Committers: 2
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-04-03)

* @embroider/compat 4.0.1 (patch)
* @embroider/core 4.0.1 (patch)
* @embroider/macros 1.17.1 (patch)
* @embroider/vite 1.0.1 (patch)

#### :bug: Bug Fix
* `@embroider/macros`
  * [#2433](https://github.com/embroider-build/embroider/pull/2433) Fix issue occuring when some consumers of @embroider/macros specify extensions for macros' content via require/import ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 1
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-04-03)

* @embroider/addon-dev 8.0.0 (patch)
* @embroider/addon-shim 1.10.0 (patch)
* @embroider/babel-loader-9 4.0.0 (patch)
* @embroider/broccoli-side-watch 1.1.0 (patch)
* @embroider/compat 4.0.0 (patch)
* @embroider/config-meta-loader 1.0.0 (patch)
* @embroider/core 4.0.0 (patch)
* @embroider/hbs-loader 4.0.0 (patch)
* @embroider/macros 1.17.0 (patch)
* @embroider/reverse-exports 0.1.1 (patch)
* @embroider/router 3.0.0 (patch)
* @embroider/shared-internals 3.0.0 (patch)
* @embroider/vite 1.0.0 (patch)

#### :memo: Documentation
* [#2423](https://github.com/embroider-build/embroider/pull/2423) update the readme to more accurately reflect the current system ([@mansona](https://github.com/mansona))

#### :house: Internal
* `@embroider/addon-dev`, `@embroider/addon-shim`, `@embroider/babel-loader-9`, `@embroider/broccoli-side-watch`, `@embroider/compat`, `@embroider/config-meta-loader`, `@embroider/core`, `@embroider/hbs-loader`, `@embroider/macros`, `@embroider/reverse-exports`, `@embroider/router`, `@embroider/shared-internals`, `@embroider/vite`
  * [#2427](https://github.com/embroider-build/embroider/pull/2427) release main as stable ([@mansona](https://github.com/mansona))
* `@embroider/addon-dev`, `@embroider/compat`
  * [#2429](https://github.com/embroider-build/embroider/pull/2429) Merge stable into main ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-04-03)

@embroider/compat 3.9.0 (minor)
@embroider/core 3.5.6 (patch)
@embroider/macros 1.16.13 (patch)

#### :rocket: Enhancement
* `@embroider/compat`
  * [#2425](https://github.com/embroider-build/embroider/pull/2425) Adding  a compat adapter for ember-fetch ([@ef4](https://github.com/ef4))

#### :house: Internal
* `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/test-scenarios`
  * [#2426](https://github.com/embroider-build/embroider/pull/2426) fix types on stable ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-04-01)

@embroider/addon-dev 7.1.4 (patch)

#### :bug: Bug Fix
* `@embroider/addon-dev`
  * [#2237](https://github.com/embroider-build/embroider/pull/2237) Pass along options to resolve ([@abeforgit](https://github.com/abeforgit))

#### Committers: 1
- Arne Bertrand ([@abeforgit](https://github.com/abeforgit))

## Release (2025-03-20)

@embroider/compat 3.8.5 (patch)
@embroider/core 3.5.5 (patch)
@embroider/macros 1.16.12 (patch)

#### :bug: Bug Fix
* `@embroider/macros`
  * [#2404](https://github.com/embroider-build/embroider/pull/2404) Allow macros to see through sequence expressions ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-04-02)

* @embroider/addon-shim 1.10.0-alpha.0 (minor)

#### :rocket: Enhancement
* `@embroider/addon-shim`
  * [#2420](https://github.com/embroider-build/embroider/pull/2420) reset addon-shim to have the same version as stable ([@mansona](https://github.com/mansona))

#### :house: Internal
* `@embroider/addon-shim`
  * [#2422](https://github.com/embroider-build/embroider/pull/2422) set addon-shim to release a pre-minor ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-03-28)

* @embroider/template-tag-codemod 1.1.1 (patch)

#### :bug: Bug Fix
* `@embroider/template-tag-codemod`
  * [#2416](https://github.com/embroider-build/embroider/pull/2416) Fix a small typo spotted yesterday during Ember Europe ([@bartocc](https://github.com/bartocc))

#### Committers: 1
- Julien Palmas ([@bartocc](https://github.com/bartocc))

## Release (2025-03-25)

* @embroider/addon-dev 8.0.0-alpha.6 (patch)
* @embroider/compat 4.0.0-alpha.15 (patch)
* @embroider/core 4.0.0-alpha.10 (patch)
* @embroider/macros 1.17.0-alpha.8 (patch)
* @embroider/template-tag-codemod 1.1.0 (minor)
* @embroider/vite 1.0.0-alpha.12 (patch)

#### :boom: Breaking Change
* [#2413](https://github.com/embroider-build/embroider/pull/2413) Deprecate @embroider/util ([@ef4](https://github.com/ef4))

#### :rocket: Enhancement
* `@embroider/template-tag-codemod`
  * [#2320](https://github.com/embroider-build/embroider/pull/2320) convert from yargs to commander ([@mansona](https://github.com/mansona))

#### :bug: Bug Fix
* `@embroider/vite`
  * [#2411](https://github.com/embroider-build/embroider/pull/2411) esbuild backchannel fix ([@ef4](https://github.com/ef4))
* `@embroider/template-tag-codemod`
  * [#2401](https://github.com/embroider-build/embroider/pull/2401) Handle a couple more common use cases in template tag codemod ([@bendemboski](https://github.com/bendemboski))

#### :house: Internal
* Other
  * [#2414](https://github.com/embroider-build/embroider/pull/2414) update remaining template tag codemod tests ([@ef4](https://github.com/ef4))
* `@embroider/addon-dev`, `@embroider/compat`, `@embroider/core`, `@embroider/template-tag-codemod`
  * [#2412](https://github.com/embroider-build/embroider/pull/2412) Update @glimmer/syntax types ([@ef4](https://github.com/ef4))
* `@embroider/macros`
  * [#2406](https://github.com/embroider-build/embroider/pull/2406) Merge stable into main ([@ef4](https://github.com/ef4))

#### Committers: 3
- Ben Demboski ([@bendemboski](https://github.com/bendemboski))
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-03-20)

* @embroider/compat 4.0.0-alpha.14 (minor)

#### :rocket: Enhancement
* Other
  * [#2400](https://github.com/embroider-build/embroider/pull/2400) Add support for Ember 3.28 ([@mansona](https://github.com/mansona))
* `@embroider/compat`
  * [#2388](https://github.com/embroider-build/embroider/pull/2388) Add support for Ember 4.4 ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-03-18)

* @embroider/compat 4.0.0-alpha.13 (minor)

#### :rocket: Enhancement
* `@embroider/compat`
  * [#2397](https://github.com/embroider-build/embroider/pull/2397) Add support for Ember 4.8 ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-03-18)

* @embroider/compat 4.0.0-alpha.12 (minor)

#### :rocket: Enhancement
* `@embroider/compat`
  * [#2385](https://github.com/embroider-build/embroider/pull/2385) Add Vite support for Ember 4.12 ([@mansona](https://github.com/mansona))

#### :memo: Documentation
* [#2378](https://github.com/embroider-build/embroider/pull/2378) Update README.md with link to packages/router/README.md ([@johanrd](https://github.com/johanrd))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- [@johanrd](https://github.com/johanrd)

## Release (2025-03-14)

* @embroider/compat 4.0.0-alpha.11 (minor)

#### :rocket: Enhancement
* `@embroider/compat`
  * [#2333](https://github.com/embroider-build/embroider/pull/2333) Add Vite support for Ember 5.4 ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-03-14)

* @embroider/compat 4.0.0-alpha.10 (minor)

#### :rocket: Enhancement
* `@embroider/compat`
  * [#2379](https://github.com/embroider-build/embroider/pull/2379) fix @ember/object module cycles for ember 5.8 (and potentially older) ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-03-14)

* @embroider/vite 1.0.0-alpha.11 (minor)

#### :rocket: Enhancement
* `@embroider/vite`
  * [#2372](https://github.com/embroider-build/embroider/pull/2372) always use source maps for gjs in vite ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 1
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-03-14)

* @embroider/addon-dev 8.0.0-alpha.5 (patch)
* @embroider/addon-shim 2.0.0-alpha.2 (patch)
* @embroider/babel-loader-9 4.0.0-alpha.2 (patch)
* @embroider/broccoli-side-watch 1.1.0-alpha.2 (patch)
* @embroider/compat 4.0.0-alpha.9 (patch)
* @embroider/config-meta-loader 1.0.0-alpha.3 (patch)
* @embroider/core 4.0.0-alpha.9 (patch)
* @embroider/hbs-loader 4.0.0-alpha.2 (patch)
* @embroider/macros 1.17.0-alpha.7 (patch)
* @embroider/reverse-exports 0.1.1-alpha.2 (patch)
* @embroider/router 3.0.0-alpha.2 (patch)
* @embroider/shared-internals 3.0.0-alpha.5 (patch)
* @embroider/template-tag-codemod 1.0.0 (major)
* @embroider/util 1.14.0-alpha.2 (patch)
* @embroider/vite 1.0.0-alpha.10 (patch)

#### :boom: Breaking Change
* `@embroider/template-tag-codemod`
  * [#2380](https://github.com/embroider-build/embroider/pull/2380) mark template-codemod as a stable 1.0.0 release ([@mansona](https://github.com/mansona))

#### :house: Internal
* `@embroider/addon-dev`, `@embroider/addon-shim`, `@embroider/babel-loader-9`, `@embroider/broccoli-side-watch`, `@embroider/compat`, `@embroider/config-meta-loader`, `@embroider/core`, `@embroider/hbs-loader`, `@embroider/macros`, `@embroider/reverse-exports`, `@embroider/router`, `@embroider/shared-internals`, `@embroider/util`, `@embroider/vite`
  * [#2375](https://github.com/embroider-build/embroider/pull/2375) tag template-tag-codemod as latest ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-03-13)

@embroider/template-tag-codemod 0.5.0-alpha.10 (patch)

#### :bug: Bug Fix
* `@embroider/template-tag-codemod`, `@embroider/test-scenarios`
  * [#2370](https://github.com/embroider-build/embroider/pull/2370) Handle name collisions when using `--addNameToTemplateOnly` ([@CvX](https://github.com/CvX))

#### Committers: 1
- Jarek Radosz ([@CvX](https://github.com/CvX))

## Release (2025-03-13)

@embroider/addon-dev 8.0.0-alpha.4 (patch)
@embroider/core 4.0.0-alpha.8 (patch)
@embroider/template-tag-codemod 0.5.0-alpha.9 (minor)
@embroider/vite 1.0.0-alpha.9 (patch)

#### :rocket: Enhancement
* `@embroider/template-tag-codemod`
  * [#2363](https://github.com/embroider-build/embroider/pull/2363) Add "merge-history" subcommand to codemod ([@ef4](https://github.com/ef4))

#### :memo: Documentation
* `@embroider/template-tag-codemod`
  * [#2367](https://github.com/embroider-build/embroider/pull/2367) Adding more detail in template-tag readme ([@ef4](https://github.com/ef4))

#### :house: Internal
* Other
  * [#2371](https://github.com/embroider-build/embroider/pull/2371) Merge stable into main ([@mansona](https://github.com/mansona))
* `@embroider/addon-dev`, `@embroider/core`, `@embroider/template-tag-codemod`, `@embroider/vite`, `@embroider/test-scenarios`
  * [#2369](https://github.com/embroider-build/embroider/pull/2369) Merge stable into main ([@ef4](https://github.com/ef4))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-03-11)

@embroider/addon-dev 8.0.0-alpha.3 (patch)
@embroider/compat 4.0.0-alpha.8 (patch)
@embroider/config-meta-loader 1.0.0-alpha.2 (patch)
@embroider/core 4.0.0-alpha.7 (patch)
@embroider/macros 1.17.0-alpha.6 (patch)
@embroider/shared-internals 3.0.0-alpha.4 (patch)
@embroider/template-tag-codemod 0.5.0-alpha.8 (minor)
@embroider/vite 1.0.0-alpha.8 (patch)

#### :rocket: Enhancement
* `@embroider/template-tag-codemod`, `@embroider/test-scenarios`
  * [#2348](https://github.com/embroider-build/embroider/pull/2348) Support named const exports in template-tag-codemod ([@CvX](https://github.com/CvX))

#### :bug: Bug Fix
* `@embroider/compat`, `@embroider/macros`, `@embroider/shared-internals`, `@embroider/template-tag-codemod`, `@embroider/test-scenarios`
  * [#2352](https://github.com/embroider-build/embroider/pull/2352) Babel import util updates ([@ef4](https://github.com/ef4))

#### :house: Internal
* `@embroider/config-meta-loader`
  * [#2356](https://github.com/embroider-build/embroider/pull/2356) build config-meta-loader into dist folder ([@mansona](https://github.com/mansona))
* `@embroider/addon-dev`, `@embroider/compat`, `@embroider/webpack`, `@embroider/test-scenarios`
  * [#2351](https://github.com/embroider-build/embroider/pull/2351) Merge stable into main ([@mansona](https://github.com/mansona))

#### Committers: 3
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Jarek Radosz ([@CvX](https://github.com/CvX))

## Release (2025-03-05)

@embroider/compat 4.0.0-alpha.7 (minor)

#### :rocket: Enhancement
* `@embroider/compat`, `@embroider/test-scenarios`
  * [#2323](https://github.com/embroider-build/embroider/pull/2323) Add Vite support for Ember@5.8  ([@mansona](https://github.com/mansona))

#### :house: Internal
* `app-template-minimal`, `@embroider/test-scenarios`
  * [#2301](https://github.com/embroider-build/embroider/pull/2301) Make app-template-minimal more minimal ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-03-02)

@embroider/template-tag-codemod 0.5.0-alpha.7 (patch)

#### :bug: Bug Fix
* `@embroider/template-tag-codemod`
  * [#2321](https://github.com/embroider-build/embroider/pull/2321) downgrade ember-cli dependency to support a wider range of ember-source ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-02-28)

@embroider/template-tag-codemod 0.5.0-alpha.6 (minor)

#### :rocket: Enhancement
* `@embroider/template-tag-codemod`, `@embroider/test-scenarios`
  * [#2331](https://github.com/embroider-build/embroider/pull/2331) Don't duplicate comments that appear next to modified imports ([@ef4](https://github.com/ef4))
  * [#2330](https://github.com/embroider-build/embroider/pull/2330) Handle render tests that define the template outside the render call ([@ef4](https://github.com/ef4))
* `@embroider/template-tag-codemod`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#2328](https://github.com/embroider-build/embroider/pull/2328) Skip and report non-native-class syntax components ([@ef4](https://github.com/ef4))
* `@embroider/template-tag-codemod`
  * [#2327](https://github.com/embroider-build/embroider/pull/2327) Improve template-tag-codemod error reporting ([@ef4](https://github.com/ef4))
  * [#2319](https://github.com/embroider-build/embroider/pull/2319) template-tag-codemod: only reuse ember prebuild if you explicitly pass the option to do so ([@mansona](https://github.com/mansona))

#### :bug: Bug Fix
* `@embroider/template-tag-codemod`, `@embroider/test-scenarios`
  * [#2332](https://github.com/embroider-build/embroider/pull/2332) Fix lexical this polyfill when "this" has no tail ([@ef4](https://github.com/ef4))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-03-12)

@embroider/compat 3.8.4 (patch)
@embroider/core 3.5.4 (patch)

#### :bug: Bug Fix
* `@embroider/core`
  * [#2368](https://github.com/embroider-build/embroider/pull/2368) Optimize reverseSearchAppTree ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/core`
  * [#2344](https://github.com/embroider-build/embroider/pull/2344) move most of the implementation of staticInvokables to core ([@mansona](https://github.com/mansona))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-02-25)

@embroider/template-tag-codemod 0.5.0-alpha.5 (patch)
@embroider/vite 1.0.0-alpha.7 (patch)

#### :memo: Documentation
* `@embroider/template-tag-codemod`
  * [#2316](https://github.com/embroider-build/embroider/pull/2316) More codemod docs ([@ef4](https://github.com/ef4))
  * [#2312](https://github.com/embroider-build/embroider/pull/2312) codemod: document ember-css-modules workaround ([@ef4](https://github.com/ef4))

#### :house: Internal
* `@embroider/vite`
  * [#2317](https://github.com/embroider-build/embroider/pull/2317) Vite 6.2 includes breaking changes to esbuild types ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-02-24)

@embroider/template-tag-codemod 0.5.0-alpha.4 (minor)

#### :rocket: Enhancement
* `@embroider/template-tag-codemod`, `@embroider/test-scenarios`
  * [#2309](https://github.com/embroider-build/embroider/pull/2309) codemod: support all the legacy inline hbs module names ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix
* `@embroider/template-tag-codemod`, `@embroider/test-scenarios`
  * [#2307](https://github.com/embroider-build/embroider/pull/2307) Share "this" re-bindings within the same scope ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-02-21)

@embroider/compat 4.0.0-alpha.6 (minor)
@embroider/core 4.0.0-alpha.6 (patch)
@embroider/macros 1.17.0-alpha.5 (minor)
@embroider/template-tag-codemod 0.5.0-alpha.3 (patch)
@embroider/vite 1.0.0-alpha.6 (patch)

#### :rocket: Enhancement
* `@embroider/compat`, `@embroider/macros`
  * [#2249](https://github.com/embroider-build/embroider/pull/2249) Expose macros config in babel ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### :bug: Bug Fix
* `@embroider/template-tag-codemod`, `@embroider/test-scenarios`
  * [#2296](https://github.com/embroider-build/embroider/pull/2296) handle empty pojo arg to precompileTemplate ([@ef4](https://github.com/ef4))

#### Committers: 2
- Edward Faulkner ([@ef4](https://github.com/ef4))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-02-21)

@embroider/compat 4.0.0-alpha.5 (patch)
@embroider/core 4.0.0-alpha.5 (patch)
@embroider/macros 1.17.0-alpha.4 (patch)
@embroider/vite 1.0.0-alpha.5 (patch)

#### :bug: Bug Fix
* `@embroider/vite`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2295](https://github.com/embroider-build/embroider/pull/2295) Ember canary fixes ([@ef4](https://github.com/ef4))

#### :house: Internal
* `@embroider/compat`, `@embroider/macros`, `@embroider/test-scenarios`
  * [#2294](https://github.com/embroider-build/embroider/pull/2294) Merge stable into main ([@ef4](https://github.com/ef4))
* Other
  * [#2290](https://github.com/embroider-build/embroider/pull/2290) Add docs for EMBROIDER_WORKING_DIRECTORY ([@simonihmig](https://github.com/simonihmig))

## Release (2025-03-10)

@embroider/core 3.5.3 (patch)
@embroider/vite 0.2.2 (patch)

#### :bug: Bug Fix
* `@embroider/core`, `@embroider/test-scenarios`
  * [#2357](https://github.com/embroider-build/embroider/pull/2357) fix index.ts component resolving ([@mansona](https://github.com/mansona))

#### :house: Internal
* `@embroider/vite`
  * [#2358](https://github.com/embroider-build/embroider/pull/2358) fix gitignore for switching between stable and main ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-03-08)

@embroider/addon-dev 7.1.3 (patch)

#### :bug: Bug Fix
* `@embroider/addon-dev`
  * [#2354](https://github.com/embroider-build/embroider/pull/2354) Fix addon-dev's declarations plugin when glint fails ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 1
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-03-07)

@embroider/addon-dev 7.1.2 (patch)

#### :bug: Bug Fix
* `@embroider/addon-dev`
  * [#2342](https://github.com/embroider-build/embroider/pull/2342) Avoid crashing the rollup watchmode build when glint hits a syntax error ([@abeforgit](https://github.com/abeforgit))

#### :house: Internal
* [#2349](https://github.com/embroider-build/embroider/pull/2349) update release-plan ([@mansona](https://github.com/mansona))

#### Committers: 2
- Arne Bertrand ([@abeforgit](https://github.com/abeforgit))
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-02-22)

@embroider/compat 3.8.3 (patch)

#### :bug: Bug Fix
* `@embroider/compat`
  * [#2305](https://github.com/embroider-build/embroider/pull/2305) Fix vendor ember-template-compiler.js on v2 ember-source ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2025-02-21)

@embroider/core 3.5.2 (patch)
@embroider/webpack 4.1.0 (minor)

#### :rocket: Enhancement
* `@embroider/webpack`
  * [#2299](https://github.com/embroider-build/embroider/pull/2299) Add ability to configure MiniCssExtractPlugin ([@lfloyd117](https://github.com/lfloyd117))

#### :bug: Bug Fix
* `@embroider/core`, `@embroider/test-scenarios`
  * [#2298](https://github.com/embroider-build/embroider/pull/2298) Fix staticInvokables resolution of ts components ([@ef4](https://github.com/ef4))

#### Committers: 2
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Liam Floyd ([@lfloyd117](https://github.com/lfloyd117))

## Release (2025-02-19)

@embroider/compat 3.8.2 (patch)
@embroider/core 3.5.1 (patch)
@embroider/macros 1.16.11 (patch)
@embroider/shared-internals 2.9.0 (minor)
@embroider/webpack 4.0.10 (patch)

#### :rocket: Enhancement
* `@embroider/shared-internals`
  * [#2285](https://github.com/embroider-build/embroider/pull/2285) Introduce EMBROIDER_WORKING_DIRECTORY env var for concurrent builds ([@simonihmig](https://github.com/simonihmig))

#### :bug: Bug Fix
* `@embroider/compat`, `@embroider/test-scenarios`
  * [#2185](https://github.com/embroider-build/embroider/pull/2185) this-property-fallback is not a possibility on ember >=4 ([@ef4](https://github.com/ef4))
* `@embroider/macros`
  * [#2286](https://github.com/embroider-build/embroider/pull/2286) Workaround babel evaluation bug ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/core`
  * [#2291](https://github.com/embroider-build/embroider/pull/2291) Fix nodeResolve's support for package.json exports on stable ([@ef4](https://github.com/ef4))

#### Committers: 2
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))

## Release (2025-02-08)

@embroider/compat 3.8.1 (patch)

#### :memo: Documentation
* `@embroider/compat`
  * [#2244](https://github.com/embroider-build/embroider/pull/2244) add a simple deprecation for staticAddonTrees and staticAddonTestSupportTrees ([@mansona](https://github.com/mansona))
  * [#2245](https://github.com/embroider-build/embroider/pull/2245) add a simple deprecation for staticEmberSource: false ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-02-17)

@embroider/compat 4.0.0-alpha.4 (minor)
@embroider/core 4.0.0-alpha.4 (patch)
@embroider/macros 1.17.0-alpha.3 (patch)
@embroider/shared-internals 3.0.0-alpha.3 (minor)
@embroider/template-tag-codemod 0.5.0-alpha.2 (minor)
@embroider/vite 1.0.0-alpha.4 (patch)

#### :rocket: Enhancement
* `@embroider/template-tag-codemod`, `@embroider/test-scenarios`
  * [#2283](https://github.com/embroider-build/embroider/pull/2283) Finish implementing --renamingRules for template-tag-codemod ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/template-tag-codemod`, `@embroider/test-scenarios`
  * [#2282](https://github.com/embroider-build/embroider/pull/2282) Customizable renaming support in template-tag-codemod ([@ef4](https://github.com/ef4))
* `@embroider/shared-internals`
  * [#2270](https://github.com/embroider-build/embroider/pull/2270) Introduce `EMBROIDER_WORKING_DIRECTORY` env var for concurrent builds ([@simonihmig](https://github.com/simonihmig))

#### :bug: Bug Fix
* `@embroider/compat`, `@embroider/template-tag-codemod`
  * [#2281](https://github.com/embroider-build/embroider/pull/2281) Include version in prebuild output ([@ef4](https://github.com/ef4))
* `@embroider/template-tag-codemod`
  * [#2279](https://github.com/embroider-build/embroider/pull/2279) fix failure on first-run and auto-apply package.json updates ([@ef4](https://github.com/ef4))
  * [#2277](https://github.com/embroider-build/embroider/pull/2277) Revert "Merge pull request #2271 from embroider-build/template-tag-co… ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/template-tag-codemod`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#2264](https://github.com/embroider-build/embroider/pull/2264) Improved codemod scope management ([@ef4](https://github.com/ef4))

#### Committers: 2
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))

## Release (2025-02-17)

@embroider/addon-dev 8.0.0-alpha.2 (patch)
@embroider/addon-shim 2.0.0-alpha.1 (patch)
@embroider/babel-loader-9 4.0.0-alpha.1 (patch)
@embroider/compat 4.0.0-alpha.3 (patch)
@embroider/config-meta-loader 1.0.0-alpha.1 (patch)
@embroider/core 4.0.0-alpha.3 (patch)
@embroider/hbs-loader 4.0.0-alpha.1 (patch)
@embroider/macros 1.17.0-alpha.2 (patch)
@embroider/shared-internals 3.0.0-alpha.2 (patch)
@embroider/template-tag-codemod 0.5.0-alpha.1 (minor)
@embroider/util 1.14.0-alpha.1 (patch)
@embroider/vite 1.0.0-alpha.3 (patch)

#### :rocket: Enhancement
* `@embroider/template-tag-codemod`
  * [#2271](https://github.com/embroider-build/embroider/pull/2271) Template tag codemod stability fixes ([@void-mAlex](https://github.com/void-mAlex))

#### :house: Internal
* `@embroider/addon-dev`, `@embroider/addon-shim`, `@embroider/babel-loader-9`, `@embroider/compat`, `@embroider/config-meta-loader`, `@embroider/hbs-loader`, `@embroider/macros`, `@embroider/shared-internals`, `@embroider/template-tag-codemod`, `@embroider/util`
  * [#2276](https://github.com/embroider-build/embroider/pull/2276) make sure all packages stay within pre-release ([@mansona](https://github.com/mansona))

#### Committers: 2
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-02-16)

@embroider/addon-dev 8.0.0-alpha.1 (patch)
@embroider/compat 4.0.0-alpha.2 (patch)
@embroider/core 4.0.0-alpha.2 (patch)
@embroider/macros 1.17.0-alpha.1 (patch)
@embroider/shared-internals 3.0.0-alpha.1 (patch)
@embroider/vite 1.0.0-alpha.2 (patch)

#### :bug: Bug Fix
* `@embroider/compat`
  * [#2274](https://github.com/embroider-build/embroider/pull/2274) remove duplicate options default ([@void-mAlex](https://github.com/void-mAlex))
* `@embroider/addon-dev`, `@embroider/shared-internals`
  * [#2272](https://github.com/embroider-build/embroider/pull/2272) Cleanup v2 addon rollup warnings, update virtual parkages list ([@chancancode](https://github.com/chancancode))

#### Committers: 2
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- Godfrey Chan ([@chancancode](https://github.com/chancancode))

## Release (2025-02-13)

@embroider/compat 4.0.0-alpha.1 (patch)

#### :bug: Bug Fix
* `@embroider/compat`, `@embroider/test-scenarios`
  * [#2268](https://github.com/embroider-build/embroider/pull/2268) remove the last few references to staticAddonTrees ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2025-02-12)

@embroider/broccoli-side-watch 1.1.0-alpha.1 (patch)
@embroider/core 4.0.0-alpha.1 (patch)
@embroider/reverse-exports 0.1.1-alpha.1 (patch)
@embroider/router 3.0.0-alpha.1 (patch)
@embroider/vite 1.0.0-alpha.1 (patch)

#### :bug: Bug Fix
* `@embroider/broccoli-side-watch`, `@embroider/reverse-exports`, `@embroider/vite`
  * [#2265](https://github.com/embroider-build/embroider/pull/2265) Fix package jsons ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### :house: Internal
* `@embroider/broccoli-side-watch`, `@embroider/core`, `@embroider/reverse-exports`, `@embroider/router`, `@embroider/vite`
  * [#2267](https://github.com/embroider-build/embroider/pull/2267) Fix release plan setup for main ([@mansona](https://github.com/mansona))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2025-02-12)

@embroider/addon-dev 8.0.0-alpha.0 (major)
@embroider/addon-shim 2.0.0-alpha.0 (major)
@embroider/babel-loader-9 4.0.0-alpha.0 (major)
@embroider/broccoli-side-watch 1.1.0-alpha.0 (minor)
@embroider/compat 4.0.0-alpha.0 (major)
@embroider/config-meta-loader 1.0.0-alpha.0 (major)
@embroider/core 4.0.0-alpha.0 (major)
@embroider/hbs-loader 4.0.0-alpha.0 (major)
@embroider/macros 1.17.0-alpha.0 (major)
@embroider/reverse-exports 0.1.1-alpha.0 (patch)
@embroider/router 3.0.0-alpha.0 (major)
@embroider/shared-internals 3.0.0-alpha.0 (major)
@embroider/template-tag-codemod 0.5.0-alpha.0 (minor)
@embroider/util 1.14.0-alpha.0 (minor)
@embroider/vite 1.0.0-alpha.0 (major)

#### :boom: Breaking Change
* `@embroider/compat`, `@embroider/test-scenarios`
  * [#2256](https://github.com/embroider-build/embroider/pull/2256) remove staticAddonTrees and staticAddonTestSupportTrees ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/core`, `@embroider/test-scenarios`
  * [#2246](https://github.com/embroider-build/embroider/pull/2246) remove static components, helpers, modifiers settings ([@mansona](https://github.com/mansona))
* `@embroider/addon-shim`, `@embroider/compat`, `@embroider/core`, `@embroider/shared-internals`, `@embroider/webpack`, `@embroider/test-scenarios`
  * [#2223](https://github.com/embroider-build/embroider/pull/2223) Remove app meta ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/core`, `@embroider/router`, `@embroider/shared-internals`, `addon-template`, `app-template`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2103](https://github.com/embroider-build/embroider/pull/2103) Clean up old AMD externals support ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/shared-internals`, `@embroider/webpack`, `@embroider/test-support`, `addon-template`, `app-template`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2102](https://github.com/embroider-build/embroider/pull/2102) User-controlled babel config ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/test-setup`, `addon-template`, `app-template`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2093](https://github.com/embroider-build/embroider/pull/2093) Disabling app rewriting ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `addon-template`, `app-template`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2092](https://github.com/embroider-build/embroider/pull/2092) Don't move index.html ([@ef4](https://github.com/ef4))
* `@embroider/core`, `@embroider/sample-transforms`, `addon-template`, `app-template`, `@embroider/test-fixtures`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2071](https://github.com/embroider-build/embroider/pull/2071) change blueprint to not need a synthesized test entrypoint ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/core`, `@embroider/test-support`, `addon-template`, `app-template`, `@embroider/test-fixtures`, `@embroider/test-scenarios`, `ts-app-template`
  * [#1957](https://github.com/embroider-build/embroider/pull/1957) Move responsibility of booting the app from Embroider internals to the Ember app ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/addon-dev`, `@embroider/test-scenarios`
  * [#1972](https://github.com/embroider-build/embroider/pull/1972) Hide base path from public URL of rollup-public-assets ([@simonihmig](https://github.com/simonihmig))
* `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/shared-internals`
  * [#1946](https://github.com/embroider-build/embroider/pull/1946) remove the ember-addon keyword from rewritten app ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/config-meta-loader`, `addon-template`, `app-template`, `@embroider/test-fixtures`, `@embroider/test-scenarios`, `ts-app-template`
  * [#1953](https://github.com/embroider-build/embroider/pull/1953) New config module - `storeConfigInMeta` ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/compat`, `@embroider/vite`, `addon-template`, `app-template`, `@embroider/test-scenarios`, `ts-app-template`
  * [#1836](https://github.com/embroider-build/embroider/pull/1836) Replace content-for using a Vite plugin ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/compat`, `@embroider/core`, `@embroider/vite`, `@embroider/webpack`
  * [#1794](https://github.com/embroider-build/embroider/pull/1794) Refactor the resolve function to be the only public api to module-resolver ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/core`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#1653](https://github.com/embroider-build/embroider/pull/1653) Refactor embroider-implicit-modules export pojo ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/macros`, `@embroider/webpack`, `@embroider/test-fixtures`, `@embroider/test-scenarios`
  * [#1692](https://github.com/embroider-build/embroider/pull/1692) force importSync to always be eager ([@mansona](https://github.com/mansona))

#### :rocket: Enhancement
* `@embroider/compat`
  * [#2255](https://github.com/embroider-build/embroider/pull/2255) throw an error if someone has set staticEmberSource=false ([@mansona](https://github.com/mansona))
  * [#2242](https://github.com/embroider-build/embroider/pull/2242) stop nullifying loader.js ([@mansona](https://github.com/mansona))
  * [#1923](https://github.com/embroider-build/embroider/pull/1923) Move testem support out of rewritten app ([@ef4](https://github.com/ef4))
  * [#1819](https://github.com/embroider-build/embroider/pull/1819) Add a new prebuild function with strict defaults ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/compat`, `addon-template`, `@embroider/test-fixtures`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2247](https://github.com/embroider-build/embroider/pull/2247) throw an error if anyone sets skipBabel ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/core`, `app-template-minimal`, `app-template`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2205](https://github.com/embroider-build/embroider/pull/2205) Add minimal app template ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `@embroider/compat`, `@embroider/vite`, `app-template`
  * [#2233](https://github.com/embroider-build/embroider/pull/2233) Add a builder API to @embroider/compat to support ember commands like `ember test` ([@mansona](https://github.com/mansona))
* `@embroider/template-tag-codemod`
  * [#2231](https://github.com/embroider-build/embroider/pull/2231) template-tag-codemod: add support for rendering tests ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/core`, `@embroider/template-tag-codemod`, `@embroider/test-scenarios`
  * [#2226](https://github.com/embroider-build/embroider/pull/2226) template-tag-codemod ([@ef4](https://github.com/ef4))
* `@embroider/core`, `@embroider/shared-internals`, `@embroider/vite`
  * [#2221](https://github.com/embroider-build/embroider/pull/2221) Move template-only component synthesis into core resolver ([@ef4](https://github.com/ef4))
* `@embroider/vite`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#2191](https://github.com/embroider-build/embroider/pull/2191) fix tests url ([@patricklx](https://github.com/patricklx))
* `@embroider/vite`
  * [#2195](https://github.com/embroider-build/embroider/pull/2195) read your browser targets from config/targets.js automatically ([@mansona](https://github.com/mansona))
  * [#2017](https://github.com/embroider-build/embroider/pull/2017) update vite to have a minimum version of 5.2 ([@mansona](https://github.com/mansona))
  * [#1834](https://github.com/embroider-build/embroider/pull/1834) add vite@5 to the peer deps of @embroider/vite ([@mansona](https://github.com/mansona))
  * [#1680](https://github.com/embroider-build/embroider/pull/1680) [vite] use transform instead of load for gjs & hbs files ([@patricklx](https://github.com/patricklx))
  * [#1704](https://github.com/embroider-build/embroider/pull/1704) add correct extensions to optimizeDeps() config ([@mansona](https://github.com/mansona))
* `@embroider/vite`, `app-template`, `@embroider/test-scenarios`
  * [#2187](https://github.com/embroider-build/embroider/pull/2187) bundle up vite plugins in a nicer way ([@mansona](https://github.com/mansona))
* `@embroider/addon-dev`, `@embroider/test-scenarios`
  * [#2156](https://github.com/embroider-build/embroider/pull/2156) Support other plugins in keepAssets ([@ef4](https://github.com/ef4))
  * [#1760](https://github.com/embroider-build/embroider/pull/1760) Add exclude option to appReexports and publicEntrypoints rollup plugins ([@simonihmig](https://github.com/simonihmig))
  * [#1642](https://github.com/embroider-build/embroider/pull/1642) Allow for more flexible addon-dev appReexports ([@krasnoukhov](https://github.com/krasnoukhov))
* `@embroider/core`, `@embroider/vite`, `addon-template`, `app-template`, `@embroider/test-fixtures`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2140](https://github.com/embroider-build/embroider/pull/2140) @embroider/core/test-support -> @embroider/virtual/test-support ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#2139](https://github.com/embroider-build/embroider/pull/2139) Rename vendor.* to be from @embroider/virtual instead of @embroider/core ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `@embroider/core`, `addon-template`, `app-template`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2131](https://github.com/embroider-build/embroider/pull/2131) Rename @embroider/core/entrypoint to @embroider/virtual/compat-modules ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#2006](https://github.com/embroider-build/embroider/pull/2006) Virtual entrypoint export modules ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/addon-dev`, `@embroider/shared-internals`, `@embroider/vite`, `@embroider/test-scenarios`
  * [#1855](https://github.com/embroider-build/embroider/pull/1855) addon-dev: incremental updates to output  ([@patricklx](https://github.com/patricklx))
* `@embroider/shared-internals`
  * [#2108](https://github.com/embroider-build/embroider/pull/2108) Adding forced v2 packages feature ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/core`, `@embroider/test-scenarios`
  * [#2104](https://github.com/embroider-build/embroider/pull/2104) Derive default resolver config ([@ef4](https://github.com/ef4))
  * [#1863](https://github.com/embroider-build/embroider/pull/1863) add isLazy to resolver config and streamline Engine interface ([@mansona](https://github.com/mansona))
  * [#1648](https://github.com/embroider-build/embroider/pull/1648) use package paths instead of relative paths for app tree resolving ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/core`, `@embroider/vite`, `@embroider/test-support`, `addon-template`, `app-template`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2100](https://github.com/embroider-build/embroider/pull/2100) Esbuild fixes ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/core`, `@embroider/shared-internals`, `addon-template`, `app-template`, `@embroider/test-fixtures`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2062](https://github.com/embroider-build/embroider/pull/2062) Keep app dir ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/core`, `@embroider/shared-internals`, `app-template`, `ts-app-template`
  * [#1936](https://github.com/embroider-build/embroider/pull/1936) remove auto-upgraded from app package.json and add a basic exports block ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/core`, `@embroider/shared-internals`, `@embroider/vite`, `@embroider/test-scenarios`
  * [#2028](https://github.com/embroider-build/embroider/pull/2028) Rename #embroider_compat/* to @embroider/virtual/* ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/compat`, `@embroider/core`, `@embroider/shared-internals`, `@embroider/vite`, `@embroider/test-support`, `addon-template`, `app-template`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2029](https://github.com/embroider-build/embroider/pull/2029) Reform extension searching and dep optimization ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/test-fixtures`, `@embroider/test-scenarios`
  * [#1966](https://github.com/embroider-build/embroider/pull/1966) New config module, warning message ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/compat`, `@embroider/core`, `@embroider/vite`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#1955](https://github.com/embroider-build/embroider/pull/1955) Remove template-only components compilation from Stage 2 ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1801](https://github.com/embroider-build/embroider/pull/1801) Module resolver: virtualize vendor.js ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/compat`, `@embroider/test-support`
  * [#1939](https://github.com/embroider-build/embroider/pull/1939) Output `_babel_filter_.js` in the `.embroider` folder ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/compat`, `@embroider/core`, `@embroider/vite`, `@embroider/test-support`, `addon-template`, `app-template`, `ts-app-template`
  * [#1935](https://github.com/embroider-build/embroider/pull/1935) output macros-config.json and _babel_config_ in the .embroider folder ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/compat`, `@embroider/core`
  * [#1933](https://github.com/embroider-build/embroider/pull/1933) Clean up compat app builder ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1924](https://github.com/embroider-build/embroider/pull/1924) virtualise test entrypoint ([@mansona](https://github.com/mansona))
  * [#1913](https://github.com/embroider-build/embroider/pull/1913) virtualise engine styles with their vendor styles ([@mansona](https://github.com/mansona))
  * [#1811](https://github.com/embroider-build/embroider/pull/1811) Module Resolver: Virtual test-support.css ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/compat`, `@embroider/core`, `@embroider/sample-transforms`, `addon-template`, `app-template`, `@embroider/test-fixtures`, `ts-app-template`
  * [#1926](https://github.com/embroider-build/embroider/pull/1926) New `index.html`- format test-entrypoint ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1920](https://github.com/embroider-build/embroider/pull/1920) New `index.html` format - `test-support.js` ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/compat`, `@embroider/core`, `@embroider/util`, `@embroider/sample-transforms`, `addon-template`, `app-template`, `@embroider/test-fixtures`, `@embroider/test-scenarios`, `ts-app-template`
  * [#1925](https://github.com/embroider-build/embroider/pull/1925) New `index.html` format - app css ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1922](https://github.com/embroider-build/embroider/pull/1922) New `index.html` format - entrypoint ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1921](https://github.com/embroider-build/embroider/pull/1921) New `index.html` format - `test-support.css`, `vendor.css` ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1918](https://github.com/embroider-build/embroider/pull/1918) New index.html format - vendor js ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/compat`, `@embroider/core`, `@embroider/shared-internals`, `@embroider/test-fixtures`, `@embroider/test-scenarios`
  * [#1779](https://github.com/embroider-build/embroider/pull/1779) Virtual entry point ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/core`, `@embroider/vite`, `@embroider/test-scenarios`
  * [#1805](https://github.com/embroider-build/embroider/pull/1805) Module resolver: virtualize vendor.css ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1739](https://github.com/embroider-build/embroider/pull/1739) support ts, gts and gjs in vite ([@patricklx](https://github.com/patricklx))
* `@embroider/macros`
  * [#1845](https://github.com/embroider-build/embroider/pull/1845) support import sync with dynamic expression ([@patricklx](https://github.com/patricklx))
* `@embroider/compat`, `@embroider/core`, `@embroider/vite`
  * [#1807](https://github.com/embroider-build/embroider/pull/1807) Module resolver: virtualize test-support.js ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1650](https://github.com/embroider-build/embroider/pull/1650) Add Esbuild resolver ([@mansona](https://github.com/mansona))
* `@embroider/shared-internals`, `@embroider/vite`
  * [#1846](https://github.com/embroider-build/embroider/pull/1846) Prevent query-params added by vite to be passed to core logic ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/vite`, `@embroider/test-scenarios`
  * [#1736](https://github.com/embroider-build/embroider/pull/1736) vite find assets & build copy assets ([@patricklx](https://github.com/patricklx))
  * [#1744](https://github.com/embroider-build/embroider/pull/1744) control ember build through vite ([@patricklx](https://github.com/patricklx))
* `@embroider/addon-dev`, `@embroider/vite`
  * [#1784](https://github.com/embroider-build/embroider/pull/1784) Bump content-tag and add inline_source_map option for rollup and vite ([@vstefanovic97](https://github.com/vstefanovic97))
* `@embroider/core`, `@embroider/hbs-loader`, `@embroider/vite`, `@embroider/webpack`
  * [#1763](https://github.com/embroider-build/embroider/pull/1763) Add new watches API ([@ef4](https://github.com/ef4))
* `@embroider/core`, `@embroider/vite`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#1718](https://github.com/embroider-build/embroider/pull/1718) vite test ci ([@patricklx](https://github.com/patricklx))
* `@embroider/core`, `@embroider/vite`, `@embroider/webpack`
  * [#1707](https://github.com/embroider-build/embroider/pull/1707) improved resolver logging ([@ef4](https://github.com/ef4))
* `@embroider/broccoli-side-watch`
  * [#1693](https://github.com/embroider-build/embroider/pull/1693) Add broccoli-side-watch package ([@balinterdi](https://github.com/balinterdi))

#### :bug: Bug Fix
* `@embroider/template-tag-codemod`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#2263](https://github.com/embroider-build/embroider/pull/2263) template-tag-codemod test coverage and robustness fixes ([@ef4](https://github.com/ef4))
* `@embroider/template-tag-codemod`
  * [#2261](https://github.com/embroider-build/embroider/pull/2261) Fix bug in import deduplication in template-tag-codemod ([@ef4](https://github.com/ef4))
* `@embroider/vite`
  * [#2260](https://github.com/embroider-build/embroider/pull/2260) Vite config overridability ([@ef4](https://github.com/ef4))
  * [#2192](https://github.com/embroider-build/embroider/pull/2192) Run compatPrebuild in a separate output directory ([@simonihmig](https://github.com/simonihmig))
  * [#2169](https://github.com/embroider-build/embroider/pull/2169) ensure its a file specifier ([@patricklx](https://github.com/patricklx))
  * [#2143](https://github.com/embroider-build/embroider/pull/2143) Vite hbs plugin should return resolutions ([@ef4](https://github.com/ef4))
  * [#1974](https://github.com/embroider-build/embroider/pull/1974) esbuild-resolver: handle relative imports in virtual files ([@ef4](https://github.com/ef4))
  * [#1898](https://github.com/embroider-build/embroider/pull/1898) content-for vite plugin missing in types ([@patricklx](https://github.com/patricklx))
  * [#1813](https://github.com/embroider-build/embroider/pull/1813) vite: fix hbs loading for virtual pair components ([@patricklx](https://github.com/patricklx))
  * [#1827](https://github.com/embroider-build/embroider/pull/1827) fix extension resolving for esbuild ([@mansona](https://github.com/mansona))
  * [#1816](https://github.com/embroider-build/embroider/pull/1816) Remove silent option from ember build in compatPrebuild ([@enspandi](https://github.com/enspandi))
  * [#1729](https://github.com/embroider-build/embroider/pull/1729) remove missing import from vite index ([@mansona](https://github.com/mansona))
  * [#1713](https://github.com/embroider-build/embroider/pull/1713) esbuild: fix babel config location ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/vite`, `@embroider/test-support`, `app-template`, `@embroider/test-fixtures`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2046](https://github.com/embroider-build/embroider/pull/2046) vite fix custom base url ([@patricklx](https://github.com/patricklx))
* `@embroider/addon-dev`, `@embroider/test-scenarios`
  * [#2235](https://github.com/embroider-build/embroider/pull/2235) Fix binary asset support in keepAssets ([@ef4](https://github.com/ef4))
  * [#2208](https://github.com/embroider-build/embroider/pull/2208) Watch previous detected files in publicEntrypoints plugin ([@patricklx](https://github.com/patricklx))
* `@embroider/core`, `@embroider/vite`, `@embroider/webpack`
  * [#2209](https://github.com/embroider-build/embroider/pull/2209) Eliminate 'ignored' case from module resolver ([@ef4](https://github.com/ef4))
* `@embroider/vite`, `@embroider/test-scenarios`
  * [#2163](https://github.com/embroider-build/embroider/pull/2163) fix missing vite build assets ([@patricklx](https://github.com/patricklx))
  * [#2178](https://github.com/embroider-build/embroider/pull/2178) Support esm babel plugins ([@ef4](https://github.com/ef4))
  * [#2110](https://github.com/embroider-build/embroider/pull/2110) fix issue with paired component between app and addon ([@patricklx](https://github.com/patricklx))
  * [#1852](https://github.com/embroider-build/embroider/pull/1852) vite fix hbs loader for v1 addons ([@patricklx](https://github.com/patricklx))
  * [#1795](https://github.com/embroider-build/embroider/pull/1795) fix vite build ([@patricklx](https://github.com/patricklx))
* `@embroider/compat`, `@embroider/core`
  * [#2179](https://github.com/embroider-build/embroider/pull/2179) removing unused functionality in default-pipeline ([@ef4](https://github.com/ef4))
* `@embroider/test-scenarios`, `ts-app-template`
  * [#2112](https://github.com/embroider-build/embroider/pull/2112) fix build with gts ([@patricklx](https://github.com/patricklx))
* `@embroider/core`, `@embroider/vite`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#2135](https://github.com/embroider-build/embroider/pull/2135) Capture new optimized deps ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/test-scenarios`
  * [#2106](https://github.com/embroider-build/embroider/pull/2106) add macros plugins with default config rather than no plugins at all ([@ef4](https://github.com/ef4))
* `@embroider/webpack`
  * [#2072](https://github.com/embroider-build/embroider/pull/2072) Follow upstream type change from webpack ([@ef4](https://github.com/ef4))
* `@embroider/core`, `@embroider/test-scenarios`
  * [#2053](https://github.com/embroider-build/embroider/pull/2053) fix for esbuild finding helpers and components from app-tree-merging in templates ([@mansona](https://github.com/mansona))
  * [#1900](https://github.com/embroider-build/embroider/pull/1900) vite: change ext-es format  ([@patricklx](https://github.com/patricklx))
* `@embroider/addon-shim`
  * [#1937](https://github.com/embroider-build/embroider/pull/1937) only register v2 addons with parent addons ([@mansona](https://github.com/mansona))
* `@embroider/compat`
  * [#1837](https://github.com/embroider-build/embroider/pull/1837) merge default options and the prebuild options provided in ember-cli-build ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/shared-internals`
  * [#1738](https://github.com/embroider-build/embroider/pull/1738) fix vite on windows ([@patricklx](https://github.com/patricklx))
* Other
  * [#1731](https://github.com/embroider-build/embroider/pull/1731) Vite fixes ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/core`, `@embroider/vite`, `@embroider/webpack`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#1686](https://github.com/embroider-build/embroider/pull/1686) Resolver bugfixes ([@mansona](https://github.com/mansona))

#### :memo: Documentation
* Other
  * [#1735](https://github.com/embroider-build/embroider/pull/1735) docs: Update addon-author-guide.md ([@johanrd](https://github.com/johanrd))
  * [#1791](https://github.com/embroider-build/embroider/pull/1791) docs(porting-addons-to-v2): Explain no-unpublished-required issue ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1772](https://github.com/embroider-build/embroider/pull/1772) Docs porting addons to v2 co location ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1775](https://github.com/embroider-build/embroider/pull/1775) Docs(peer deps resolution issues): mentions pnpm-dedupe and add links ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1768](https://github.com/embroider-build/embroider/pull/1768) docs(porting addons to v2): change the recommended package manager to pnpm ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1765](https://github.com/embroider-build/embroider/pull/1765) Docs(addon-author-guide)/ remove the out-of-date part about alternative to monorepos ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/macros`
  * [#1790](https://github.com/embroider-build/embroider/pull/1790) Update @embroider/macros README.md real-world examples ([@machty](https://github.com/machty))

#### :house: Internal
* `ts-app-template`
  * [#2262](https://github.com/embroider-build/embroider/pull/2262) Update ts-app-template to match app-template ([@ef4](https://github.com/ef4))
* `@embroider/addon-dev`, `@embroider/addon-shim`, `@embroider/babel-loader-9`, `@embroider/broccoli-side-watch`, `@embroider/compat`, `@embroider/config-meta-loader`, `@embroider/core`, `@embroider/hbs-loader`, `@embroider/macros`, `@embroider/reverse-exports`, `@embroider/router`, `@embroider/shared-internals`, `@embroider/template-tag-codemod`, `@embroider/test-setup`, `@embroider/util`, `@embroider/vite`, `@embroider/webpack`
  * [#2259](https://github.com/embroider-build/embroider/pull/2259) release-plan prerelease ([@mansona](https://github.com/mansona))
* Other
  * [#2258](https://github.com/embroider-build/embroider/pull/2258) update release-plan ([@mansona](https://github.com/mansona))
  * [#1992](https://github.com/embroider-build/embroider/pull/1992) add missing initiative sponsors to the Readme ([@mansona](https://github.com/mansona))
  * [#1973](https://github.com/embroider-build/embroider/pull/1973) Support corepack's packageManager field  ([@simonihmig](https://github.com/simonihmig))
  * [#1778](https://github.com/embroider-build/embroider/pull/1778) Fix failing addon-dev-js test on main ([@simonihmig](https://github.com/simonihmig))
  * [#1700](https://github.com/embroider-build/embroider/pull/1700) Merge stable into main ([@mansona](https://github.com/mansona))
* `@embroider/compat`
  * [#2254](https://github.com/embroider-build/embroider/pull/2254) Merge stable into main ([@mansona](https://github.com/mansona))
  * [#1984](https://github.com/embroider-build/embroider/pull/1984) narrow the audit exception for vite internals ([@ef4](https://github.com/ef4))
* `@embroider/vite`, `addon-template`, `app-template`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2239](https://github.com/embroider-build/embroider/pull/2239) Adding test coverage for vite 6 ([@ef4](https://github.com/ef4))
* `@embroider/test-scenarios`
  * [#2240](https://github.com/embroider-build/embroider/pull/2240) move tests/scenarios to a TS sub-project ([@mansona](https://github.com/mansona))
  * [#2099](https://github.com/embroider-build/embroider/pull/2099) Update test matrix ([@ef4](https://github.com/ef4))
  * [#2095](https://github.com/embroider-build/embroider/pull/2095) Update scenario-tester ([@ef4](https://github.com/ef4))
  * [#2094](https://github.com/embroider-build/embroider/pull/2094) make CommandWatcher dump logs at shutdown() when a command has failed ([@ef4](https://github.com/ef4))
  * [#2039](https://github.com/embroider-build/embroider/pull/2039) Fix/ static-app-test shouldn't trigger a build error `@babel/helper-modules-imports` not found ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#2043](https://github.com/embroider-build/embroider/pull/2043) Fix/ static-app-test shoudn't use an `isClassic` macro ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1947](https://github.com/embroider-build/embroider/pull/1947) fix babel config location in resolver tests ([@mansona](https://github.com/mansona))
  * [#1911](https://github.com/embroider-build/embroider/pull/1911) Fix CI because of recent babel-plugin-template-compiler update ([@mansona](https://github.com/mansona))
  * [#1890](https://github.com/embroider-build/embroider/pull/1890) Add more tests virtual files ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
  * [#1847](https://github.com/embroider-build/embroider/pull/1847) Refactor watch mode tests ([@ef4](https://github.com/ef4))
  * [#1817](https://github.com/embroider-build/embroider/pull/1817) pin ember-data to fix issue in CI ([@mansona](https://github.com/mansona))
  * [#1771](https://github.com/embroider-build/embroider/pull/1771) Simplify vite-app template ([@ef4](https://github.com/ef4))
  * [#1703](https://github.com/embroider-build/embroider/pull/1703) Disable chokidar polling override in tests ([@chancancode](https://github.com/chancancode))
* `@embroider/core`, `@embroider/vite`
  * [#2232](https://github.com/embroider-build/embroider/pull/2232) move @embroider/vite typescript build to a project reference ([@mansona](https://github.com/mansona))
* `@embroider/addon-dev`, `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/webpack`, `@embroider/test-scenarios`
  * [#2227](https://github.com/embroider-build/embroider/pull/2227) Merge stable into main ([@mansona](https://github.com/mansona))
* `@embroider/core`, `@embroider/vite`, `@embroider/webpack`
  * [#2216](https://github.com/embroider-build/embroider/pull/2216) Simplify virtual content rendering ([@ef4](https://github.com/ef4))
  * [#2197](https://github.com/embroider-build/embroider/pull/2197) Further simplify ModuleRequest API ([@ef4](https://github.com/ef4))
  * [#2188](https://github.com/embroider-build/embroider/pull/2188) Module request cleanup ([@ef4](https://github.com/ef4))
* `@embroider/core`, `@embroider/shared-internals`, `@embroider/vite`, `@embroider/webpack`, `@embroider/test-scenarios`
  * [#2198](https://github.com/embroider-build/embroider/pull/2198) Virtual response namespace unification ([@ef4](https://github.com/ef4))
* `@embroider/vite`
  * [#2206](https://github.com/embroider-build/embroider/pull/2206) fix lint ([@patricklx](https://github.com/patricklx))
* `@embroider/util`, `@embroider/sample-transforms`, `addon-template`, `app-template`, `ts-app-template`
  * [#2193](https://github.com/embroider-build/embroider/pull/2193) add --disable-gpu to testem.js for chrome ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/core`, `@embroider/hbs-loader`, `@embroider/macros`, `@embroider/vite`, `@embroider/webpack`, `@embroider/test-support`
  * [#2184](https://github.com/embroider-build/embroider/pull/2184) Updating @types/node ([@ef4](https://github.com/ef4))
* `@embroider/addon-dev`, `@embroider/core`, `app-template`, `@embroider/test-fixtures`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2176](https://github.com/embroider-build/embroider/pull/2176) Refloat canary ([@ef4](https://github.com/ef4))
* `app-template`, `@embroider/test-scenarios`
  * [#2175](https://github.com/embroider-build/embroider/pull/2175) Adjust ember-qunit versions in test suite ([@ef4](https://github.com/ef4))
  * [#1879](https://github.com/embroider-build/embroider/pull/1879) Delete vite app from test scenarios ([@mansona](https://github.com/mansona))
* `@embroider/addon-dev`, `@embroider/addon-shim`, `@embroider/broccoli-side-watch`, `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/shared-internals`, `@embroider/vite`, `@embroider/webpack`, `@embroider/test-support`, `@embroider/test-scenarios`, `ts-app-template`
  * [#2173](https://github.com/embroider-build/embroider/pull/2173) Merge stable into main ([@ef4](https://github.com/ef4))
* `@embroider/util`
  * [#2138](https://github.com/embroider-build/embroider/pull/2138) Delete unneeded util files ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `@embroider/sample-transforms`
  * [#2137](https://github.com/embroider-build/embroider/pull/2137) Delete test-packages/sample-transforms/tests ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `@embroider/addon-dev`, `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/shared-internals`, `@embroider/vite`, `@embroider/webpack`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#2124](https://github.com/embroider-build/embroider/pull/2124) moduleResolution nodenext ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/shared-internals`, `@embroider/util`, `@embroider/webpack`
  * [#2101](https://github.com/embroider-build/embroider/pull/2101) Merge stable ([@ef4](https://github.com/ef4))
* `@embroider/core`, `@embroider/reverse-exports`
  * [#2061](https://github.com/embroider-build/embroider/pull/2061) Adjusting reverse-exports API ([@ef4](https://github.com/ef4))
* `@embroider/addon-dev`, `@embroider/compat`, `@embroider/util`, `@embroider/sample-transforms`, `@embroider/test-support`, `addon-template`, `@embroider/test-scenarios`
  * [#2030](https://github.com/embroider-build/embroider/pull/2030) Merge stable ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/shared-internals`, `@embroider/webpack`, `@embroider/test-scenarios`
  * [#2008](https://github.com/embroider-build/embroider/pull/2008) Merge stable into main ([@mansona](https://github.com/mansona))
* `@embroider/unstable-release`
  * [#2004](https://github.com/embroider-build/embroider/pull/2004) use pnpm to publish unstable ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/shared-internals`, `@embroider/sample-transforms`
  * [#1996](https://github.com/embroider-build/embroider/pull/1996) Merge stable into main ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `addon-template`, `app-template`, `@embroider/test-scenarios`, `ts-app-template`
  * [#1985](https://github.com/embroider-build/embroider/pull/1985) Move rewritten app to ./tmp ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/webpack`, `@embroider/test-fixtures`, `@embroider/test-scenarios`
  * [#1983](https://github.com/embroider-build/embroider/pull/1983) Merge stable into Main ([@mansona](https://github.com/mansona))
* `@embroider/config-meta-loader`
  * [#1954](https://github.com/embroider-build/embroider/pull/1954) reset version of config-meta-loader to 0.0.0 ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/router`, `@embroider/shared-internals`, `@embroider/webpack`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#1952](https://github.com/embroider-build/embroider/pull/1952) Merge stable into Main ([@mansona](https://github.com/mansona))
* `@embroider/addon-shim`
  * [#1943](https://github.com/embroider-build/embroider/pull/1943) Merge stable into main ([@mansona](https://github.com/mansona))
* `app-template`
  * [#1934](https://github.com/embroider-build/embroider/pull/1934) Update app-template ([@ef4](https://github.com/ef4))
* `@embroider/core`
  * [#1927](https://github.com/embroider-build/embroider/pull/1927) simplify virtual entrypoint ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#1919](https://github.com/embroider-build/embroider/pull/1919) improve audit tests ([@patricklx](https://github.com/patricklx))
  * [#1882](https://github.com/embroider-build/embroider/pull/1882) Splitting reusable module visitor out of Audit ([@ef4](https://github.com/ef4))
* `@embroider/addon-shim`, `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/router`, `@embroider/util`, `@embroider/test-scenarios`
  * [#1917](https://github.com/embroider-build/embroider/pull/1917) Merge stable into main ([@mansona](https://github.com/mansona))
* `@embroider/util`, `addon-template`
  * [#1912](https://github.com/embroider-build/embroider/pull/1912) update all github actions to remove warnings about node version ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/test-support`
  * [#1895](https://github.com/embroider-build/embroider/pull/1895) adding new http-audit test support ([@ef4](https://github.com/ef4))
* `@embroider/addon-dev`, `@embroider/addon-shim`, `@embroider/compat`, `@embroider/core`, `@embroider/hbs-loader`, `@embroider/macros`, `@embroider/router`, `@embroider/shared-internals`, `@embroider/util`, `@embroider/webpack`, `@embroider/test-scenarios`, `ts-app-template`
  * [#1899](https://github.com/embroider-build/embroider/pull/1899) typescript upgrade ([@ef4](https://github.com/ef4))
* `@embroider/addon-dev`, `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/test-setup`, `@embroider/webpack`, `@embroider/test-fixtures`, `@embroider/test-scenarios`
  * [#1886](https://github.com/embroider-build/embroider/pull/1886) Merge stable into main ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/test-scenarios`
  * [#1881](https://github.com/embroider-build/embroider/pull/1881) Cleanup stage2 emitting of synthesized styles ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/vite`, `app-template`, `@embroider/test-scenarios`
  * [#1859](https://github.com/embroider-build/embroider/pull/1859) Public assets handling/ clean up stage 2 ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/vite`, `addon-template`, `@embroider/test-scenarios`
  * [#1877](https://github.com/embroider-build/embroider/pull/1877) Command Watcher ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/addon-dev`, `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/shared-internals`, `@embroider/util`, `@embroider/webpack`, `@embroider/test-scenarios`
  * [#1872](https://github.com/embroider-build/embroider/pull/1872) Merge stable ([@mansona](https://github.com/mansona))
* `addon-template`, `@embroider/test-fixtures`
  * [#1864](https://github.com/embroider-build/embroider/pull/1864) Make the addon-template use vite ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/addon-shim`, `@embroider/compat`, `@embroider/core`, `@embroider/test-setup`, `@embroider/vite`, `app-template`, `@embroider/test-fixtures`, `@embroider/test-scenarios`, `ts-app-template`
  * [#1840](https://github.com/embroider-build/embroider/pull/1840) Use Vite for all tests ([@mansona](https://github.com/mansona))
* `@embroider/addon-dev`, `@embroider/compat`, `@embroider/core`, `@embroider/macros`, `@embroider/shared-internals`, `@embroider/webpack`
  * [#1825](https://github.com/embroider-build/embroider/pull/1825) Merge stable into main ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/core`, `@embroider/shared-internals`, `@embroider/test-scenarios`
  * [#1782](https://github.com/embroider-build/embroider/pull/1782) Merge stable into main ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/macros`, `@embroider/test-scenarios`
  * [#1714](https://github.com/embroider-build/embroider/pull/1714) update scenario-tester ([@mansona](https://github.com/mansona))
* `@embroider/test-support`, `@embroider/test-scenarios`
  * [#1740](https://github.com/embroider-build/embroider/pull/1740) enable vite windows tests ([@patricklx](https://github.com/patricklx))
* `@embroider/core`, `@embroider/vite`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#1718](https://github.com/embroider-build/embroider/pull/1718) vite test ci ([@patricklx](https://github.com/patricklx))
* `@embroider/addon-dev`, `@embroider/compat`, `@embroider/core`, `@embroider/macros`
  * [#1723](https://github.com/embroider-build/embroider/pull/1723) Sync stable->main ([@ef4](https://github.com/ef4))
* `@embroider/addon-dev`, `@embroider/compat`
  * [#1721](https://github.com/embroider-build/embroider/pull/1721) Merge stable into main ([@mansona](https://github.com/mansona))
* `@embroider/addon-dev`
  * [#1697](https://github.com/embroider-build/embroider/pull/1697) Hide base path from public URL of rollup-public-assets ([@simonihmig](https://github.com/simonihmig))
* `@embroider/macros`
  * [#1712](https://github.com/embroider-build/embroider/pull/1712) Merge stable ([@ef4](https://github.com/ef4))
* `@embroider/compat`, `@embroider/shared-internals`
  * [#1691](https://github.com/embroider-build/embroider/pull/1691) Move fix for @ember-data/debug into virtualPeerDeps ([@mansona](https://github.com/mansona))

#### Committers: 13
- Alex Matchneer ([@machty](https://github.com/machty))
- Andreas Minnich ([@enspandi](https://github.com/enspandi))
- Balint Erdi ([@balinterdi](https://github.com/balinterdi))
- Chris Manson ([@mansona](https://github.com/mansona))
- Dmitry Krasnoukhov ([@krasnoukhov](https://github.com/krasnoukhov))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Godfrey Chan ([@chancancode](https://github.com/chancancode))
- Marine Dunstetter ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
- Patrick Pircher ([@patricklx](https://github.com/patricklx))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- Vuk ([@vstefanovic97](https://github.com/vstefanovic97))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)
- [@johanrd](https://github.com/johanrd)

## Release (2025-01-07)

@embroider/compat 3.8.0 (minor)
@embroider/core 3.5.0 (minor)

#### :rocket: Enhancement
* `@embroider/compat`, `@embroider/core`, `@embroider/test-scenarios`
  * [#2210](https://github.com/embroider-build/embroider/pull/2210) Deprecate staticHelpers, staticModifiers, and staticComponents in favour of staticInvokables  ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2024-12-20)

@embroider/webpack 4.0.9 (patch)

#### :bug: Bug Fix
* `@embroider/webpack`
  * [#2220](https://github.com/embroider-build/embroider/pull/2220) Set MiniCssExtractPlugin ignoreOrder to true for default config ([@lfloyd117](https://github.com/lfloyd117))

#### Committers: 1
- Liam Floyd ([@lfloyd117](https://github.com/lfloyd117))

## Release (2024-12-19)

@embroider/addon-dev 7.1.1 (patch)

#### :bug: Bug Fix
* `@embroider/addon-dev`
  * [#2217](https://github.com/embroider-build/embroider/pull/2217) Fix declarations plugin to cover import() ([@simonihmig](https://github.com/simonihmig))

#### Committers: 1
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))

## Release (2024-12-16)

@embroider/addon-dev 7.1.0 (minor)
@embroider/compat 3.7.1 (patch)
@embroider/core 3.4.20 (patch)
@embroider/macros 1.16.10 (patch)

#### :rocket: Enhancement
* `@embroider/addon-dev`
  * [#2200](https://github.com/embroider-build/embroider/pull/2200) Add rollup declarations plugin ([@simonihmig](https://github.com/simonihmig))

#### :house: Internal
* `@embroider/sample-transforms`, `@embroider/test-fixtures`, `@embroider/test-scenarios`
  * [#2204](https://github.com/embroider-build/embroider/pull/2204) Fix stable ([@simonihmig](https://github.com/simonihmig))
* `@embroider/macros`
  * [#2201](https://github.com/embroider-build/embroider/pull/2201) Fix type error on stable ([@simonihmig](https://github.com/simonihmig))

#### Committers: 1
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))

## Release (2024-11-11)

@embroider/addon-dev 7.0.0 (major)

#### :boom: Breaking Change
* `@embroider/addon-dev`
  * [#2166](https://github.com/embroider-build/embroider/pull/2166) Fix gjs/gts sourcemaps -- we accidentally unlocked really good DX ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 1
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2024-11-05)

@embroider/compat 3.7.0 (minor)

#### :rocket: Enhancement
* `@embroider/compat`
  * [#2164](https://github.com/embroider-build/embroider/pull/2164) Support v2 ember-source ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2024-10-31)

@embroider/addon-shim 1.9.0 (minor)

#### :rocket: Enhancement
* `@embroider/addon-shim`
  * [#2158](https://github.com/embroider-build/embroider/pull/2158) Add a new option for addon-shim to pass config to ember-auto-import ([@ef4](https://github.com/ef4))

#### :house: Internal
* `@embroider/test-scenarios`, `ts-app-template`
  * [#2159](https://github.com/embroider-build/embroider/pull/2159) pinning @types/qunit to fix ci ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2024-10-09)

@embroider/compat 3.6.5 (patch)
@embroider/core 3.4.19 (patch)
@embroider/macros 1.16.9 (patch)
@embroider/shared-internals 2.8.1 (patch)
@embroider/webpack 4.0.8 (patch)

#### :bug: Bug Fix
* `@embroider/shared-internals`
  * [#2151](https://github.com/embroider-build/embroider/pull/2151) Fix hbs plugin not resolving .hbs due to broken Regex ([@simonihmig](https://github.com/simonihmig))

#### Committers: 1
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))

## Release (2024-10-09)

@embroider/broccoli-side-watch 1.0.1 (patch)

#### :bug: Bug Fix
* `@embroider/broccoli-side-watch`
  * [#2148](https://github.com/embroider-build/embroider/pull/2148) Fix broken default export when required from CJS ([@simonihmig](https://github.com/simonihmig))

#### Committers: 1
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))

## Release (2024-10-09)

@embroider/addon-dev 6.0.1 (patch)
@embroider/broccoli-side-watch 1.0.0 (major)
@embroider/compat 3.6.4 (patch)
@embroider/core 3.4.18 (patch)
@embroider/macros 1.16.8 (patch)
@embroider/shared-internals 2.8.0 (minor)
@embroider/webpack 4.0.7 (patch)

#### :boom: Breaking Change
* `@embroider/broccoli-side-watch`
  * [#2146](https://github.com/embroider-build/embroider/pull/2146) Fix broccoli-side-watch so release-plan will release as 1.0.0 ([@simonihmig](https://github.com/simonihmig))

#### :rocket: Enhancement
* `@embroider/broccoli-side-watch`, `@embroider/shared-internals`
  * [#2141](https://github.com/embroider-build/embroider/pull/2141) Add better broccoli-side-watch package ([@simonihmig](https://github.com/simonihmig))

#### :bug: Bug Fix
* `@embroider/addon-dev`, `@embroider/test-scenarios`
  * [#2136](https://github.com/embroider-build/embroider/pull/2136) Enforce correct plugin order in addon-dev  ([@simonihmig](https://github.com/simonihmig))

#### Committers: 1
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))

## Release (2024-10-08)

@embroider/compat 3.6.3 (patch)

#### :bug: Bug Fix
* `@embroider/compat`, `@embroider/test-scenarios`
  * [#2133](https://github.com/embroider-build/embroider/pull/2133) fix typescript support for codemod and add option for renaming elements ([@void-mAlex](https://github.com/void-mAlex))
  * [#2120](https://github.com/embroider-build/embroider/pull/2120) fix gts in v1 addons ([@patricklx](https://github.com/patricklx))

#### :house: Internal
* `@embroider/test-scenarios`
  * [#2142](https://github.com/embroider-build/embroider/pull/2142) fixing test suite for ember >= 6 ([@ef4](https://github.com/ef4))

#### Committers: 3
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Patrick Pircher ([@patricklx](https://github.com/patricklx))

## Release (2024-10-01)

@embroider/addon-dev 6.0.0 (major)
@embroider/compat 3.6.2 (patch)
@embroider/core 3.4.17 (patch)
@embroider/macros 1.16.7 (patch)
@embroider/shared-internals 2.7.0 (minor)
@embroider/vite 0.2.1 (patch)
@embroider/webpack 4.0.6 (patch)

#### :boom: Breaking Change
* `@embroider/addon-dev`, `@embroider/test-scenarios`
  * [#2082](https://github.com/embroider-build/embroider/pull/2082) Hide base path from public URL of rollup-public-assets ([@simonihmig](https://github.com/simonihmig))

#### :rocket: Enhancement
* `@embroider/addon-dev`, `@embroider/shared-internals`, `@embroider/test-scenarios`
  * [#2121](https://github.com/embroider-build/embroider/pull/2121) backport #1855 addon-dev: incremental updates to output ([@patricklx](https://github.com/patricklx))

#### :bug: Bug Fix
* `@embroider/compat`, `@embroider/core`, `@embroider/vite`, `@embroider/webpack`, `@embroider/test-scenarios`
  * [#2127](https://github.com/embroider-build/embroider/pull/2127) Bump jsdom to fix punycode deprecation messages from tr46, psl, and whatwg-url ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `@embroider/shared-internals`, `@embroider/test-scenarios`
  * [#2122](https://github.com/embroider-build/embroider/pull/2122) speedup windows ci on stable ([@patricklx](https://github.com/patricklx))

#### Committers: 3
- Patrick Pircher ([@patricklx](https://github.com/patricklx))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2024-09-20)

@embroider/core 3.4.16 (patch)

#### :bug: Bug Fix
* `@embroider/core`, `@embroider/test-scenarios`
  * [#2088](https://github.com/embroider-build/embroider/pull/2088) Implement ember's component-template-resolving deprecation ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2024-08-30)

@embroider/compat 3.6.1 (patch)
@embroider/core 3.4.15 (patch)
@embroider/macros 1.16.6 (patch)
@embroider/shared-internals 2.6.3 (patch)
@embroider/webpack 4.0.5 (patch)

#### :bug: Bug Fix
* `@embroider/shared-internals`
  * [#2075](https://github.com/embroider-build/embroider/pull/2075) Update ember standard modules to include @ember/renderer and @ember/-internals and ember-testing ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `@embroider/compat`
  * [#2067](https://github.com/embroider-build/embroider/pull/2067) codemod fixes ([@void-mAlex](https://github.com/void-mAlex))

#### :memo: Documentation
* [#2055](https://github.com/embroider-build/embroider/pull/2055) document templateTagCodemod usage ([@void-mAlex](https://github.com/void-mAlex))

#### :house: Internal
* `@embroider/webpack`
  * [#2076](https://github.com/embroider-build/embroider/pull/2076) [Stable]: Follow upstream type change from webpack ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* Other
  * [#2058](https://github.com/embroider-build/embroider/pull/2058) Set the packageManager field ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 2
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2024-07-18)

@embroider/compat 3.6.0 (minor)

#### :rocket: Enhancement
* `@embroider/compat`, `@embroider/test-scenarios`
  * [#1842](https://github.com/embroider-build/embroider/pull/1842) [beta] template-tag code mod ([@void-mAlex](https://github.com/void-mAlex))

#### Committers: 1
- Alex ([@void-mAlex](https://github.com/void-mAlex))

## Release (2024-07-16)

@embroider/compat 3.5.7 (patch)
@embroider/util 1.13.2 (patch)

#### :bug: Bug Fix
* `@embroider/compat`
  * [#2033](https://github.com/embroider-build/embroider/pull/2033) Remove deprecations warnings in resolver transform ([@mkszepp](https://github.com/mkszepp))
  * [#2047](https://github.com/embroider-build/embroider/pull/2047) Add semver to power select with create ([@mkszepp](https://github.com/mkszepp))

#### :house: Internal
* `@embroider/test-scenarios`
  * [#1930](https://github.com/embroider-build/embroider/pull/1930) create a smoke test for the widest possible matrix ([@mansona](https://github.com/mansona))
* Other
  * [#2015](https://github.com/embroider-build/embroider/pull/2015) update github actions ([@mansona](https://github.com/mansona))
* `@embroider/util`, `@embroider/sample-transforms`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#1931](https://github.com/embroider-build/embroider/pull/1931) update scenario-tester ([@mansona](https://github.com/mansona))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- Markus Sanin ([@mkszepp](https://github.com/mkszepp))

## Release (2024-07-03)

@embroider/compat 3.5.6 (patch)

#### :bug: Bug Fix
* `@embroider/compat`
  * [#2012](https://github.com/embroider-build/embroider/pull/2012) Empty packages as valid v2 addons ([@BlueCutOfficial](https://github.com/BlueCutOfficial))

#### Committers: 1
- Marine Dunstetter ([@BlueCutOfficial](https://github.com/BlueCutOfficial))

## Release (2024-06-27)

@embroider/addon-dev 5.0.0 (major)

#### :boom: Breaking Change
* `@embroider/addon-dev`
  * [#2007](https://github.com/embroider-build/embroider/pull/2007) Add just the necessary files to rollup watch mode ([@vstefanovic97](https://github.com/vstefanovic97))

#### Committers: 1
- Vuk ([@vstefanovic97](https://github.com/vstefanovic97))

## Release (2024-06-24)

@embroider/compat 3.5.5 (patch)
@embroider/core 3.4.14 (patch)
@embroider/macros 1.16.5 (patch)
@embroider/shared-internals 2.6.2 (patch)
@embroider/webpack 4.0.4 (patch)

#### :bug: Bug Fix
* `@embroider/compat`, `@embroider/test-scenarios`
  * [#2005](https://github.com/embroider-build/embroider/pull/2005) unique-id helper import based on ember-source version ([@void-mAlex](https://github.com/void-mAlex))

#### :house: Internal
* `@embroider/shared-internals`
  * [#2000](https://github.com/embroider-build/embroider/pull/2000) Update typescript and fix issues with Typescript 5.5 ([@mansona](https://github.com/mansona))

#### Committers: 2
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2024-06-20)

@embroider/compat 3.5.4 (patch)
@embroider/core 3.4.13 (patch)
@embroider/macros 1.16.4 (patch)

#### :bug: Bug Fix
* `@embroider/macros`
  * [#1994](https://github.com/embroider-build/embroider/pull/1994) MacrosConfig should sync globalConfigs between copies ([@ef4](https://github.com/ef4))

#### :house: Internal
* [#1993](https://github.com/embroider-build/embroider/pull/1993) update node to latest LTS for CI ([@mansona](https://github.com/mansona))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2024-06-13)

@embroider/compat 3.5.3 (patch)
@embroider/core 3.4.12 (patch)

#### :bug: Bug Fix
* `@embroider/compat`, `@embroider/core`, `@embroider/sample-transforms`
  * [#1969](https://github.com/embroider-build/embroider/pull/1969) Update `fast-sourcemap-concat` to remove dependency `lodash.template` for consumer apps (security vulnerability) ([@mkszepp](https://github.com/mkszepp))

#### Committers: 1
- Markus Sanin ([@mkszepp](https://github.com/mkszepp))

## Release (2024-06-12)

@embroider/webpack 4.0.3 (patch)

#### :bug: Bug Fix
* `@embroider/webpack`
  * [#1981](https://github.com/embroider-build/embroider/pull/1981) Revert "Webpack: close the compiler" ([@krasnoukhov](https://github.com/krasnoukhov))

#### Committers: 1
- Dmitry Krasnoukhov ([@krasnoukhov](https://github.com/krasnoukhov))

## Release (2024-06-11)

@embroider/compat 3.5.2 (patch)
@embroider/core 3.4.11 (patch)
@embroider/macros 1.16.3 (patch)
@embroider/webpack 4.0.2 (patch)

#### :bug: Bug Fix
* `@embroider/macros`
  * [#1967](https://github.com/embroider-build/embroider/pull/1967) Address these issues in new apps (5.9): ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `@embroider/webpack`
  * [#1978](https://github.com/embroider-build/embroider/pull/1978) Webpack: close the compiler ([@ef4](https://github.com/ef4))
* `@embroider/macros`, `@embroider/test-fixtures`
  * [#1977](https://github.com/embroider-build/embroider/pull/1977) Fix modifier removal for "unless (macroCondition ...)" ([@ef4](https://github.com/ef4))
* `@embroider/macros`, `@embroider/test-fixtures`, `@embroider/test-scenarios`
  * [#1975](https://github.com/embroider-build/embroider/pull/1975) Stop using "#with" in macro tests ([@ef4](https://github.com/ef4))

#### Committers: 2
- Edward Faulkner ([@ef4](https://github.com/ef4))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2024-05-29)

@embroider/router 2.1.8 (patch)

#### :bug: Bug Fix
* `@embroider/router`
  * [#1945](https://github.com/embroider-build/embroider/pull/1945) avoid loading of lazy engines when generating linkto urls for routes ([@void-mAlex](https://github.com/void-mAlex))

#### Committers: 1
- Alex ([@void-mAlex](https://github.com/void-mAlex))

## Release (2024-05-29)

@embroider/compat 3.5.1 (patch)
@embroider/core 3.4.10 (patch)
@embroider/macros 1.16.2 (patch)
@embroider/shared-internals 2.6.1 (patch)
@embroider/webpack 4.0.1 (patch)

#### :bug: Bug Fix
* `@embroider/shared-internals`, `@embroider/test-support`, `@embroider/test-scenarios`
  * [#1949](https://github.com/embroider-build/embroider/pull/1949) Fix ownerOfFile bug on windows ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2024-05-22)

@embroider/addon-shim 1.8.9 (patch)

#### :bug: Bug Fix
* `@embroider/addon-shim`
  * [#1940](https://github.com/embroider-build/embroider/pull/1940) only register v2 addons with parent addons ([@mansona](https://github.com/mansona))

#### :house: Internal
* [#1938](https://github.com/embroider-build/embroider/pull/1938) remove v* prefix GitHub Actions builds ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2024-05-08)

@embroider/addon-shim 1.8.8 (patch)
@embroider/compat 3.5.0 (minor)
@embroider/router 2.1.7 (patch)

#### :rocket: Enhancement
* `@embroider/compat`
  * [#1907](https://github.com/embroider-build/embroider/pull/1907) Make ember-source compat adapter tolerant of upcoming ember-source changes ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix
* `@embroider/router`
  * [#1904](https://github.com/embroider-build/embroider/pull/1904) Fix getRoute override ([@jembezmamy](https://github.com/jembezmamy))
* `@embroider/addon-shim`
  * [#1901](https://github.com/embroider-build/embroider/pull/1901) [addon-shim]: Narrowed down broccoli trees for optimized file watching ([@simonihmig](https://github.com/simonihmig))

#### :house: Internal
* `@embroider/test-scenarios`
  * [#1908](https://github.com/embroider-build/embroider/pull/1908) update tests to follow newer babel-plugin-ember-template-compiilation ([@ef4](https://github.com/ef4))

#### Committers: 3
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Paweł Bator ([@jembezmamy](https://github.com/jembezmamy))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))

## Release (2024-04-30)

@embroider/compat 3.4.9 (patch)
@embroider/core 3.4.9 (patch)
@embroider/macros 1.16.1 (patch)
@embroider/util 1.13.1 (patch)

#### :bug: Bug Fix
* `@embroider/macros`, `@embroider/util`
  * [#1891](https://github.com/embroider-build/embroider/pull/1891) Revert "Update to `ember-cli-babel` v8" ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2024-04-18)

@embroider/compat 3.4.8 (patch)
@embroider/core 3.4.8 (patch)
@embroider/macros 1.16.0 (minor)
@embroider/test-setup 4.0.0 (major)
@embroider/webpack 4.0.0 (major)

#### :boom: Breaking Change
* `@embroider/webpack`
  * [#1868](https://github.com/embroider-build/embroider/pull/1868) Adjusting `@embroider/webpack` to use `@babel/preset-env` to avoid critical security audit ([@lupestro](https://github.com/lupestro))

#### :rocket: Enhancement
* `@embroider/macros`, `@embroider/test-fixtures`
  * [#1858](https://github.com/embroider-build/embroider/pull/1858) Add support for `{{unless}}` to the `macroCondition` macro ([@Windvis](https://github.com/Windvis))

#### :bug: Bug Fix
* `@embroider/core`, `@embroider/test-scenarios`
  * [#1885](https://github.com/embroider-build/embroider/pull/1885) Fix pre support in portable babel launcher ([@ef4](https://github.com/ef4))

#### Committers: 3
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Ralph Mack ([@lupestro](https://github.com/lupestro))
- Sam Van Campenhout ([@Windvis](https://github.com/Windvis))

## Release (2024-04-10)

@embroider/addon-dev 4.3.1 (patch)

#### :bug: Bug Fix
* `@embroider/addon-dev`, `@embroider/test-scenarios`
  * [#1874](https://github.com/embroider-build/embroider/pull/1874) with namespace in publicAssets don't include path ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2024-04-10)

@embroider/addon-dev 4.3.0 (minor)
@embroider/compat 3.4.7 (patch)
@embroider/core 3.4.7 (patch)
@embroider/macros 1.15.1 (patch)
@embroider/shared-internals 2.6.0 (minor)
@embroider/webpack 3.2.3 (patch)

#### :rocket: Enhancement
* `@embroider/addon-dev`, `@embroider/shared-internals`, `@embroider/test-scenarios`
  * [#1856](https://github.com/embroider-build/embroider/pull/1856) Compile Hbs route templates correctly ([@BlueCutOfficial](https://github.com/BlueCutOfficial))
* `@embroider/addon-dev`, `@embroider/test-scenarios`
  * [#1867](https://github.com/embroider-build/embroider/pull/1867) add a namespace option for public-assets plugin ([@mansona](https://github.com/mansona))

#### :house: Internal
* Other
  * [#1871](https://github.com/embroider-build/embroider/pull/1871) fix release-plan unlabelled changes PR ([@mansona](https://github.com/mansona))
  * [#1869](https://github.com/embroider-build/embroider/pull/1869) update release plan ([@mansona](https://github.com/mansona))
* `@embroider/compat`, `@embroider/test-scenarios`
  * [#1806](https://github.com/embroider-build/embroider/pull/1806) resolver transform to emit imports for helper and modifiers that need… ([@void-mAlex](https://github.com/void-mAlex))

#### Committers: 3
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- Chris Manson ([@mansona](https://github.com/mansona))
- Marine Dunstetter ([@BlueCutOfficial](https://github.com/BlueCutOfficial))

## Release (2024-03-07)

@embroider/compat 3.4.6 (patch)
@embroider/core 3.4.6 (patch)
@embroider/macros 1.15.0 (minor)
@embroider/util 1.13.0 (minor)

#### :rocket: Enhancement
* `@embroider/macros`, `@embroider/util`
  * [#1832](https://github.com/embroider-build/embroider/pull/1832) Update to `ember-cli-babel` v8 ([@bertdeblock](https://github.com/bertdeblock))

#### :bug: Bug Fix
* `@embroider/macros`
  * [#1838](https://github.com/embroider-build/embroider/pull/1838) make sure @embroider/macros doesn't try to load a babel config ([@mansona](https://github.com/mansona))

#### Committers: 2
- Bert De Block ([@bertdeblock](https://github.com/bertdeblock))
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2024-02-28)

@embroider/compat 3.4.5 (patch)
@embroider/core 3.4.5 (patch)
@embroider/macros 1.14.0 (minor)

#### :rocket: Enhancement
* `@embroider/macros`
  * [#1815](https://github.com/embroider-build/embroider/pull/1815) Make macro configs static ([@simonihmig](https://github.com/simonihmig))

#### :house: Internal
* Other
  * [#1824](https://github.com/embroider-build/embroider/pull/1824) update release-plan ([@mansona](https://github.com/mansona))
* `@embroider/test-scenarios`
  * [#1820](https://github.com/embroider-build/embroider/pull/1820) [stable] Pin ember-data to fix issue in CI ([@simonihmig](https://github.com/simonihmig))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
## Release (2024-02-05)

@embroider/addon-dev 4.2.1 (patch)

#### :bug: Bug Fix
* `@embroider/addon-dev`
  * [#1787](https://github.com/embroider-build/embroider/pull/1787) Fix source map option not being passed to plugin ([@vstefanovic97](https://github.com/vstefanovic97))

#### Committers: 1
- Vuk ([@vstefanovic97](https://github.com/vstefanovic97))
## Release (2024-02-01)

@embroider/addon-dev 4.2.0 (minor)
@embroider/compat 3.4.4 (patch)
@embroider/core 3.4.4 (patch)
@embroider/macros 1.13.5 (patch)
@embroider/shared-internals 2.5.2 (patch)
@embroider/webpack 3.2.2 (patch)

#### :rocket: Enhancement
* `@embroider/addon-dev`, `@embroider/test-scenarios`
  * [#1785](https://github.com/embroider-build/embroider/pull/1785) Backport #1760 to stable: Add exclude option to appReexports and publicEntrypoints rollup plugins ([@simonihmig](https://github.com/simonihmig))
  * [#1777](https://github.com/embroider-build/embroider/pull/1777) Backport #1642 to stable:  Allow for more flexible addon-dev appReexports ([@simonihmig](https://github.com/simonihmig))

#### :bug: Bug Fix
* `@embroider/core`, `@embroider/shared-internals`, `@embroider/test-scenarios`
  * [#1762](https://github.com/embroider-build/embroider/pull/1762) Fix incorrect ownerOfFile at root of filesystem ([@ef4](https://github.com/ef4))
* `@embroider/shared-internals`
  * [#1758](https://github.com/embroider-build/embroider/pull/1758) Make template-colocation-plugin idempotent ([@ef4](https://github.com/ef4))

#### :house: Internal
* `@embroider/test-scenarios`
  * [#1781](https://github.com/embroider-build/embroider/pull/1781) Fix failing addon-dev-js test on stable ([@simonihmig](https://github.com/simonihmig))

#### Committers: 2
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
## Release (2023-12-23)

@embroider/compat 3.4.3 (patch)

#### :bug: Bug Fix
* `@embroider/compat`, `@types/ember-cli`
  * [#1743](https://github.com/embroider-build/embroider/pull/1743) Don't rely on htmlbars internals ([@ef4](https://github.com/ef4))

#### :house: Internal
* [#1724](https://github.com/embroider-build/embroider/pull/1724) fix publish for stable branch ([@mansona](https://github.com/mansona))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
## Release (2023-12-13)

@embroider/compat 3.4.2 (patch)

#### :bug: Bug Fix
* `@embroider/compat`
  * [#1717](https://github.com/embroider-build/embroider/pull/1717) Always load ember-testing package eagerly ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))
## Release (2023-12-13)

@embroider/addon-dev 4.1.3 (patch)
@embroider/compat 3.4.1 (patch)
@embroider/core 3.4.3 (patch)
@embroider/macros 1.13.4 (patch)

#### :bug: Bug Fix
* `@embroider/macros`
  * [#1688](https://github.com/embroider-build/embroider/pull/1688) Fix branch elimination for `macroDependencySatisfies` ([@mike-engel](https://github.com/mike-engel))
* `@embroider/compat`
  * [#1706](https://github.com/embroider-build/embroider/pull/1706) Support engine's lazyLoading boolean config ([@fengb](https://github.com/fengb))
* `@embroider/addon-dev`
  * [#1696](https://github.com/embroider-build/embroider/pull/1696) Use rollup's `addWatchFile` API to mark dependencies ([@chancancode](https://github.com/chancancode))

#### :house: Internal
* Other
  * [#1716](https://github.com/embroider-build/embroider/pull/1716) update release-plan ([@mansona](https://github.com/mansona))
  * [#1698](https://github.com/embroider-build/embroider/pull/1698) Use release plan ([@mansona](https://github.com/mansona))
* `@embroider/macros`
  * [#1709](https://github.com/embroider-build/embroider/pull/1709) Jest types broke our CI ([@ef4](https://github.com/ef4))
* `@embroider/test-scenarios`
  * [#1705](https://github.com/embroider-build/embroider/pull/1705) Backport #1703 to stable ([@chancancode](https://github.com/chancancode))

#### Committers: 5
- Benjamin Feng ([@fengb](https://github.com/fengb))
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Godfrey Chan ([@chancancode](https://github.com/chancancode))
- Mike Engel ([@mike-engel](https://github.com/mike-engel))

## Release (2023-11-28)

@embroider/compat 3.4.0 (minor)
@embroider/reverse-exports 0.1.0 (minor)
@embroider/router 2.1.6 (patch)

#### :rocket: Enhancement
* `reverse-exports`
  * [#1652](https://github.com/embroider-build/embroider/pull/1652) create new @embroider/reverse-exports package ([@lolmaus](https://github.com/lolmaus))
* `compat`
  * [#1673](https://github.com/embroider-build/embroider/pull/1673) allow apps to disable the decorator transforms ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix
* `router`
  * [#1684](https://github.com/embroider-build/embroider/pull/1684) Workaround typescript regression in router package ([@ef4](https://github.com/ef4))
* `reverse-exports`
  * [#1676](https://github.com/embroider-build/embroider/pull/1676) fix single asterisk replacement in reverse-exports ([@mansona](https://github.com/mansona))

#### :house: Internal
* [#1683](https://github.com/embroider-build/embroider/pull/1683) update the releasing CI job ([@mansona](https://github.com/mansona))
* [#1681](https://github.com/embroider-build/embroider/pull/1681) skip watch-mode tests in windows ([@mansona](https://github.com/mansona))

#### Committers: 3
- Andrey Mikhaylov (lolmaus) ([@lolmaus](https://github.com/lolmaus))
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2023-11-16)

@embroider/core 3.4.2 (patch)

#### :bug: Bug Fix
* `core`
  * [#1670](https://github.com/embroider-build/embroider/pull/1670) Fix looping for unchanged files ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2023-11-15)

@embroider/compat 3.3.1 (patch)
@embroider/core 3.4.1 (patch)

#### :bug: Bug Fix
* `core`
  * [#1664](https://github.com/embroider-build/embroider/pull/1664) reorder extension precedence when searching app-js and fastboot-js trees ([@ef4](https://github.com/ef4))
  * [#1661](https://github.com/embroider-build/embroider/pull/1661) Fix html clearing on rebuild ([@ef4](https://github.com/ef4))

#### :house: Internal
* Other
  * [#1666](https://github.com/embroider-build/embroider/pull/1666) unpin json-stable-stringify ([@mansona](https://github.com/mansona))
  * [#1662](https://github.com/embroider-build/embroider/pull/1662) Workaround ember-cli-fastboot misuse of json-stable-stringify ([@ef4](https://github.com/ef4))
* `compat`, `core`
  * [#1663](https://github.com/embroider-build/embroider/pull/1663) adjust moved-package-target for namespaced packages ([@ef4](https://github.com/ef4))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2023-11-11)

@embroider/addon-dev 4.1.2 (patch)
@embroider/addon-shim 1.8.7 (patch)
@embroider/babel-loader-9 3.1.1 (patch)
@embroider/compat 3.3.0 (minor)
@embroider/core 3.4.0 (minor)
@embroider/hbs-loader 3.0.3 (patch)
@embroider/macros 1.13.3 (patch)
@embroider/router 2.1.5 (patch)
@embroider/shared-internals 2.5.1 (patch)
@embroider/test-setup 3.0.3 (patch)
@embroider/util 1.12.1 (patch)
@embroider/vite 0.2.0 (minor)
@embroider/webpack 3.2.1 (patch)

#### :rocket: Enhancement
* `compat`, `core`
  * [#1605](https://github.com/embroider-build/embroider/pull/1605) Ensure custom HTML attributes are passed-through ([@chancancode](https://github.com/chancancode))
* `vite`
  * [#1623](https://github.com/embroider-build/embroider/pull/1623) Implement the optimizeDeps() helper ([@lolmaus](https://github.com/lolmaus))

#### :bug: Bug Fix
* `util`
  * [#1655](https://github.com/embroider-build/embroider/pull/1655) fix node version for @embroider/util ([@mansona](https://github.com/mansona))
* `macros`
  * [#1644](https://github.com/embroider-build/embroider/pull/1644) Perf: Only require.resolve the babel plugin cache busting file once ([@raycohen](https://github.com/raycohen))
* `compat`
  * [#1632](https://github.com/embroider-build/embroider/pull/1632) Fix co-located components regressions (#1619) ([@chancancode](https://github.com/chancancode))
* `addon-dev`, `vite`
  * [#1630](https://github.com/embroider-build/embroider/pull/1630) Bump minimum content-tag version. ([@simonihmig](https://github.com/simonihmig))

#### :memo: Documentation
* `compat`
  * [#1603](https://github.com/embroider-build/embroider/pull/1603) Add some action items to the peer errors when node_modules is messed up ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `webpack`
  * [#1646](https://github.com/embroider-build/embroider/pull/1646) docs: fix typo of publicAssetURL ([@camerondubas](https://github.com/camerondubas))

#### :house: Internal
* Other
  * [#1654](https://github.com/embroider-build/embroider/pull/1654) don't run CI for all branches starting with v ([@mansona](https://github.com/mansona))
  * [#1636](https://github.com/embroider-build/embroider/pull/1636) Increase CI timeout ([@chancancode](https://github.com/chancancode))
  * [#1629](https://github.com/embroider-build/embroider/pull/1629) Randomize port and improve watch mode test ([@chancancode](https://github.com/chancancode))
  * [#1624](https://github.com/embroider-build/embroider/pull/1624) Add app-level watch-mode tests ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `addon-dev`, `addon-shim`, `babel-loader-9`, `compat`, `core`, `hbs-loader`, `macros`, `router`, `shared-internals`, `test-setup`, `util`, `webpack`
  * [#1594](https://github.com/embroider-build/embroider/pull/1594) remove volta from CI ([@mansona](https://github.com/mansona))
* `macros`
  * [#1649](https://github.com/embroider-build/embroider/pull/1649) update pnpm ([@mansona](https://github.com/mansona))
* `compat`, `core`
  * [#1627](https://github.com/embroider-build/embroider/pull/1627) Resolver refactor ([@mansona](https://github.com/mansona))

#### Committers: 7
- Andrey Mikhaylov (lolmaus) ([@lolmaus](https://github.com/lolmaus))
- Cameron Dubas ([@camerondubas](https://github.com/camerondubas))
- Chris Manson ([@mansona](https://github.com/mansona))
- Godfrey Chan ([@chancancode](https://github.com/chancancode))
- Ray Cohen ([@raycohen](https://github.com/raycohen))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2023-10-06)

@embroider/compat 3.2.3 (patch)

#### :bug: Bug Fix
* `compat`
  * [#1622](https://github.com/embroider-build/embroider/pull/1622) use realpath of engine's route when building resolver.json ([@mansona](https://github.com/mansona))

#### :house: Internal
* [#1626](https://github.com/embroider-build/embroider/pull/1626) disable lint for scenarios since scenarios are not published ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* [#1625](https://github.com/embroider-build/embroider/pull/1625) reduceLock ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2023-09-29)

@embroider/addon-dev 4.1.1 (patch)
@embroider/babel-loader-9 3.1.0 (minor)
@embroider/compat 3.2.2 (patch)
@embroider/core 3.3.0 (minor)
@embroider/macros 1.13.2 (patch)
@embroider/router 2.1.4 (patch)
@embroider/shared-internals 2.5.0 (minor)
@embroider/test-setup 3.0.2 (patch)
@embroider/vite 0.1.3 (patch)
@embroider/webpack 3.2.0 (minor)

#### :rocket: Enhancement
* `shared-internals`
  * [#1612](https://github.com/embroider-build/embroider/pull/1612) performance: cache existsSync results in PackageCache.ownerOfFile ([@raycohen](https://github.com/raycohen))
  * [#1608](https://github.com/embroider-build/embroider/pull/1608) performance: cache realpathSync access in package-cache.get ([@raycohen](https://github.com/raycohen))
* `core`
  * [#1611](https://github.com/embroider-build/embroider/pull/1611) performance: avoid paying decodeFastbootSwitch regex cost unless needed ([@raycohen](https://github.com/raycohen))
* `babel-loader-9`, `webpack`
  * [#1578](https://github.com/embroider-build/embroider/pull/1578) Update babel-loader to 9 ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix
* `webpack`
  * [#1597](https://github.com/embroider-build/embroider/pull/1597) Fix HTML content failing to update ([@ef4](https://github.com/ef4))
* `shared-internals`
  * [#1609](https://github.com/embroider-build/embroider/pull/1609) Fix WrappedPackage caching for app ([@ef4](https://github.com/ef4))
* `addon-dev`
  * [#1600](https://github.com/embroider-build/embroider/pull/1600) Fix relative import path of assets for non-entrypoint modules ([@simonihmig](https://github.com/simonihmig))
* `compat`
  * [#1582](https://github.com/embroider-build/embroider/pull/1582) ember-source compat adapter should not use an app-provided babel config if one is present ([@void-mAlex](https://github.com/void-mAlex))
  * [#1580](https://github.com/embroider-build/embroider/pull/1580) stop ember-composable-helpers searching for babel configs ([@mansona](https://github.com/mansona))

#### :memo: Documentation
* [#1604](https://github.com/embroider-build/embroider/pull/1604) add staticEmberSource to the readme example ([@mansona](https://github.com/mansona))
* [#1613](https://github.com/embroider-build/embroider/pull/1613) More v2 addon FAQs ([@simonihmig](https://github.com/simonihmig))
* [#1607](https://github.com/embroider-build/embroider/pull/1607) Add v2 addon FAQs ([@simonihmig](https://github.com/simonihmig))
* [#1577](https://github.com/embroider-build/embroider/pull/1577) Add Embroider Initiative sponsors to the readme ([@mansona](https://github.com/mansona))

#### :house: Internal
* `addon-dev`, `compat`, `core`, `macros`, `router`, `shared-internals`, `test-setup`, `vite`, `webpack`
  * [#1584](https://github.com/embroider-build/embroider/pull/1584) Get strict about type only imports ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* Other
  * [#1579](https://github.com/embroider-build/embroider/pull/1579) Lockfile update ([@ef4](https://github.com/ef4))

#### Committers: 6
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Ray Cohen ([@raycohen](https://github.com/raycohen))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2023-08-02)

@embroider/addon-dev 4.1.0 (minor)
@embroider/vite 0.1.2 (patch)

#### :rocket: Enhancement
* `addon-dev`
  * [#1448](https://github.com/embroider-build/embroider/pull/1448) Add the ability to customise rollup-plugin-clean's config ([@mansona](https://github.com/mansona))

#### :house: Internal
* `vite`
  * [#1567](https://github.com/embroider-build/embroider/pull/1567) add files block to the vite package ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2023-08-02)

@embroider/addon-dev 4.0.0 (major)
@embroider/babel-loader-8 3.0.1 (patch)
@embroider/compat 3.2.1 (patch)
@embroider/core 3.2.1 (patch)
@embroider/macros 1.13.1 (patch)
@embroider/shared-internals 2.4.0 (minor)
@embroider/vite 0.1.1 (patch)
@embroider/webpack 3.1.5 (patch)

#### :boom: Breaking Change
* `addon-dev`
  * [#1558](https://github.com/embroider-build/embroider/pull/1558) Simplification of gjs and hbs handling in addon-dev ([@ef4](https://github.com/ef4))

#### :rocket: Enhancement
* `shared-internals`
  * [#1556](https://github.com/embroider-build/embroider/pull/1556) support packages that use modules ([@void-mAlex](https://github.com/void-mAlex))

#### :bug: Bug Fix
* `compat`
  * [#1563](https://github.com/embroider-build/embroider/pull/1563) Add semverRange <=4.11.0 for ember-data debug ([@mkszepp](https://github.com/mkszepp))
* `babel-loader-8`, `core`, `macros`, `shared-internals`
  * [#1560](https://github.com/embroider-build/embroider/pull/1560) Fix rewritten package cache encapsulation ([@ef4](https://github.com/ef4))
* `vite`
  * [#1550](https://github.com/embroider-build/embroider/pull/1550) Initial test of vite integration ([@ef4](https://github.com/ef4))

#### :memo: Documentation
* [#1559](https://github.com/embroider-build/embroider/pull/1559) Fix link to `dependenciesMeta.*.injected` ([@gossi](https://github.com/gossi))

#### :house: Internal
* [#1565](https://github.com/embroider-build/embroider/pull/1565) add an auto-deploy action for stable releases ([@mansona](https://github.com/mansona))

#### Committers: 5
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Thomas Gossmann ([@gossi](https://github.com/gossi))
- [@mkszepp](https://github.com/mkszepp)

## Release (2023-07-20)

@embroider/addon-dev 3.2.0 (minor)
@embroider/compat 3.2.0 (minor)
@embroider/core 3.2.0 (minor)
@embroider/hbs-loader 3.0.2 (patch)
@embroider/macros 1.13.0 (minor)
@embroider/shared-internals 2.3.0 (minor)
@embroider/util 1.12.0 (minor)
@embroider/vite 0.1.0 (minor)
@embroider/webpack 3.1.4 (patch)

#### :rocket: Enhancement
* `addon-dev`
  * [#1518](https://github.com/embroider-build/embroider/pull/1518) add a basic implementation of the gjs rollup plugin ([@mansona](https://github.com/mansona))
* `util`, `vite`
  * [#1550](https://github.com/embroider-build/embroider/pull/1550) Initial test of vite integration ([@ef4](https://github.com/ef4))
* `compat`, `core`, `macros`, `shared-internals`
  * [#1548](https://github.com/embroider-build/embroider/pull/1548) optional ES-module compatibility setting ([@ef4](https://github.com/ef4))
* `compat`
  * [#1543](https://github.com/embroider-build/embroider/pull/1543) compat adapter to add re-export observer-manager service ([@void-mAlex](https://github.com/void-mAlex))
* `compat`, `core`, `shared-internals`
  * [#1521](https://github.com/embroider-build/embroider/pull/1521) New option: staticEmberSource ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix
* `core`, `webpack`
  * [#1547](https://github.com/embroider-build/embroider/pull/1547) Rehome moved requests to real on-disk files ([@ef4](https://github.com/ef4))
* `compat`
  * [#1544](https://github.com/embroider-build/embroider/pull/1544) Bugfix: contextual staticHelpers in subexpression position ([@ef4](https://github.com/ef4))
* `compat`, `shared-internals`
  * [#1542](https://github.com/embroider-build/embroider/pull/1542) Refuse to accept v1 addons as invalid peerDeps ([@ef4](https://github.com/ef4))
* Other
  * [#1541](https://github.com/embroider-build/embroider/pull/1541) Create peer-dependency-resolution-issues.md ([@ef4](https://github.com/ef4))
* `macros`
  * [#1531](https://github.com/embroider-build/embroider/pull/1531) Include named exports in CJS shims when using `importSync` ([@chancancode](https://github.com/chancancode))
* `compat`, `core`, `shared-internals`, `webpack`
  * [#1536](https://github.com/embroider-build/embroider/pull/1536) Generate per-package implicit-modules imports ([@ef4](https://github.com/ef4))
* `core`
  * [#1534](https://github.com/embroider-build/embroider/pull/1534) Fixes case when podModulePrefix is set to `my-app/routes` ([@evoactivity](https://github.com/evoactivity))

#### :house: Internal
* Other
  * [#1492](https://github.com/embroider-build/embroider/pull/1492) Make release idempotent (+dry-run) ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1552](https://github.com/embroider-build/embroider/pull/1552) add --access=public to npm publish unstable ([@mansona](https://github.com/mansona))
  * [#1540](https://github.com/embroider-build/embroider/pull/1540) remove an overridden dependency ([@ef4](https://github.com/ef4))
* `core`
  * [#1538](https://github.com/embroider-build/embroider/pull/1538) Removing workaround ([@ef4](https://github.com/ef4))
* `compat`, `core`, `macros`, `shared-internals`
  * [#1537](https://github.com/embroider-build/embroider/pull/1537) Update babel-import-util ([@ef4](https://github.com/ef4))
* `compat`, `hbs-loader`, `webpack`
  * [#1535](https://github.com/embroider-build/embroider/pull/1535) Updating pnpm ([@ef4](https://github.com/ef4))

#### Committers: 6
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Godfrey Chan ([@chancancode](https://github.com/chancancode))
- Liam Potter ([@evoactivity](https://github.com/evoactivity))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2023-07-13)

@embroider/addon-dev 3.1.2 (patch)
@embroider/addon-shim 1.8.6 (patch)
@embroider/compat 3.1.5 (patch)
@embroider/core 3.1.3 (patch)
@embroider/hbs-loader 3.0.1 (patch)
@embroider/macros 1.12.3 (patch)
@embroider/router 2.1.3 (patch)
@embroider/shared-internals 2.2.3 (patch)
@embroider/util 1.11.2 (patch)
@embroider/webpack 3.1.3 (patch)

#### :bug: Bug Fix
* `shared-internals`
  * [#1516](https://github.com/embroider-build/embroider/pull/1516) Move @embroider/macros from emberVirtualPackages to emberVirtualPeerDeps ([@ef4](https://github.com/ef4))
  * [#1513](https://github.com/embroider-build/embroider/pull/1513) Add `@glimmer/reference` as a virtual package ([@chancancode](https://github.com/chancancode))
  * [#1528](https://github.com/embroider-build/embroider/pull/1528) Restore older node support ([@ef4](https://github.com/ef4))
* `core`
  * [#1524](https://github.com/embroider-build/embroider/pull/1524) Fix the `EMBROIDER_CONCAT_STATS` build error ([@Windvis](https://github.com/Windvis))
  * [#1509](https://github.com/embroider-build/embroider/pull/1509) All addons may need emberVirtualPeerDep handling ([@ef4](https://github.com/ef4))
* `addon-dev`, `macros`
  * [#1520](https://github.com/embroider-build/embroider/pull/1520) use transform babel plugins instead of proposal ([@mansona](https://github.com/mansona))

#### :memo: Documentation
* `macros`
  * [#1507](https://github.com/embroider-build/embroider/pull/1507) fix(macros-readme): fix isTesting, isDevelopingApp typos ([@olenderhub](https://github.com/olenderhub))

#### :house: Internal
* `compat`
  * [#1522](https://github.com/embroider-build/embroider/pull/1522) format resolver.json more nicely ([@ef4](https://github.com/ef4))
* Other
  * [#1500](https://github.com/embroider-build/embroider/pull/1500) Make the package-json path repo-relative ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `addon-dev`, `addon-shim`, `compat`, `core`, `hbs-loader`, `macros`, `router`, `shared-internals`, `util`, `webpack`
  * [#1512](https://github.com/embroider-build/embroider/pull/1512) Upgrade typescript ([@ef4](https://github.com/ef4))
* `router`
  * [#1510](https://github.com/embroider-build/embroider/pull/1510) Replace rollup-plugin-ts with @rollup/plugin-typescript ([@ef4](https://github.com/ef4))

#### Committers: 6
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Godfrey Chan ([@chancancode](https://github.com/chancancode))
- Hubert Olender ([@olenderhub](https://github.com/olenderhub))
- Sam Van Campenhout ([@Windvis](https://github.com/Windvis))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2023-07-01)

@embroider/compat 3.1.4 (patch)
@embroider/core 3.1.2 (patch)
@embroider/macros 1.12.2 (patch)
@embroider/shared-internals 2.2.2 (patch)
@embroider/webpack 3.1.2 (patch)

#### :bug: Bug Fix
* `core`
  * [#1504](https://github.com/embroider-build/embroider/pull/1504) fix inter-package relative imports in addon's app-js ([@ef4](https://github.com/ef4))
* `shared-internals`
  * [#1503](https://github.com/embroider-build/embroider/pull/1503) less aggressive realpathSync ([@ef4](https://github.com/ef4))

#### :house: Internal
* [#1502](https://github.com/embroider-build/embroider/pull/1502) re-enabling ember 5.1 tests ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2023-06-30)

@embroider/compat 3.1.3 (patch)
@embroider/core 3.1.1 (patch)
@embroider/macros 1.12.1 (patch)
@embroider/shared-internals 2.2.1 (patch)
@embroider/webpack 3.1.1 (patch)

#### :bug: Bug Fix
* `core`, `shared-internals`
  * [#1495](https://github.com/embroider-build/embroider/pull/1495) Eagerly virtualize emberVirtualPackages ([@ef4](https://github.com/ef4))
* `shared-internals`
  * [#1493](https://github.com/embroider-build/embroider/pull/1493) Fix rewritten-package-cache when app has symlink to node_modules ([@ef4](https://github.com/ef4))

#### :house: Internal
* Other
  * [#1496](https://github.com/embroider-build/embroider/pull/1496) Unskip some core-resolver tests ([@ef4](https://github.com/ef4))
* `shared-internals`
  * [#1494](https://github.com/embroider-build/embroider/pull/1494) Make proxied rewritten-package-cache methods clearer ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## Release (2023-06-29)

@embroider/compat 3.1.2 (patch)

#### :bug: Bug Fix
* `compat`
  * Previous release was published incorrectly.

## Release (2023-06-29)

@embroider/compat 3.1.1 (patch)

#### :bug: Bug Fix
* `compat`
  * [#1488](https://github.com/embroider-build/embroider/pull/1488) fix this.import from node_modules in v1 addons ([@mansona](https://github.com/mansona))

#### Committers: 1
- Chris Manson ([@mansona](https://github.com/mansona))

## Release (2023-06-28)

@embroider/compat 3.1.0 (minor)
@embroider/core 3.1.0 (minor)
@embroider/macros 1.12.0 (minor)
@embroider/router 2.1.2 (patch)
@embroider/shared-internals 2.2.0 (minor)
@embroider/webpack 3.1.0 (minor)

#### :rocket: Enhancement
* `compat`, `core`, `macros`, `shared-internals`, `webpack`
  * [#1435](https://github.com/embroider-build/embroider/pull/1435) Eliminate node_modules rewriting ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix
* `compat`
  * [#1481](https://github.com/embroider-build/embroider/pull/1481) Properly serialize options ([@chancancode](https://github.com/chancancode))
* `core`
  * [#1365](https://github.com/embroider-build/embroider/pull/1365) Prevent HTML-escaping of module specifiers ([@simonihmig](https://github.com/simonihmig))

#### :house: Internal
* `compat`, `core`, `shared-internals`
  * [#1482](https://github.com/embroider-build/embroider/pull/1482) Cleanup & refactor after 1435 ([@ef4](https://github.com/ef4))
* Other
  * [#1480](https://github.com/embroider-build/embroider/pull/1480) pinning "release" scenarios to ember-source 5.0 ([@ef4](https://github.com/ef4))
  * [#1473](https://github.com/embroider-build/embroider/pull/1473) Bring back the addon watch tests, and use the rollup.watch JS API ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1477](https://github.com/embroider-build/embroider/pull/1477) Allow manual ci running ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1454](https://github.com/embroider-build/embroider/pull/1454) Refactor scenario helpers to a shared location ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `router`
  * [#1476](https://github.com/embroider-build/embroider/pull/1476) Delete .DS_Store ([@wandroll](https://github.com/wandroll))

#### Committers: 4
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- Wandrille Verlut ([@wandroll](https://github.com/wandroll))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2023-06-13)

@embroider/compat 3.0.2 (patch)
@embroider/core 3.0.2 (patch)
@embroider/macros 1.11.1 (patch)

#### :bug: Bug Fix
* `core`
  * [#1463](https://github.com/embroider-build/embroider/pull/1463) fix resolution of files with .hbs extensions ([@ef4](https://github.com/ef4))
* `macros`
  * [#1468](https://github.com/embroider-build/embroider/pull/1468) macroCondition: do branch elimination if no runtime impl. is involved ([@simonihmig](https://github.com/simonihmig))
* `compat`
  * [#1412](https://github.com/embroider-build/embroider/pull/1412) WriteV1Config: fix /tests support ([@22a](https://github.com/22a))

#### :house: Internal
* [#1469](https://github.com/embroider-build/embroider/pull/1469) update deprecated (and removed) blacklist config in test app ([@mansona](https://github.com/mansona))


#### Committers: 5
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Peter Meehan ([@22a](https://github.com/22a))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))

## Release (2023-06-05)

@embroider/addon-dev 3.1.1 (patch)
@embroider/compat 3.0.1 (patch)
@embroider/core 3.0.1 (patch)
@embroider/router 2.1.1 (patch)
@embroider/util 1.11.1 (patch)

#### :bug: Bug Fix
* `compat`
  * [#1460](https://github.com/embroider-build/embroider/pull/1460) expanding EmptyPackage contents ([@ef4](https://github.com/ef4))
* `addon-dev`
  * [#1423](https://github.com/embroider-build/embroider/pull/1423) Do not write package.json when there are no changes (affects `addon.appReexports()` and `addon.publicAssets()`) ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1446](https://github.com/embroider-build/embroider/pull/1446) Revert "Run the clean plugin of addon-dev as late as possible" ([@mansona](https://github.com/mansona))
  * [#1450](https://github.com/embroider-build/embroider/pull/1450) [bugfix] Ensured that normalizeFileExt ignores .css.d.ts files ([@ijlee2](https://github.com/ijlee2))
  * [#1447](https://github.com/embroider-build/embroider/pull/1447) fix keepAssets corrupting image files ([@mansona](https://github.com/mansona))
* `compat`, `core`
  * [#1443](https://github.com/embroider-build/embroider/pull/1443) linkto routable engine path in host app ([@void-mAlex](https://github.com/void-mAlex))
* `addon-dev`, `router`
  * [#1449](https://github.com/embroider-build/embroider/pull/1449) [bugfix] Set output.experimentalMinChunkSize to 0, to counter a change in rollup@3.22.0 ([@ijlee2](https://github.com/ijlee2))
* `util`
  * [#1451](https://github.com/embroider-build/embroider/pull/1451) Use `typeof` in `EmbroiderUtilRegistry` ([@bertdeblock](https://github.com/bertdeblock))

#### :memo: Documentation
* [#1349](https://github.com/embroider-build/embroider/pull/1349) Add a document about pnpm monorepo error ([@mansona](https://github.com/mansona))
* [#1458](https://github.com/embroider-build/embroider/pull/1458) Add compatible Ember version to README.md ([@EWhite613](https://github.com/EWhite613))

#### :house: Internal
* [#1444](https://github.com/embroider-build/embroider/pull/1444) clean up patch-package which was introduced with changeset-recover th… ([@void-mAlex](https://github.com/void-mAlex))
* [#1440](https://github.com/embroider-build/embroider/pull/1440) release preview workflow ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 7
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- Bert De Block ([@bertdeblock](https://github.com/bertdeblock))
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Eric White ([@EWhite613](https://github.com/EWhite613))
- Isaac Lee ([@ijlee2](https://github.com/ijlee2))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2023-05-18)

@embroider/test-setup 3.0.1 (patch)

#### :bug: Bug Fix
* `test-setup`
  * [#1436](https://github.com/embroider-build/embroider/pull/1436) prevent double ^ when using embroider test-setup ([@mansona](https://github.com/mansona))

#### :house: Internal
* [#1433](https://github.com/embroider-build/embroider/pull/1433) Make preflight error when suite-setup-util fails ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 2
- Chris Manson ([@mansona](https://github.com/mansona))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## Release (2023-05-17)

```
@embroider/addon-dev 3.1.0 (minor)
@embroider/addon-shim 1.8.5 (patch)
@embroider/babel-loader-8 3.0.0 (major)
@embroider/compat 3.0.0 (major)
@embroider/core 3.0.0 (major)
@embroider/hbs-loader 3.0.0 (major)
@embroider/macros 1.11.0 (minor)
@embroider/router 2.1.0 (minor)
@embroider/shared-internals 2.1.0 (minor)
@embroider/test-setup 3.0.0 (major)
@embroider/util 1.11.0 (minor)
@embroider/webpack 3.0.0 (major)
```

#### :boom: Breaking Change
* `compat`, `core`, `webpack`
  * See Upgrade Guide https://github.com/embroider-build/embroider/blob/main/docs/upgrade-guides.md#embroidercore-2x---3x
  * [#1363](https://github.com/embroider-build/embroider/pull/1363) Simplified template resolution ([@ef4](https://github.com/ef4))

#### :rocket: Enhancement
* `addon-dev`, `router`
  * [#1419](https://github.com/embroider-build/embroider/pull/1419) Test against ember preview types ([@ef4](https://github.com/ef4))
* `macros`
  * [#1354](https://github.com/embroider-build/embroider/pull/1354) Add glint helper types for more macros ([@vlascik](https://github.com/vlascik))
* `shared-internals`
  * [#1396](https://github.com/embroider-build/embroider/pull/1396) Add @ember/owner to emberVirtualPackages ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `core`
  * [#1376](https://github.com/embroider-build/embroider/pull/1376) legacy addon resolving ([@ef4](https://github.com/ef4))
* `compat`, `core`, `webpack`
  * [#1373](https://github.com/embroider-build/embroider/pull/1373) app tree resolving ([@ef4](https://github.com/ef4))
  * [#1331](https://github.com/embroider-build/embroider/pull/1331) Move resolving into dedicated plugins ([@ef4](https://github.com/ef4))
* `compat`, `shared-internals`
  * [#1372](https://github.com/embroider-build/embroider/pull/1372) restore component invokes rules support ([@ef4](https://github.com/ef4))
* `util`
  * [#1367](https://github.com/embroider-build/embroider/pull/1367) Improve types of `ensure-safe-component` helper ([@simonihmig](https://github.com/simonihmig))
* `compat`
  * [#1369](https://github.com/embroider-build/embroider/pull/1369) Add semverRange <=4.11.0 for ember-data ([@mkszepp](https://github.com/mkszepp))
  * [#1362](https://github.com/embroider-build/embroider/pull/1362) clarify which package rules apply inside vs outside a component ([@ef4](https://github.com/ef4))
  * [#1352](https://github.com/embroider-build/embroider/pull/1352) reinstate logic around parsing of invokes packageRules ([@void-mAlex](https://github.com/void-mAlex))
  * [#1343](https://github.com/embroider-build/embroider/pull/1343) Fix `@babel/core` version check to support `ember-cli-babel` v8 ([@bertdeblock](https://github.com/bertdeblock))
* `addon-dev`
  * [#1368](https://github.com/embroider-build/embroider/pull/1368) Add support for keeping public assets and ember-addon.public-assets meta in sync ([@phndiaye](https://github.com/phndiaye))
* `core`, `webpack`
  * [#1355](https://github.com/embroider-build/embroider/pull/1355) Refactor self-resolution ([@ef4](https://github.com/ef4))
* `compat`, `core`, `shared-internals`, `webpack`
  * [#1339](https://github.com/embroider-build/embroider/pull/1339) Layer template resolver on top of module resolver ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix
* `test-setup`
  * [#1427](https://github.com/embroider-build/embroider/pull/1427) Use optional peer deps in @embroider/test-setup ([@ef4](https://github.com/ef4))
* `util`
  * [#1429](https://github.com/embroider-build/embroider/pull/1429) Ember 5 compat ([@ef4](https://github.com/ef4))
* `compat`, `router`
  * [#1428](https://github.com/embroider-build/embroider/pull/1428) Add compat adapter for @ember/test-waiters ([@ef4](https://github.com/ef4))
* Other
  * [#1424](https://github.com/embroider-build/embroider/pull/1424) Fix CI by upgrading ts-node ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1381](https://github.com/embroider-build/embroider/pull/1381) add tests for helper name collisions with html elements or js keywords ([@void-mAlex](https://github.com/void-mAlex))
* `core`, `webpack`
  * [#1391](https://github.com/embroider-build/embroider/pull/1391) only rehome a request if it would resolve in a different package ([@void-mAlex](https://github.com/void-mAlex))
  * [#1346](https://github.com/embroider-build/embroider/pull/1346) Bugfix: inconsistent handling of webpack virtual modules ([@ef4](https://github.com/ef4))
* `webpack`
  * [#1403](https://github.com/embroider-build/embroider/pull/1403) Remove deprecated dependency @types/source-map ([@francois2metz](https://github.com/francois2metz))
  * [#1359](https://github.com/embroider-build/embroider/pull/1359) Ignore resolve requests that start with ! ([@mansona](https://github.com/mansona))
* `compat`
  * [#1383](https://github.com/embroider-build/embroider/pull/1383) Rename strict flag to strictMode ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1386](https://github.com/embroider-build/embroider/pull/1386) Fix `Maximum call stack size exceeded` error ([@simonihmig](https://github.com/simonihmig))
  * [#1347](https://github.com/embroider-build/embroider/pull/1347) fix resolver bugs around package rules ([@void-mAlex](https://github.com/void-mAlex))
  * [#1342](https://github.com/embroider-build/embroider/pull/1342) restore original ts extension priority ([@ef4](https://github.com/ef4))
  * [#1340](https://github.com/embroider-build/embroider/pull/1340) Static helpers and static modifiers transform fixes ([@void-mAlex](https://github.com/void-mAlex))
* `shared-internals`
  * [#1379](https://github.com/embroider-build/embroider/pull/1379) don't confuse webpack requests with packageNames ([@ef4](https://github.com/ef4))
* `addon-shim`
  * [#1327](https://github.com/embroider-build/embroider/pull/1327) Fix Nested V2 Addons ([@gossi](https://github.com/gossi))

#### :memo: Documentation
* `addon-dev`, `util`
  * [#1415](https://github.com/embroider-build/embroider/pull/1415) fix casing in docs links ([@mansona](https://github.com/mansona))
* `macros`
  * [#1348](https://github.com/embroider-build/embroider/pull/1348) Move docs into a docs folder ([@mansona](https://github.com/mansona))
* Other
  * [#1406](https://github.com/embroider-build/embroider/pull/1406) Release prep ([@ef4](https://github.com/ef4))

#### :house: Internal
* `router`
  * [#1431](https://github.com/embroider-build/embroider/pull/1431) Release infra ([@ef4](https://github.com/ef4))
* Other
  * [#1430](https://github.com/embroider-build/embroider/pull/1430) Remove changeset, as @ef4 has some custom release tooling coming ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1409](https://github.com/embroider-build/embroider/pull/1409) Use a custom changelog line generator function to avoid adding meaningless changelog entries  ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1407](https://github.com/embroider-build/embroider/pull/1407) Enable changelog generation ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1406](https://github.com/embroider-build/embroider/pull/1406) Release prep ([@ef4](https://github.com/ef4))
  * [#1405](https://github.com/embroider-build/embroider/pull/1405) Upgrade changeset-recover ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1398](https://github.com/embroider-build/embroider/pull/1398) Add prepare changelog workflow to automatically propose what should be in sync for us ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1401](https://github.com/embroider-build/embroider/pull/1401) Add relevant changesets for the upcoming release and evaluate their impact ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1392](https://github.com/embroider-build/embroider/pull/1392) Allow running publish-unstable on workflow_dispatch ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1393](https://github.com/embroider-build/embroider/pull/1393) continue deploying unstable packages even with an error ([@mansona](https://github.com/mansona))
  * [#1395](https://github.com/embroider-build/embroider/pull/1395) Revving yarn.lock ([@ef4](https://github.com/ef4))
  * [#1389](https://github.com/embroider-build/embroider/pull/1389) bump unstable versions by at least a patch ([@mansona](https://github.com/mansona))
  * [#1390](https://github.com/embroider-build/embroider/pull/1390) Change namespace for publish-unstable cancel-in-progress ([@backspace](https://github.com/backspace))
  * [#1364](https://github.com/embroider-build/embroider/pull/1364) Unstable release sync with main ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  * [#1345](https://github.com/embroider-build/embroider/pull/1345) Update release workflow ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `addon-dev`, `addon-shim`, `babel-loader-8`, `compat`, `core`, `hbs-loader`, `macros`, `router`, `shared-internals`, `util`, `webpack`
  * [#1422](https://github.com/embroider-build/embroider/pull/1422) Use pnpm workspace protocol everywhere ([@ef4](https://github.com/ef4))
* `addon-dev`, `addon-shim`, `compat`, `core`, `hbs-loader`, `macros`, `router`, `shared-internals`, `util`, `webpack`
  * [#1421](https://github.com/embroider-build/embroider/pull/1421) upgrade typescript ([@ef4](https://github.com/ef4))
* `compat`, `core`, `macros`, `router`, `shared-internals`, `test-setup`, `util`, `webpack`
  * [#1411](https://github.com/embroider-build/embroider/pull/1411) Switch to pnpm ([@ef4](https://github.com/ef4))
* `util`
  * [#1388](https://github.com/embroider-build/embroider/pull/1388) Enable prettier in ci ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 12
- Alex ([@void-mAlex](https://github.com/void-mAlex))
- Bert De Block ([@bertdeblock](https://github.com/bertdeblock))
- Buck Doyle ([@backspace](https://github.com/backspace))
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- François de Metz ([@francois2metz](https://github.com/francois2metz))
- Philippe Ndiaye ([@phndiaye](https://github.com/phndiaye))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- Thomas Gossmann ([@gossi](https://github.com/gossi))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)
- [@mkszepp](https://github.com/mkszepp)
- [@vlascik](https://github.com/vlascik)

# Release 2023-01-25.0

## `@embroider/compat`, `@embroider/core`, `@embroider/test-setup`, `@embroider/webpack` 2.1.0 -> 2.1.1

- BUGFIX: Support ember-cli-babel >= 8 [1334](https://github.com/embroider-build/embroider/pull/1334)
- INTERNAL: Upgrade resolver tests [1321](https://github.com/embroider-build/embroider/pull/1321)

# Release 2023-01-24.0

## `@embroider/compat` 2.0.2 -> 2.1.0

- BUGFIX: hash current env into the temp workspace dir path [1318](https://github.com/embroider-build/embroider/pull/1318)
- BUGFIX: add .hbs.js to the list of resolvable extensions by webpack [1307](https://github.com/embroider-build/embroider/pull/1307)
- BUGFIX: Resolver transform fixes [1308](https://github.com/embroider-build/embroider/pull/1308)
- BUGFIX: handle special case where rootURL is empty string [1285](https://github.com/embroider-build/embroider/pull/1285)
- BUGFIX: tmpdir handling for @glimmer/tracking compat adapter [1302](https://github.com/embroider-build/embroider/pull/1302)

## `@embroider/core` 2.0.2 -> 2.1.0

- INTERNAL: Split resolution decisions out of babel-plugin-adjust-specifiers [1309](https://github.com/embroider-build/embroider/pull/1309)

## `@embroider/test-setup` 2.0.2 -> 2.1.0

- BUGFIX: test-setup: use caret version modifier for Embroider dependencies [1328](https://github.com/embroider-build/embroider/pull/1328)

## `@embroider/util` 1.9.0 -> 1.10.0

- FEATURE: Make ensureSafeComponent usable with Glint [1301](https://github.com/embroider-build/embroider/pull/1301)

## `@ember/webpack` 2.0.2 -> 2.1.0

- BUGFIX: fix css livereload [1317](https://github.com/embroider-build/embroider/pull/1317)

# Release 2022-11-30.0

## `@embroider/compat`, `@embroider/core`, `@embroider/test-setup`, `@embroider/webpack` 2.0.1 -> 2.0.2

- BUGFIX: detect ember-template-compliation plugin correctly when other plugins are preventing parallelization [1299](https://github.com/embroider-build/embroider/pull/1299)

# Release 2022-11-28.0

## `@embroider/compat`, `@embroider/core`, `@embroider/test-setup`, `@embroider/webpack` 2.0.0 -> 2.0.1

- BUGFIX: 2.0.0 broke template-only components in addons with custom AST transforms [1294](https://github.com/embroider-build/embroider/pull/1294), [1295](https://github.com/embroider-build/embroider/pull/1295)

# Release 2022-11-23.0

## `@embroider/addon-dev` 2.0.0 -> 3.0.0

- BREAKING: `@embroider/addon-template/template-transform-plugin` is removed
  because `babel-plugin-ember-template-compilation >= 2.0.0` now directly supports
  source-to-source transformation.

  This plugin was used to run any custom AST transformations on your templates before publishing. To replace it:

  1. Add `babel-plugin-ember-template-compilation@^2.0.0` as a devDependency.
  2. Make sure you also have a devDependency on `ember-source`, so we have a template compiler.
  3. Update the babel config like:

     ```diff
     plugins: [
     -   [
     -     '@embroider/addon-dev/template-transform-plugin',
     -     {
     -       astTransforms: [
     -         ...yourPluginsHere
     -       ]
     -     }
     -   ],
     +   [
     +     'babel-plugin-ember-template-compilation',
     +     {
     +       compilerPath: 'ember-source/dist/ember-template-compiler',
     +       targetFormat: 'hbs',
     +       transforms: [
     +         ...yourPluginsHere
     +        ]
     +     }
     +   ]
     ]
     ```

  See https://github.com/emberjs/babel-plugin-ember-template-compilation for the complete docs on these options.

## `@embroider/addon-shim`: 1.8.3 -> 1.8.4

- BUGFIX: Add missing dependency [1282](https://github.com/embroider-build/embroider/pull/1282)

## `@embroider/babel-loader-8` 1.9.0 -> 2.0.0

- ENHANCEMENT: remove forced optional-chaining and nullish-coalescing-operator babel plugins [1270](https://github.com/embroider-build/embroider/pull/1270)
- BREAKING: peerDep on `@embroider/core` 2.0

## `@embroider/compat` 1.9.0 -> 2.0.0

- BREAKING: Drop support for Ember < 3.28 [1246](https://github.com/embroider-build/embroider/pull/1246). See details in the `@embroider/core` section of these release notes.
- BUGFIX: don't generate .js compnent stubs for .ts components [1273](https://github.com/embroider-build/embroider/pull/1273)
- BUGFIX: several windows-specific issues were caught and fixed when we ported our remaining test suite to run on both unix and windows.

## `@embroider/core` 1.9.0 -> 2.0.0

- DOCS: document how to work with test scenarios [1283](https://github.com/embroider-build/embroider/pull/1283)

- BUGFIX: Defend against infinite loop on broken babel config [1277](https://github.com/embroider-build/embroider/pull/1277)

- BUGFIX: allow v2 addons to use app tree fallback resolution [1278](https://github.com/embroider-build/embroider/pull/1278)

- BREAKING: Drop support for Ember < 3.28 [1246](https://github.com/embroider-build/embroider/pull/1246)

  This allows us to rely on:

  - first-class components, helpers, and modifiers
  - template lexical scope
  - the lack of the old modules-api-polyfill

    which greatly simplifies the build.

- ENHANCEMENT: Simplified template compilation pipeline [1242](https://github.com/embroider-build/embroider/pull/1242), [1276](https://github.com/embroider-build/embroider/pull/1276)

  Uses babel-plugin-ember-template-compilation 2.0, which [offers new capabilities to AST transform authors](https://github.com/emberjs/babel-plugin-ember-template-compilation#jsutils-manipulating-javascript-from-within-ast-transforms) that better unlock the power of strict mode templates.

- ENHANCEMENT: For most invocations of components, helpers, and modifiers when `staticComponents`, `staticHelpers`, and `staticModifiers` settings are enabled, we now entirely bypass the AMD loader using template lexical scope. This results in less work at runtime and slightly smaller code.

- BREAKING: The above feature won't have any breaking effects in the vast majority of apps that are doing things correctly. But I'm calling this out as potentially breaking because you may be accidentally relying on the loose old behaviors:

  1.  Using a component in one place would cause it to become globally available to the AMD loader after that point. This would let string-based component resolution work when it actually shouldn't have (if you are resolving strings into components at runtime, you can't use `staticComponents` mode).

  2.  If you have multiple copies of an addon, which copy would get invokved from a given template was hard to predict before, now each one will definitely see it's own dependency.

- INTERNALS: re-enable engines tests [1281](https://github.com/embroider-build/embroider/pull/1281)

## `@embroider/hbs-loader` 1.9.0 -> 2.0.0

- ENHANCEMENT: expose backward-compatible moduleName support
- BREAKING: peerDep on `@embroider/core` 2.0

## `@embroider/macros` 1.9.0 -> 1.10.0

- BUGFIX: template macros could have pre-moved appRoot in their packageCache
- ENHANCEMENT: expose simplified transforms API for use with babel-plugin-ember-template-compilation

  Previously, we used MacrosConfig.astTransforms() which gave you transforms in
  the reverse order they were expected to run, for compatibility with the wacky
  ordering in class ember-cli-htmlbars. Now we also offer `MacrosConfig.transforms()` which provides them in a format compatible directly with babel-plugin-ember-template-compilation 2.0, which uses the more natural order and which supports plugins-as-strings-to-be-loaded in addition to just plain functions.

## `@embroider/router`: 1.9.0 -> 2.0.0

- BREAKING: peerDep on `@embroider/core` 2.0
- BREAKING: converted to a v2 addon, so consuming apps must have ember-auto-import >= 2.0.0.

## `@embroider/shared-internals`: 1.8.3 -> 2.0.0

- BUGFIX: several windows-specific issues were caught and fixed when we ported our remaining test suite to run on both unix and windows.

- BREAKING: The second argument to `hbsToJS()` has changed formats to accomodate new additional options.

  ```diff
  import { hbsToJS } from '@embroider/shared-internals';

  -hbsToJS('<SomeTemplate />', 'my-component.hbs');
  +hbsToJS('<SomeTemplate />', { moduleName: 'my-component.hbs' });
  ```

## `@embroider/test-setup`: 1.8.3 -> 2.0.0

- BREAKING test under the new 2.0 releases of `@embroider/core` _et al_.

## `@embroider/webpack` 1.9.0 -> 2.0.0

- BREAKING: Drop support for Ember < 3.28 [1246](https://github.com/embroider-build/embroider/pull/1246). See details in the `@embroider/core` section of these release notes.

# Release 2022-10-06.0

## `@embroider/core` 1.8.3 -> 1.9.0 minor

- extends existing EmberENV for ember-inspector, #1252 (@patricklx)

  Resolves: [#1251 - production build breaks ember-inspector component tab](https://github.com/embroider-build/embroider/issues/1251)

## `@embroider/compat` 1.8.3 -> 1.9.0 minor

- Fix an order bug in linkNonCopiedDeps, #1256 (@ef4)
- Use consistent separator on windows, #1248 (@ef4)
- fix a rebuild crash in dummy apps on windows, #1247 (@ef4)
- Support TypeScript without ember-cli-typescript, #1236 (@NullVoxPopuli)
- Add `unique-id` helper to `builtInHelpers` list, #1239 & #1241 (@jakesjews)

## `@embroider/addon-dev` 1.8.3 -> 2.0.0 major

- Extensions in addon-dev's rollup plugin are now all normalized to .js, #1223 (@NullVoxPopuli)

  Previously, when addonEntrypoints would include `.{js,ts}`, these entries should no only say .js.
  All files are in terms of "the outputs", which are JavaScript.

  Also in #1223, this PR fixes an issue where components authored in typescript could not be used

- Default 'hoiseTransitiveImports' to 'false', #1233 (@NullVoxPopuli)

  Module load optimzations are an app concern, rather than an addon/library concern.
  This also resolves the issue that is described in [babel-plugin-ember-template-compilation#7](https://github.com/emberjs/babel-plugin-ember-template-compilation/pull/7#event-6996575186)

- Default `sourcemap: true` for the rollup output defaults, #1234 (@NullVoxPopuli)

  These are very hi-fi sourcemaps -- for example, in TypeScript projects, you see TypeScript in the dev tools.
  Because rollup/webpack/etc output can be really hard for humans to read, enabling sourcemaps as a default should hopefully help folks debug their addons more easily.

- Run the `clean` plugin as late as possible, #1229 (@simonihmig)

  Previously the cleanup would happen at the earliest point in time, at buildStart,
  making the time window large enough for Ember CLI to see the transient build output in an inconsistent state.
  Now it happens at the latest possible time, at generateBundle right before files are written,
  making the time window small enough to not cause any problems in practice.

## `@embroider/macros` 1.8.3 -> 1.9.0 minor

- Do not use absolute path in vendor files, #1245 (@stevcooo)

## `internals`

- upgrading some github actions, #1250 (@ef4)
- Port file assertions to qunit, #1240 (@ef4)
- Upgrade yarn and use volta.extends for all the things (@ef4)

### === Below this point, all packages were released in lockstep

## v1.8.3 (2022-07-04)

#### :bug: Bug Fix

- `compat`
  - [#1231](https://github.com/embroider-build/embroider/pull/1231) Followup to "Detect addons with customized treeForMethod names" ([@ef4](https://github.com/ef4))

#### :house: Internal

- [#1232](https://github.com/embroider-build/embroider/pull/1232) regression test coverage for #1231 ([@ef4](https://github.com/ef4))

#### Committers: 1

- Edward Faulkner ([@ef4](https://github.com/ef4))

## v1.8.2 (2022-07-04)

#### :bug: Bug Fix

- `compat`, `shared-internals`
  - [#1230](https://github.com/embroider-build/embroider/pull/1230) Detect addons with customized treeForMethod names ([@ef4](https://github.com/ef4))

#### Committers: 1

- Edward Faulkner ([@ef4](https://github.com/ef4))

## v1.8.1 (2022-07-01)

#### :bug: Bug Fix

- `addon-dev`
  - [#1227](https://github.com/embroider-build/embroider/pull/1227) add-dev: HBS files were not watched for rebuilds ([@ef4](https://github.com/ef4))
- `compat`
  - [#1224](https://github.com/embroider-build/embroider/pull/1224) Don't apply the `ember-get-config` compat adapter when >= v2.1.0 ([@bertdeblock](https://github.com/bertdeblock))
- `macros`
  - [#1213](https://github.com/embroider-build/embroider/pull/1213) Prevent redundant toTree wrapping for macros ([@raycohen](https://github.com/raycohen))

#### :memo: Documentation

- [#1225](https://github.com/embroider-build/embroider/pull/1225) docs: Add lazy loaded engines EmbroiderRouter details to README ([@richgt](https://github.com/richgt))

#### Committers: 4

- Bert De Block ([@bertdeblock](https://github.com/bertdeblock))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Ray Cohen ([@raycohen](https://github.com/raycohen))
- Rich Glazerman ([@richgt](https://github.com/richgt))

## v1.8.0 (2022-06-09)

#### :rocket: Enhancement

- `addon-dev`, `core`, `shared-internals`
  - [#1199](https://github.com/embroider-build/embroider/pull/1199) Add babel plugin for preprocessing templates with ast transforms ([@wondersloth](https://github.com/wondersloth))

#### :bug: Bug Fix

- `webpack`
  - [#1191](https://github.com/embroider-build/embroider/pull/1191) Fix thread-load JOBS handling/documentation ([@bendemboski](https://github.com/bendemboski))
- `addon-dev`
  - [#1215](https://github.com/embroider-build/embroider/pull/1215) Strip extension from reexport of `rollup-app-reexports` ([@simonihmig](https://github.com/simonihmig))
- `core`
  - [#1219](https://github.com/embroider-build/embroider/pull/1219) Fix duplicate HTML content on rebuilds ([@ef4](https://github.com/ef4))
- `compat`
  - [#1205](https://github.com/embroider-build/embroider/pull/1205) Fix preprocessors tree by wrapping with moduleName ([@wondersloth](https://github.com/wondersloth))

#### Committers: 4

- Ben Demboski ([@bendemboski](https://github.com/bendemboski))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Matt Edwards ([@wondersloth](https://github.com/wondersloth))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))

## v1.7.1 (2022-05-24)

#### :bug: Bug Fix

- `core`
  - [#1210](https://github.com/embroider-build/embroider/pull/1210) fastboot should not try to load through publicAssetURL ([@ef4](https://github.com/ef4))
- `webpack`
  - [#1209](https://github.com/embroider-build/embroider/pull/1209) fix default css chunk naming ([@ef4](https://github.com/ef4))

#### Committers: 1

- Edward Faulkner ([@ef4](https://github.com/ef4))

## v1.7.0 (2022-05-23)

#### :rocket: Enhancement

- `addon-dev`
  - [#1202](https://github.com/embroider-build/embroider/pull/1202) Accept optional `mapFilename` config for `rollup-app-reexports` ([@dfreeman](https://github.com/dfreeman))
- `macros`
  - [#1168](https://github.com/embroider-build/embroider/pull/1168) Add message to clarify error for non-serializable configs ([@jkeen](https://github.com/jkeen))

#### :bug: Bug Fix

- `webpack`
  - [#1177](https://github.com/embroider-build/embroider/pull/1177) Write files plugin ([@krisselden](https://github.com/krisselden))
  - [#1194](https://github.com/embroider-build/embroider/pull/1194) Align webpack's outputPath with the whole app ([@ef4](https://github.com/ef4))
- `addon-dev`
  - [#1126](https://github.com/embroider-build/embroider/pull/1126) Fix importing of template-only components in V2 addons ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### :memo: Documentation

- [#1201](https://github.com/embroider-build/embroider/pull/1201) Small Update PORTING-ADDONS-TO-V2.md ([@angelayanpan](https://github.com/angelayanpan))

#### :house: Internal

- `compat`
  - [#1208](https://github.com/embroider-build/embroider/pull/1208) Rebuilding yarn.lock ([@ef4](https://github.com/ef4))

#### Committers: 6

- Angela Pan ([@angelayanpan](https://github.com/angelayanpan))
- Dan Freeman ([@dfreeman](https://github.com/dfreeman))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Jeff Keen ([@jkeen](https://github.com/jkeen))
- Kris Selden ([@krisselden](https://github.com/krisselden))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## v1.6.0 (2022-04-07)

#### :rocket: Enhancement

- `addon-dev`, `compat`, `core`, `hbs-loader`, `shared-internals`, `webpack`
  - [#1010](https://github.com/embroider-build/embroider/pull/1010) template compilation improvements ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix

- `compat`
  - [#1170](https://github.com/embroider-build/embroider/pull/1170) Ensure self-references within a dummy apps work for `@` resolution. ([@rwjblue](https://github.com/rwjblue))
- `addon-dev`
  - [#1171](https://github.com/embroider-build/embroider/pull/1171) FIX: rollup-hbs-plugin add resolveId hook ([@wondersloth](https://github.com/wondersloth))

#### :memo: Documentation

- Other
  - [#1173](https://github.com/embroider-build/embroider/pull/1173) FIX Typos in CONTRIBUTING.md ([@wondersloth](https://github.com/wondersloth))
- `core`, `test-setup`, `util`
  - [#1164](https://github.com/embroider-build/embroider/pull/1164) Update `master` to `main` in links ([@bertdeblock](https://github.com/bertdeblock))
- `macros`
  - [#1159](https://github.com/embroider-build/embroider/pull/1159) README typo: "none-test code" ([@elwayman02](https://github.com/elwayman02))
- `compat`, `core`, `router`
  - [#1161](https://github.com/embroider-build/embroider/pull/1161) Remove outdated core and compat options ([@bertdeblock](https://github.com/bertdeblock))

#### :house: Internal

- [#1186](https://github.com/embroider-build/embroider/pull/1186) Fix tests under ember-data 4.x ([@ef4](https://github.com/ef4))
- [#1167](https://github.com/embroider-build/embroider/pull/1167) register node tests with scenario-tester ([@ef4](https://github.com/ef4))

#### Committers: 5

- Bert De Block ([@bertdeblock](https://github.com/bertdeblock))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Jordan Hawker ([@elwayman02](https://github.com/elwayman02))
- Matt Edwards ([@wondersloth](https://github.com/wondersloth))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))

## v1.5.0 (2022-03-08)

#### :rocket: Enhancement

- `util`
  - [#1155](https://github.com/embroider-build/embroider/pull/1155) Turn ensureSafeComponent into a no-op for class values on Ember 3.25+ ([@Windvis](https://github.com/Windvis))

#### :bug: Bug Fix

- `macros`
  - [#1156](https://github.com/embroider-build/embroider/pull/1156) fix exception in macros babel plugin ([@ef4](https://github.com/ef4))
- `compat`
  - [#1154](https://github.com/embroider-build/embroider/pull/1154) Add `modifier` to the list of built-ins ([@Windvis](https://github.com/Windvis))

#### Committers: 2

- Edward Faulkner ([@ef4](https://github.com/ef4))
- Sam Van Campenhout ([@Windvis](https://github.com/Windvis))

## v1.4.0 (2022-03-07)

#### :rocket: Enhancement

- `compat`
  - [#1151](https://github.com/embroider-build/embroider/pull/1151) Add support for the modifier keyword ([@Windvis](https://github.com/Windvis))

#### :bug: Bug Fix

- `core`
  - [#1152](https://github.com/embroider-build/embroider/pull/1152) improve test suite compat ([@ef4](https://github.com/ef4))
- `compat`
  - [#1150](https://github.com/embroider-build/embroider/pull/1150) Make the helper keyword handling less strict ([@Windvis](https://github.com/Windvis))

#### Committers: 2

- Edward Faulkner ([@ef4](https://github.com/ef4))
- Sam Van Campenhout ([@Windvis](https://github.com/Windvis))

## v1.3.0 (2022-03-04)

#### :rocket: Enhancement

- `webpack`
  - [#1146](https://github.com/embroider-build/embroider/pull/1146) Use MiniCssExtractPlugin for FastBoot builds ([@simonihmig](https://github.com/simonihmig))
- `compat`
  - [#1120](https://github.com/embroider-build/embroider/pull/1120) Add support for the `helper` helper ([@Windvis](https://github.com/Windvis))
  - [#1130](https://github.com/embroider-build/embroider/pull/1130) Only apply `ember-power-select` compat adapter when using `ember-power-select < 5.0.1` ([@betocantu93](https://github.com/betocantu93))

#### :bug: Bug Fix

- `core`, `webpack`
  - [#1140](https://github.com/embroider-build/embroider/pull/1140) Fastboot lazy css support ([@ef4](https://github.com/ef4))
- `core`
  - [#1149](https://github.com/embroider-build/embroider/pull/1149) Update externals stubs atomically ([@ef4](https://github.com/ef4))
- `compat`, `core`
  - [#1145](https://github.com/embroider-build/embroider/pull/1145) Ensure addon `app` trees are merged in the correct order ([@eoneill](https://github.com/eoneill))
- `compat`
  - [#1135](https://github.com/embroider-build/embroider/pull/1135) Fix `@cached` decorator export from fake `@glimmer/tracking` module ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### :memo: Documentation

- Other
  - [#1148](https://github.com/embroider-build/embroider/pull/1148) Fix `package.json` example in V2 porting guide ([@SergeAstapov](https://github.com/SergeAstapov))
  - [#1143](https://github.com/embroider-build/embroider/pull/1143) Update number of steps for porting addon to V2 guide ([@AnastasiiaPlutalova](https://github.com/AnastasiiaPlutalova))
  - [#1137](https://github.com/embroider-build/embroider/pull/1137) Update `Status` section in main README ([@bertdeblock](https://github.com/bertdeblock))
- `addon-dev`
  - [#1133](https://github.com/embroider-build/embroider/pull/1133) Fix typo in V2 addon local development documentation ([@bertdeblock](https://github.com/bertdeblock))

#### :house: Internal

- Other
  - [#1144](https://github.com/embroider-build/embroider/pull/1144) Remove a workaround that is trying fix an old bug in volta ([@krisselden](https://github.com/krisselden))
- `router`, `util`
  - [#1141](https://github.com/embroider-build/embroider/pull/1141) Drive the test suite from scenario-tester ([@ef4](https://github.com/ef4))
- `compat`
  - [#1103](https://github.com/embroider-build/embroider/pull/1103) Update the ember-template-compiler to v4.1.0 ([@Windvis](https://github.com/Windvis))

#### Committers: 10

- Alberto Cantú Gómez ([@betocantu93](https://github.com/betocantu93))
- AnastasiiaPlutalova ([@AnastasiiaPlutalova](https://github.com/AnastasiiaPlutalova))
- Bert De Block ([@bertdeblock](https://github.com/bertdeblock))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Eugene ONeill ([@eoneill](https://github.com/eoneill))
- Kris Selden ([@krisselden](https://github.com/krisselden))
- Sam Van Campenhout ([@Windvis](https://github.com/Windvis))
- Sergey Astapov ([@SergeAstapov](https://github.com/SergeAstapov))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## v1.2.0 (2022-02-10)

#### :rocket: Enhancement

- `compat`
  - [#1124](https://github.com/embroider-build/embroider/pull/1124) improving ember-data compatibility & test coverage ([@ef4](https://github.com/ef4))
- `macros`
  - [#1119](https://github.com/embroider-build/embroider/pull/1119) Reuse the `loc` of the macroMaybeAttrs hashes for the created attributes ([@Windvis](https://github.com/Windvis))

#### :memo: Documentation

- [#1122](https://github.com/embroider-build/embroider/pull/1122) small nitpicking edits in doc ([@angelayanpan](https://github.com/angelayanpan))

#### :house: Internal

- `macros`
  - [#1123](https://github.com/embroider-build/embroider/pull/1123) Regenerate yarn.lock ([@ef4](https://github.com/ef4))

#### Committers: 3

- Angela Pan ([@angelayanpan](https://github.com/angelayanpan))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Sam Van Campenhout ([@Windvis](https://github.com/Windvis))

## v1.1.0 (2022-02-08)

#### :rocket: Enhancement

- `compat`
  - [#1085](https://github.com/embroider-build/embroider/pull/1085) Updates for LTS 3.28 including ember-data ([@ef4](https://github.com/ef4))
  - [#1115](https://github.com/embroider-build/embroider/pull/1115) Use broccoli memoization by default ([@ef4](https://github.com/ef4))
- `addon-dev`
  - [#1106](https://github.com/embroider-build/embroider/pull/1106) Addon Dev - Allow ts,gts,gjs files as publicEntrypoints ([@josemarluedke](https://github.com/josemarluedke))
- `macros`
  - [#1083](https://github.com/embroider-build/embroider/pull/1083) Throw error when setting non-serializable macro config ([@mydea](https://github.com/mydea))

#### :bug: Bug Fix

- `macros`
  - [#1102](https://github.com/embroider-build/embroider/pull/1102) Optimize addonCacheKey computation ([@SergeAstapov](https://github.com/SergeAstapov))
- `core`, `webpack`
  - [#1109](https://github.com/embroider-build/embroider/pull/1109) fastboot chunk preloading fix ([@ef4](https://github.com/ef4))
- `webpack`
  - [#1098](https://github.com/embroider-build/embroider/pull/1098) Improve performance of emitting stats during incremental build ([@krisselden](https://github.com/krisselden))
- `compat`
  - [#1100](https://github.com/embroider-build/embroider/pull/1100) Fix cacheKeyForTree & OneShot incompatibility ([@ef4](https://github.com/ef4))
  - [#1088](https://github.com/embroider-build/embroider/pull/1088) Support "cache" from @glimmer/tracking ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
  - [#1084](https://github.com/embroider-build/embroider/pull/1084) Ensure OneShot tmp dir cleanup ([@krisselden](https://github.com/krisselden))

#### :memo: Documentation

- Other
  - [#1110](https://github.com/embroider-build/embroider/pull/1110) fix small typo in addon author guides ([@jelhan](https://github.com/jelhan))
- `addon-dev`
  - [#1107](https://github.com/embroider-build/embroider/pull/1107) Creating v2 addon guide ([@ef4](https://github.com/ef4))
- `macros`
  - [#1096](https://github.com/embroider-build/embroider/pull/1096) Add section on package requirements to importSync documentation ([@jrjohnson](https://github.com/jrjohnson))

#### :house: Internal

- [#1105](https://github.com/embroider-build/embroider/pull/1105) Cancel workflows when they become outdated ([@Windvis](https://github.com/Windvis))

#### Committers: 9

- Edward Faulkner ([@ef4](https://github.com/ef4))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Jeldrik Hanschke ([@jelhan](https://github.com/jelhan))
- Jon Johnson ([@jrjohnson](https://github.com/jrjohnson))
- Josemar Luedke ([@josemarluedke](https://github.com/josemarluedke))
- Kris Selden ([@krisselden](https://github.com/krisselden))
- Sam Van Campenhout ([@Windvis](https://github.com/Windvis))
- Sergey Astapov ([@SergeAstapov](https://github.com/SergeAstapov))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## v1.0.0 (2022-01-19)

Declaring this as 1.0 to signifiy general level of stability and to give us more flexibility to distinguish minor and patch releases.

#### :internal: Internal

- Renamed default branch from master to main.

#### :bug: Bug Fix

- `macros`
  - [#1081](https://github.com/embroider-build/embroider/pull/1081) fix importSync scope collision ([@ef4](https://github.com/ef4))

#### Committers: 1

- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.50.2 (2022-01-14)

#### :bug: Bug Fix

- `compat`, `macros`
  - [#1076](https://github.com/embroider-build/embroider/pull/1076) add non-es6-compat to importSync ([@ef4](https://github.com/ef4))
- `core`, `macros`
  - [#1075](https://github.com/embroider-build/embroider/pull/1075) native v2 addons can always import from NPM ([@ef4](https://github.com/ef4))

#### Committers: 1

- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.50.1 (2022-01-12)

#### :bug: Bug Fix

- `core`
  - [#1074](https://github.com/embroider-build/embroider/pull/1074) Ensure `babelFilter` config comes from fully qualified `@embroider/core` path in Stage 2 ([@krisselden](https://github.com/krisselden))
- `compat`, `core`, `macros`, `shared-internals`
  - [#1070](https://github.com/embroider-build/embroider/pull/1070) Ensure `dependencySatisfies` only considers actual dependencies (includes a fix for invalid results within monorepo scenarios) ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 2

- Kris Selden ([@krisselden](https://github.com/krisselden))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## v0.50.0 (2022-01-08)

#### :rocket: Enhancement

- `addon-shim`, `core`, `shared-internals`
  - [#1069](https://github.com/embroider-build/embroider/pull/1069) Make addon-shim a non-ember-addon ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix

- `compat`
  - [#1068](https://github.com/embroider-build/embroider/pull/1068) Widen the node_modules exclude pattern when copying v2 addons ([@ef4](https://github.com/ef4))
  - [#1064](https://github.com/embroider-build/embroider/pull/1064) Fix unsafe reuse of broccoli trees in OneShot ([@ef4](https://github.com/ef4))

#### Committers: 1

- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.49.0 (2021-12-21)

#### :rocket: Enhancement

- `webpack`
  - [#1055](https://github.com/embroider-build/embroider/pull/1055) Accept custom `css-loader` and `style-loader` config in `@embroider/webpack` ([@dfreeman](https://github.com/dfreeman))
- `addon-shim`
  - [#1052](https://github.com/embroider-build/embroider/pull/1052) restore tree caching via `cacheKeyForTree` ([@RuslanZavacky](https://github.com/RuslanZavacky))

#### :bug: Bug Fix

- `core`
  - [#1048](https://github.com/embroider-build/embroider/pull/1048) Fix imported CSS with FastBoot ([@simonihmig](https://github.com/simonihmig))
  - [#1045](https://github.com/embroider-build/embroider/pull/1045) Append styles imported in JS to end of `document.head` ([@simonihmig](https://github.com/simonihmig))
- `macros`
  - [#1059](https://github.com/embroider-build/embroider/pull/1059) cleanup test copy-paste errors ([@ef4](https://github.com/ef4))
- `compat`, `util`
  - [#1053](https://github.com/embroider-build/embroider/pull/1053) resolve failed macro condition in ember-private-api ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
- `compat`, `core`, `shared-internals`
  - [#1043](https://github.com/embroider-build/embroider/pull/1043) Make extraImports lazy ([@ef4](https://github.com/ef4))

#### :house: Internal

- [#1044](https://github.com/embroider-build/embroider/pull/1044) Fix typo in file assertion test matcher ([@rwjblue](https://github.com/rwjblue))

#### Committers: 6

- Dan Freeman ([@dfreeman](https://github.com/dfreeman))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Ruslan Zavacky ([@RuslanZavacky](https://github.com/RuslanZavacky))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## v0.48.1 (2021-12-08)

#### :bug: Bug Fix

- `compat`
  - [#1042](https://github.com/embroider-build/embroider/pull/1042) Fix ember-cli-babel optimization ([@ef4](https://github.com/ef4))

#### Committers: 1

- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.48.0 (2021-12-07)

#### :rocket: Enhancement

- `compat`, `core`, `router`
  - [#1021](https://github.com/embroider-build/embroider/pull/1021) Add `staticModifiers` option ([@Windvis](https://github.com/Windvis))

#### :bug: Bug Fix

- `compat`
  - [#1029](https://github.com/embroider-build/embroider/pull/1029) Don't resolve built-in components when used with the component helper ([@Windvis](https://github.com/Windvis))
  - [#1030](https://github.com/embroider-build/embroider/pull/1030) fix the ember-get-config compat adapter ([@ef4](https://github.com/ef4))
  - [#1035](https://github.com/embroider-build/embroider/pull/1035) Optimize ember-cli-babel handling ([@ef4](https://github.com/ef4))

#### :memo: Documentation

- `macros`
  - [#1031](https://github.com/embroider-build/embroider/pull/1031) Add `isTesting` and `isDevelopingApp` to readme ([@mydea](https://github.com/mydea))

#### :house: Internal

- `router`
  - [#1027](https://github.com/embroider-build/embroider/pull/1027) `@embroider/router` Ember 4 CI job compatibility ([@Windvis](https://github.com/Windvis))

#### Committers: 3

- Edward Faulkner ([@ef4](https://github.com/ef4))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Sam Van Campenhout ([@Windvis](https://github.com/Windvis))

## v0.47.2 (2021-11-11)

#### :bug: Bug Fix

- `compat`
  - [#1017](https://github.com/embroider-build/embroider/pull/1017) Ensure components + helpers can work from `this` paths with `staticComponents = true` & `staticHelpers = true` ([@thoov](https://github.com/thoov))
- `addon-dev`
  - [#1015](https://github.com/embroider-build/embroider/pull/1015) Address misleading warnings from rollup about externals ([@ef4](https://github.com/ef4))

#### :memo: Documentation

- `compat`
  - [#1011](https://github.com/embroider-build/embroider/pull/1011) Minor typo fix ([@thoov](https://github.com/thoov))

#### Committers: 2

- Edward Faulkner ([@ef4](https://github.com/ef4))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.47.1 (2021-10-25)

#### :rocket: Enhancement

- `compat`
  - [#1008](https://github.com/embroider-build/embroider/pull/1008) Support @ syntax in helpers ([@thoov](https://github.com/thoov))

#### :bug: Bug Fix

- `compat`
  - [#1009](https://github.com/embroider-build/embroider/pull/1009) Apply compileStyles to custom treeForAddonStyles ([@ef4](https://github.com/ef4))
- `compat`, `core`
  - [#1007](https://github.com/embroider-build/embroider/pull/1007) Fix exclusion of the hbs file of the pod components when `podModulePrefix === ''` ([@dcyriller](https://github.com/dcyriller))

#### :memo: Documentation

- `addon-shim`
  - [#1005](https://github.com/embroider-build/embroider/pull/1005) Remove command documentation from `addon-shim` package ([@simonihmig](https://github.com/simonihmig))

#### Committers: 4

- Cyrille ([@dcyriller](https://github.com/dcyriller))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.47.0 (2021-10-14)

#### :rocket: Enhancement

- `compat`, `core`, `macros`, `shared-internals`
  - [#893](https://github.com/embroider-build/embroider/pull/893) Support strict mode templates ([@ef4](https://github.com/ef4))

#### Committers: 1

- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.46.2 (2021-10-11)

#### :bug: Bug Fix

- `addon-dev`
  - [#1003](https://github.com/embroider-build/embroider/pull/1003) addon-dev: list published files explicitly ([@ef4](https://github.com/ef4))

#### Committers: 1

- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.46.1 (2021-10-11)

#### :bug: Bug Fix

- `addon-dev`
  - [#1002](https://github.com/embroider-build/embroider/pull/1002) addon-dev needs a prepare script ([@ef4](https://github.com/ef4))

#### Committers: 1

- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.46.0 (2021-10-11)

#### :boom: Breaking Change

- `addon-dev`, `addon-shim`, `compat`, `core`, `shared-internals`
  - [#1001](https://github.com/embroider-build/embroider/pull/1001) Create addon-dev package ([@ef4](https://github.com/ef4))

#### :rocket: Enhancement

- `addon-dev`, `addon-shim`, `compat`, `core`, `shared-internals`
  - [#1001](https://github.com/embroider-build/embroider/pull/1001) Create addon-dev package ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix

- `core`
  - [#974](https://github.com/embroider-build/embroider/pull/974) Production fastboot builds were incorrectly getting server code in the browser ([@thoov](https://github.com/thoov))
- `macros`
  - [#990](https://github.com/embroider-build/embroider/pull/990) Invalidate @embroider/macro's babel cache when addon version's change without mutating lock file (e.g. linking) ([@thoov](https://github.com/thoov))

#### :memo: Documentation

- `router`
  - [#930](https://github.com/embroider-build/embroider/pull/930) add note on route splitting with pods in readme ([@mydea](https://github.com/mydea))

#### :house: Internal

- `core`
  - [#989](https://github.com/embroider-build/embroider/pull/989) use babel-import-util ([@ef4](https://github.com/ef4))
  - [#988](https://github.com/embroider-build/embroider/pull/988) Remove leftover Babel 6 compatibility code ([@ef4](https://github.com/ef4))

#### Committers: 3

- Edward Faulkner ([@ef4](https://github.com/ef4))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.45.0 (2021-09-30)

#### :boom: Breaking Change

- `compat`
  - [#976](https://github.com/embroider-build/embroider/pull/976) Restructure workspaceDir logic ([@thoov](https://github.com/thoov)). This removes an (undocumented) feature for the workspace dir from the build, it's unlikely to break in any normal usage.

#### :rocket: Enhancement

- `addon-shim`
  - [#981](https://github.com/embroider-build/embroider/pull/981) v2 addon utility commands ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix

- `core`
  - [#985](https://github.com/embroider-build/embroider/pull/985) Fix an erroneous assertion in v2 addons ([@ef4](https://github.com/ef4))

#### :house: Internal

- `compat`
  - [#976](https://github.com/embroider-build/embroider/pull/976) Restructure workspaceDir logic ([@thoov](https://github.com/thoov))
  - [#980](https://github.com/embroider-build/embroider/pull/980) Convert stage-1 tests to test-scenarios ([@thoov](https://github.com/thoov))
- Other
  - [#986](https://github.com/embroider-build/embroider/pull/986) Ensure static test runs in production mode ([@thoov](https://github.com/thoov))

#### Committers: 2

- Edward Faulkner ([@ef4](https://github.com/ef4))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.44.2 (2021-09-26)

#### :bug: Bug Fix

- `compat`, `core`, `router`, `shared-internals`, `util`
  - [#978](https://github.com/embroider-build/embroider/pull/978) backing out ember real-modules mode (fixes some edge cases on ember 3.27 and 3.28) ([@ef4](https://github.com/ef4))

#### :house: Internal

- Other
  - [#977](https://github.com/embroider-build/embroider/pull/977) Convert fastboot-addon to test scenarios ([@thoov](https://github.com/thoov))
  - [#975](https://github.com/embroider-build/embroider/pull/975) Unify CI matrix generation and linting job ([@stefanpenner](https://github.com/stefanpenner))
  - [#964](https://github.com/embroider-build/embroider/pull/964) Clean up fastboot app scenario test ([@thoov](https://github.com/thoov))
- `compat`, `router`, `util`
  - [#961](https://github.com/embroider-build/embroider/pull/961) Upgrade `ember-cli` to latest throughout test infrastructure ([@stefanpenner](https://github.com/stefanpenner))
- `addon-shim`, `compat`, `core`, `hbs-loader`, `macros`, `shared-internals`, `util`, `webpack`
  - [#967](https://github.com/embroider-build/embroider/pull/967) Upgrade TypeScript ([@stefanpenner](https://github.com/stefanpenner))

#### Committers: 3

- Edward Faulkner ([@ef4](https://github.com/ef4))
- Stefan Penner ([@stefanpenner](https://github.com/stefanpenner))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.44.1 (2021-09-07)

#### :rocket: Enhancement

- `addon-shim`, `compat`, `router`, `util`
  - [#959](https://github.com/embroider-build/embroider/pull/959) Upgrade ember-auto-import to latest in `@embroider/addon-shim` ([@stefanpenner](https://github.com/stefanpenner))

#### :bug: Bug Fix

- `compat`
  - [#958](https://github.com/embroider-build/embroider/pull/958) Add allowEmpty to `__COMPILED_STYLES__` funnel ([@thoov](https://github.com/thoov))

#### :house: Internal

- `router`, `util`
  - [#960](https://github.com/embroider-build/embroider/pull/960) Upgrade qunit ([@stefanpenner](https://github.com/stefanpenner))

#### Committers: 2

- Stefan Penner ([@stefanpenner](https://github.com/stefanpenner))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.44.0 (2021-09-02)

#### :boom: Breaking Change

- `webpack`
  - [#877](https://github.com/embroider-build/embroider/pull/877) [BREAKING] Respect JOBS count if present ([@stefanpenner](https://github.com/stefanpenner))

#### :rocket: Enhancement

- `compat`
  - [#941](https://github.com/embroider-build/embroider/pull/941) Add support for ember-cli addon proxy (bundle caching) ([@eoneill](https://github.com/eoneill))

#### :bug: Bug Fix

- `compat`
  - [#953](https://github.com/embroider-build/embroider/pull/953) fixes: Local helpers not resolved in tests #894 ([@lifeart](https://github.com/lifeart))
  - [#948](https://github.com/embroider-build/embroider/pull/948) Disable compat adapter for ember-inflector >= 4.0.0 (since it is not needed) ([@stefanpenner](https://github.com/stefanpenner))
  - [#934](https://github.com/embroider-build/embroider/pull/934) Ensure style compilation works properly with ember-cli >= 3.18 ([@stefanpenner](https://github.com/stefanpenner))
  - [#924](https://github.com/embroider-build/embroider/pull/924) Fix caching of template AST plugins (follow caching protocol of ember-cli-htmlbars) ([@eoneill](https://github.com/eoneill))
  - [#928](https://github.com/embroider-build/embroider/pull/928) Update custom package rules for ember-basic-dropdown ([@mydea](https://github.com/mydea))
- `router`
  - [#929](https://github.com/embroider-build/embroider/pull/929) Use @ember/test-waiters in @embroider/router ([@mydea](https://github.com/mydea))

#### :memo: Documentation

- [#923](https://github.com/embroider-build/embroider/pull/923) Add documentation how to use safe components in tests ([@mydea](https://github.com/mydea))

#### :house: Internal

- `addon-shim`, `compat`, `core`, `shared-internals`
  - [#955](https://github.com/embroider-build/embroider/pull/955) chore: improve package json typings ([@lifeart](https://github.com/lifeart))
- Other
  - [#937](https://github.com/embroider-build/embroider/pull/937) Tighten CI job timeout down to 15min ([@stefanpenner](https://github.com/stefanpenner))
  - [#944](https://github.com/embroider-build/embroider/pull/944) Fix SourceMaps when debugging published embroider ([@stefanpenner](https://github.com/stefanpenner))
  - [#942](https://github.com/embroider-build/embroider/pull/942) Update ember data ([@stefanpenner](https://github.com/stefanpenner))
  - [#940](https://github.com/embroider-build/embroider/pull/940) Limit linting and matrix discovery CI jobs to 5 minutes ([@stefanpenner](https://github.com/stefanpenner))
  - [#938](https://github.com/embroider-build/embroider/pull/938) Moving cache busting tests to separate CI job ([@thoov](https://github.com/thoov))
  - [#843](https://github.com/embroider-build/embroider/pull/843) [hygiene] Volta pin latest node / yarn ([@stefanpenner](https://github.com/stefanpenner))
  - [#925](https://github.com/embroider-build/embroider/pull/925) upgrade @ember/test-helpers ([@stefanpenner](https://github.com/stefanpenner))
- `router`
  - [#949](https://github.com/embroider-build/embroider/pull/949) Convert macro-sample-addon to new test scenario infra ([@thoov](https://github.com/thoov))
- `router`, `util`
  - [#935](https://github.com/embroider-build/embroider/pull/935) Bump ember-source in test scenarios to at-least ~3.22.0 ([@stefanpenner](https://github.com/stefanpenner))
  - [#933](https://github.com/embroider-build/embroider/pull/933) [Closes [#932](https://github.com/embroider-build/embroider/issues/932)] fix ember-canary test scenario ([@stefanpenner](https://github.com/stefanpenner))
  - [#925](https://github.com/embroider-build/embroider/pull/925) upgrade @ember/test-helpers ([@stefanpenner](https://github.com/stefanpenner))

#### Committers: 5

- Alex Kanunnikov ([@lifeart](https://github.com/lifeart))
- Eugene ONeill ([@eoneill](https://github.com/eoneill))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Stefan Penner ([@stefanpenner](https://github.com/stefanpenner))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.43.5 (2021-08-09)

#### :rocket: Enhancement

- `compat`
  - [#918](https://github.com/embroider-build/embroider/pull/918) Add `needsCache` and `persistentOutput` to internal broccoli-plugins. ([@rwjblue](https://github.com/rwjblue))

#### :bug: Bug Fix

- `core`, `macros`, `shared-internals`
  - [#913](https://github.com/embroider-build/embroider/pull/913) Ensure `dependencySatisfies` invalidates when installed packages change ([@thoov](https://github.com/thoov))

#### :house: Internal

- [#917](https://github.com/embroider-build/embroider/pull/917) Improve Heimdall Types ([@krisselden](https://github.com/krisselden))

#### Committers: 3

- Kris Selden ([@krisselden](https://github.com/krisselden))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.43.4 (2021-08-03)

#### :rocket: Enhancement

- `compat`
  - [#915](https://github.com/embroider-build/embroider/pull/915) Reduce memory pressure from compat layer by disabling Heimdall node gathering during OneShotPlugin ([@rwjblue](https://github.com/rwjblue))

#### Committers: 2

- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Kris Selden ([@krisselden](https://github.com/krisselden))

## v0.43.3 (2021-07-30)

#### :bug: Bug Fix

- `compat`
  - [#910](https://github.com/embroider-build/embroider/pull/910) Fix arguments to `preprocessCss` (to match classic build) ([@thoov](https://github.com/thoov))
  - [#880](https://github.com/embroider-build/embroider/pull/880) Fix compatibility with ember-data@3.27+ ([@ef4](https://github.com/ef4))
- `webpack`
  - [#914](https://github.com/embroider-build/embroider/pull/914) Remove transitive `loader-utils` dependency from `@embroider/webpack` ([@mydea](https://github.com/mydea))

#### Committers: 3

- Edward Faulkner ([@ef4](https://github.com/ef4))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.43.2 (2021-07-29)

#### :rocket: Enhancement

- `compat`, `core`
  - [#912](https://github.com/embroider-build/embroider/pull/912) Use `require` for retrieving the adjust imports info ([@krisselden](https://github.com/krisselden))

#### :bug: Bug Fix

- `hbs-loader`
  - [#831](https://github.com/embroider-build/embroider/pull/831) Replace loader-utils with built-in webpack 5 functionality ([@mydea](https://github.com/mydea))

#### :house: Internal

- `router`
  - [#911](https://github.com/embroider-build/embroider/pull/911) Upgrade ember-qunit to address canary deprecations ([@ef4](https://github.com/ef4))

#### Committers: 3

- Edward Faulkner ([@ef4](https://github.com/ef4))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Kris Selden ([@krisselden](https://github.com/krisselden))

## v0.43.1 (2021-07-28)

#### :rocket: Enhancement

- `compat`, `core`
  - [#907](https://github.com/embroider-build/embroider/pull/907) Deflate AdjustImportsOptions ([@krisselden](https://github.com/krisselden))

#### :bug: Bug Fix

- `core`
  - [#899](https://github.com/embroider-build/embroider/pull/899) support inert TemplateLiteral in hbs plugin ([@eoneill](https://github.com/eoneill))
- `compat`
  - [#900](https://github.com/embroider-build/embroider/pull/900) Only patch `ember-cli-deprecation-workflow` releases before `2.0.0` ([@alexlafroscia](https://github.com/alexlafroscia))
  - [#904](https://github.com/embroider-build/embroider/pull/904) Fix ember-test-selectors custom adapter for 6.x ([@mydea](https://github.com/mydea))

#### Committers: 5

- Alex LaFroscia ([@alexlafroscia](https://github.com/alexlafroscia))
- Eugene ONeill ([@eoneill](https://github.com/eoneill))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Kris Selden ([@krisselden](https://github.com/krisselden))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.43.0 (2021-07-13)

#### :boom: Breaking Change

- `macros`
  - [#888](https://github.com/embroider-build/embroider/pull/888) Expose sourceOfConfig to macro config mergers ([@mydea](https://github.com/mydea))
- `babel-loader-7`, `compat`, `core`, `macros`, `shared-internals`, `webpack`
  - [#890](https://github.com/embroider-build/embroider/pull/890) Drop support for apps that use babel 6 ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix

- `macros`
  - [#886](https://github.com/embroider-build/embroider/pull/886) `undefined` does not serialize with broccoli-babel-transpiler ([@thoov](https://github.com/thoov))
- `core`, `shared-internals`, `webpack`
  - [#881](https://github.com/embroider-build/embroider/pull/881) Fix race condition finding the owning package of a given file when using multiple workers ([@ef4](https://github.com/ef4))

#### Committers: 3

- Edward Faulkner ([@ef4](https://github.com/ef4))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.42.3 (2021-06-28)

#### :rocket: Enhancement

- `core`
  - [#875](https://github.com/embroider-build/embroider/pull/875) Improve Webpack logging output ([@stefanpenner](https://github.com/stefanpenner))

#### :bug: Bug Fix

- `macros`
  - [#865](https://github.com/embroider-build/embroider/pull/865) Enable parallelization of @embroider/macros in non-Embroider builds ([@thoov](https://github.com/thoov))
- `core`
  - [#872](https://github.com/embroider-build/embroider/pull/872) Template compiler plugin not removed due to bad path comparison on Windows ([@thoov](https://github.com/thoov))
- `compat`, `core`, `shared-internals`, `webpack`
  - [#870](https://github.com/embroider-build/embroider/pull/870) Ensure tmpdir usage internally is always the realpath ([@stefanpenner](https://github.com/stefanpenner))

#### :house: Internal

- `compat`
  - [#878](https://github.com/embroider-build/embroider/pull/878) redundant path resolution ([@ef4](https://github.com/ef4))
- Other
  - [#874](https://github.com/embroider-build/embroider/pull/874) Convert `sample-lib` to new test infra ([@thoov](https://github.com/thoov))

#### Committers: 3

- Edward Faulkner ([@ef4](https://github.com/ef4))
- Stefan Penner ([@stefanpenner](https://github.com/stefanpenner))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.42.2 (2021-06-23)

#### :bug: Bug Fix

- `babel-loader-8`, `webpack`
  - [#868](https://github.com/embroider-build/embroider/pull/868) Fix issue with thread-loader + babel-loader performance ([@krisselden](https://github.com/krisselden))

#### :house: Internal

- Other
  - [#869](https://github.com/embroider-build/embroider/pull/869) Fix infinite loop in local testing scenario building ([@krisselden](https://github.com/krisselden))
- `addon-shim`, `util`
  - [#864](https://github.com/embroider-build/embroider/pull/864) Add missing typescript devDependency ([@rwjblue](https://github.com/rwjblue))

#### Committers: 2

- Kris Selden ([@krisselden](https://github.com/krisselden))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))

## v0.42.1 (2021-06-18)

#### :rocket: Enhancement

- `webpack`
  - [#860](https://github.com/embroider-build/embroider/pull/860) Ensure all errors are reported when an error occurs in webpack ([@rwjblue](https://github.com/rwjblue))

#### :bug: Bug Fix

- `util`
  - [#863](https://github.com/embroider-build/embroider/pull/863) Restore typings for `@embroider/util` ([@simonihmig](https://github.com/simonihmig))
- `compat`
  - [#853](https://github.com/embroider-build/embroider/pull/853) Better error message when an asset cannot be found in entry file ([@thoov](https://github.com/thoov))

#### :house: Internal

- Other
  - [#861](https://github.com/embroider-build/embroider/pull/861) Remove test-packages: macro-test and funky-sample-addon ([@thoov](https://github.com/thoov))
  - [#859](https://github.com/embroider-build/embroider/pull/859) Convert macro-test to new test structure ([@thoov](https://github.com/thoov))
  - [#858](https://github.com/embroider-build/embroider/pull/858) Remove ember-engines version pin ([@thoov](https://github.com/thoov))
  - [#854](https://github.com/embroider-build/embroider/pull/854) Convert engines-host-app to new test structure ([@thoov](https://github.com/thoov))
- `compat`
  - [#856](https://github.com/embroider-build/embroider/pull/856) Remove eager-engine, lazy-engine, and engine-host-app ([@thoov](https://github.com/thoov))

#### Committers: 3

- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.42.0 (2021-06-15)

#### :boom: Breaking Change

- `addon-shim`, `babel-loader-7`, `compat`, `core`, `hbs-loader`, `macros`, `router`, `shared-internals`, `test-setup`, `util`, `webpack`
  - [#852](https://github.com/embroider-build/embroider/pull/852) Drop support for Node 10, 11, 13, and 15. ([@rwjblue](https://github.com/rwjblue))

#### :bug: Bug Fix

- `core`
  - [#851](https://github.com/embroider-build/embroider/pull/851) Fix missing exports in @embroider/core `package.json` ([@thoov](https://github.com/thoov))
  - [#841](https://github.com/embroider-build/embroider/pull/841) Ensure babel transpilation cache is invalided when changing versions of babel plugins or AST transforms ([@stefanpenner](https://github.com/stefanpenner))
- `compat`, `core`, `macros`
  - [#839](https://github.com/embroider-build/embroider/pull/839) Fix Babel-Loader Caching for ember-template-compiler ([@stefanpenner](https://github.com/stefanpenner))
- `addon-shim`
  - [#828](https://github.com/embroider-build/embroider/pull/828) Update addon-shim to use ember-auto-import v2 final ([@josemarluedke](https://github.com/josemarluedke))

#### :house: Internal

- `addon-shim`, `compat`, `core`, `hbs-loader`, `macros`, `shared-internals`, `test-setup`, `util`, `webpack`
  - [#844](https://github.com/embroider-build/embroider/pull/844) Upgrade dependencies/devDependencies ([@stefanpenner](https://github.com/stefanpenner))
- Other
  - [#842](https://github.com/embroider-build/embroider/pull/842) Re-roll `yarn.lock` ([@stefanpenner](https://github.com/stefanpenner))
  - [#840](https://github.com/embroider-build/embroider/pull/840) Run linting in CI before running the full matrix of jobs ([@rwjblue](https://github.com/rwjblue))
  - [#837](https://github.com/embroider-build/embroider/pull/837) Remove `ember-cli-htmlbars-inline-precompile` in test packages ([@stefanpenner](https://github.com/stefanpenner))
  - [#832](https://github.com/embroider-build/embroider/pull/832) Schedule CI runs daily ([@rwjblue](https://github.com/rwjblue))
- `webpack`
  - [#838](https://github.com/embroider-build/embroider/pull/838) Ensure errors in `webpack.run` callback always reject ([@stefanpenner](https://github.com/stefanpenner))
- `addon-shim`
  - [#820](https://github.com/embroider-build/embroider/pull/820) Add `@embroider/addon-shim` repository data to package.json ([@rwjblue](https://github.com/rwjblue))

#### Committers: 4

- Josemar Luedke ([@josemarluedke](https://github.com/josemarluedke))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Stefan Penner ([@stefanpenner](https://github.com/stefanpenner))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.41.0 (2021-05-20)

#### :rocket: Enhancement

- `webpack`
  - [#812](https://github.com/embroider-build/embroider/pull/812) Update thread-loader to get RegExp serialization ([@bendemboski](https://github.com/bendemboski))
  - [#796](https://github.com/embroider-build/embroider/pull/796) Allow customization of Webpack's babel loader options ([@charlespierce](https://github.com/charlespierce))
  - [#795](https://github.com/embroider-build/embroider/pull/795) Allow `thread-loader` configuration ([@bendemboski](https://github.com/bendemboski))
- `compat`
  - [#770](https://github.com/embroider-build/embroider/pull/770) Add compat adapter for `ember-get-config` ([@alexlafroscia](https://github.com/alexlafroscia))
  - [#772](https://github.com/embroider-build/embroider/pull/772) Allow compat adapter's to expose shouldApplyAdapter ([@thoov](https://github.com/thoov))

#### :bug: Bug Fix

- `addon-shim`, `compat`, `core`, `util`
  - [#766](https://github.com/embroider-build/embroider/pull/766) Update to broccoli-funnel@3.0.5 ([@rwjblue](https://github.com/rwjblue))
- `compat`
  - [#797](https://github.com/embroider-build/embroider/pull/797) Use configPath to locate the configuration file, instead of assuming a fixed path ([@charlespierce](https://github.com/charlespierce))
  - [#784](https://github.com/embroider-build/embroider/pull/784) Remove usage of the Ember global ([@sandydoo](https://github.com/sandydoo))
  - [#785](https://github.com/embroider-build/embroider/pull/785) Improve semver checks for the modules polyfill ([@sandydoo](https://github.com/sandydoo))
- `test-setup`
  - [#792](https://github.com/embroider-build/embroider/pull/792) Install `webpack` alongside `@embroider/webpack` when using `@embroider/test-setup` ([@alexlafroscia](https://github.com/alexlafroscia))
- `webpack`
  - [#791](https://github.com/embroider-build/embroider/pull/791) Better error message with webpack v4 installed ([@bendemboski](https://github.com/bendemboski))

#### :memo: Documentation

- `addon-shim`
  - [#804](https://github.com/embroider-build/embroider/pull/804) Fix installation instructions in @embroider/addon-shim ([@rwjblue](https://github.com/rwjblue))
- `util`
  - [#807](https://github.com/embroider-build/embroider/pull/807) Add repository entry for the @embroider/util package ([@mansona](https://github.com/mansona))
- Other
  - [#789](https://github.com/embroider-build/embroider/pull/789) Update README for webpack install requirement ([@bendemboski](https://github.com/bendemboski))
  - [#782](https://github.com/embroider-build/embroider/pull/782) docs: for setting publicAssetUrl in non-production environments ([@timiyay](https://github.com/timiyay))

#### :house: Internal

- `compat`, `core`, `test-setup`, `webpack`
  - [#765](https://github.com/embroider-build/embroider/pull/765) Packager Refactoring ([@alexlafroscia](https://github.com/alexlafroscia))
- Other
  - [#774](https://github.com/embroider-build/embroider/pull/774) Convert static-app to new test structure ([@thoov](https://github.com/thoov))
  - [#816](https://github.com/embroider-build/embroider/pull/816) Limit CI jobs to 30 minutes ([@rwjblue](https://github.com/rwjblue))
  - [#790](https://github.com/embroider-build/embroider/pull/790) Update app template dependency versions ([@bendemboski](https://github.com/bendemboski))
- `addon-shim`
  - [#776](https://github.com/embroider-build/embroider/pull/776) github actions failing silently ([@ef4](https://github.com/ef4))

#### Committers: 9

- Alex LaFroscia ([@alexlafroscia](https://github.com/alexlafroscia))
- Ben Demboski ([@bendemboski](https://github.com/bendemboski))
- Charles Pierce ([@charlespierce](https://github.com/charlespierce))
- Chris Manson ([@mansona](https://github.com/mansona))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Sander Melnikov ([@sandydoo](https://github.com/sandydoo))
- Travis Hoover ([@thoov](https://github.com/thoov))
- [@timiyay](https://github.com/timiyay)

## v0.40.0 (2021-04-24)

#### :boom: Breaking Change

- `compat`, `core`, `hbs-loader`, `shared-internals`, `webpack`
  - [#652](https://github.com/embroider-build/embroider/pull/652) webpack 5 ([@ef4](https://github.com/ef4)).
    - If you have customized webpack config, you may need to update it for webpack 5.
    - webpack is now a peerDependency of @embroider/webpack so you have more direct control over its version and can import any plugins out of it that you might need

#### :rocket: Enhancement

- `compat`
  - [#754](https://github.com/embroider-build/embroider/pull/754) compatibility with ember-cli-htmlbars serialization for improved build performance ([@ef4](https://github.com/ef4))
  - [#763](https://github.com/embroider-build/embroider/pull/763) Add Compat Adapter for `@html-next/vertical-collection` ([@alexlafroscia](https://github.com/alexlafroscia))
- `addon-shim`, `shared-internals`, `util`
  - [#773](https://github.com/embroider-build/embroider/pull/773) Updates to addon shim ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix

- `compat`
  - [#728](https://github.com/embroider-build/embroider/pull/728) Avoid building excessive copies of addons that appear in peerDependencies ([@charlespierce](https://github.com/charlespierce))
- `compat`, `core`, `router`, `shared-internals`, `util`, `webpack`
  - [#752](https://github.com/embroider-build/embroider/pull/752) add Windows support to CI matrix ([@thoov](https://github.com/thoov))

#### :memo: Documentation

- [#753](https://github.com/embroider-build/embroider/pull/753) Readme: Add splitAtRoutes to options ([@scottmessinger](https://github.com/scottmessinger))

#### :house: Internal

- Other
  - [#775](https://github.com/embroider-build/embroider/pull/775) update scenario-tester ([@ef4](https://github.com/ef4))
- `router`
  - [#756](https://github.com/embroider-build/embroider/pull/756) Leverage test-scenarios from ember-auto-import ([@thoov](https://github.com/thoov))

#### Committers: 6

- Alex LaFroscia ([@alexlafroscia](https://github.com/alexlafroscia))
- Charles Pierce ([@charlespierce](https://github.com/charlespierce))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Scott Ames-Messinger ([@scottmessinger](https://github.com/scottmessinger))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.39.1 (2021-03-31)

#### :bug: Bug Fix

- `compat`
  - [#751](https://github.com/embroider-build/embroider/pull/751) Fix node 10 support ([@thoov](https://github.com/thoov))

#### Committers: 1

- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.39.0 (2021-03-31)

#### :rocket: Enhancement

- `core`, `shared-internals`
  - [#749](https://github.com/embroider-build/embroider/pull/749) exposing some features for browser-based build tools ([@ef4](https://github.com/ef4))

#### Committers: 1

- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.38.0 (2021-03-31)

#### :rocket: Enhancement

- `compat`, `core`, `shared-internals`, `util`
  - [#732](https://github.com/embroider-build/embroider/pull/732) v2 addon shim ([@ef4](https://github.com/ef4))
- `compat`, `core`, `macros`, `shared-internals`
  - [#748](https://github.com/embroider-build/embroider/pull/748) Supporting more build environments ([@ef4](https://github.com/ef4))
  - [#737](https://github.com/embroider-build/embroider/pull/737) reduce deps in macros and util packages ([@ef4](https://github.com/ef4))
- `compat`, `core`, `test-setup`, `util`, `webpack`
  - [#740](https://github.com/embroider-build/embroider/pull/740) Use "real modules" for ember-source when possible (3.27+) ([@ef4](https://github.com/ef4))
- `core`
  - [#736](https://github.com/embroider-build/embroider/pull/736) silence warning about babel formatting while patching template compiler ([@ef4](https://github.com/ef4))
- `compat`
  - [#721](https://github.com/embroider-build/embroider/pull/721) easier stage2-only config ([@ef4](https://github.com/ef4))
  - [#715](https://github.com/embroider-build/embroider/pull/715) support EMBROIDER_REBUILD_ADDONS for pure v2 addons ([@ef4](https://github.com/ef4))
- `webpack`
  - [#720](https://github.com/embroider-build/embroider/pull/720) Improve error message when module cannot be found in webpack ([@thoov](https://github.com/thoov))

#### :bug: Bug Fix

- `core`, `shared-internals`
  - [#742](https://github.com/embroider-build/embroider/pull/742) Improving Windows support ([@thoov](https://github.com/thoov))
- `compat`
  - [#747](https://github.com/embroider-build/embroider/pull/747) Add better support for skipping Stage 1 transforms that are not needed ([@ef4](https://github.com/ef4))
- `hbs-loader`
  - [#735](https://github.com/embroider-build/embroider/pull/735) fixing a typo in peerDep range in hbs-loader ([@ef4](https://github.com/ef4))

#### :memo: Documentation

- [#716](https://github.com/embroider-build/embroider/pull/716) Add documentation about publicAssetURL to README ([@lukemelia](https://github.com/lukemelia))

#### :house: Internal

- [#743](https://github.com/embroider-build/embroider/pull/743) Migrate from rwjblue/setup-volta to volta-cli/action. ([@rwjblue](https://github.com/rwjblue))

#### Committers: 4

- Edward Faulkner ([@ef4](https://github.com/ef4))
- Luke Melia ([@lukemelia](https://github.com/lukemelia))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Travis Hoover ([@thoov](https://github.com/thoov))

## v0.37.0 (2021-03-08)

#### :rocket: Enhancement

- `core`
  - [#713](https://github.com/embroider-build/embroider/pull/713) Avoid monkey patching template compiler for 3.24.3 and 3.25.2+. ([@rwjblue](https://github.com/rwjblue))
  - [#705](https://github.com/embroider-build/embroider/pull/705) Avoid patching the template compiler on Ember 3.26. ([@rwjblue](https://github.com/rwjblue))
  - [#700](https://github.com/embroider-build/embroider/pull/700) TemplateCompiler fixes / improvements (avoid monkey patch for Ember 3.27+) ([@rwjblue](https://github.com/rwjblue))
- `macros`
  - [#712](https://github.com/embroider-build/embroider/pull/712) Allow macroCondition inside modifier ([@simonihmig](https://github.com/simonihmig))
  - [#694](https://github.com/embroider-build/embroider/pull/694) Run importSync transform later, so ember-auto-import can support importSync ([@simonihmig](https://github.com/simonihmig))

#### :bug: Bug Fix

- `compat`
  - [#710](https://github.com/embroider-build/embroider/pull/710) Fix case where `autoRun` is `false` but no other addon set content into the `{{content-for 'app-boot'}}` ([@thoov](https://github.com/thoov))
  - [#674](https://github.com/embroider-build/embroider/pull/674) adjust paths seen by css preprocessors ([@ef4](https://github.com/ef4))
  - [#702](https://github.com/embroider-build/embroider/pull/702) Handle case where node_modules are symlinked ([@thoov](https://github.com/thoov))
  - [#690](https://github.com/embroider-build/embroider/pull/690) Exclude 'babel-plugin-compact-reexports' during Stage 1 build ([@charlespierce](https://github.com/charlespierce))
  - [#687](https://github.com/embroider-build/embroider/pull/687) Strip `main` field from v1 addons' `package.json` once they are rewritten as V2 ([@ef4](https://github.com/ef4))
- `compat`, `core`
  - [#709](https://github.com/embroider-build/embroider/pull/709) Fix the path to the on-disk styles file for in-repo engines ([@charlespierce](https://github.com/charlespierce))
- `core`
  - [#686](https://github.com/embroider-build/embroider/pull/686) Prevent accidental duplication of babel plugin during rebuilds ([@ef4](https://github.com/ef4))

#### :house: Internal

- `compat`
  - [#706](https://github.com/embroider-build/embroider/pull/706) Remove `ember-cli-htmlbars` dependency in `@embroider/compat`. ([@rwjblue](https://github.com/rwjblue))
- Other
  - [#711](https://github.com/embroider-build/embroider/pull/711) Add release automation setup. ([@rwjblue](https://github.com/rwjblue))
  - [#704](https://github.com/embroider-build/embroider/pull/704) Avoid running CI jobs on both push and pull_request events. ([@rwjblue](https://github.com/rwjblue))
  - [#697](https://github.com/embroider-build/embroider/pull/697) Refactor suite-setup-util to avoid knock on errors. ([@rwjblue](https://github.com/rwjblue))
- `core`, `macros`
  - [#707](https://github.com/embroider-build/embroider/pull/707) Fixup types for newer @babel/types. ([@rwjblue](https://github.com/rwjblue))
- `router`, `util`
  - [#703](https://github.com/embroider-build/embroider/pull/703) Add 3.20 and 3.24 to list of matrix tests. ([@rwjblue](https://github.com/rwjblue))

#### Committers: 5

- Charles Pierce ([@charlespierce](https://github.com/charlespierce))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- Travis Hoover ([@thoov](https://github.com/thoov))

## 0.36.0 (2021-01-21)

- BUGFIX: fix non-legacy CSS handling in production builds when using `@embroider/webpack`
- DOCS: fix a bug in ensureSafeComponent docs, by @patocallaghan
- HOUSEKEEPING: upgrade terser by @GCheung55

## 0.35.1 (2021-01-11)

- BUGFIX: don't try to read nonexistent package.json when combining multiple v1 package instances, by @mattmcmanus.

## 0.35.0 (2020-12-20)

- BUGFIX: support disabled in-repo addons.
- COMPAT: implement `insertRuntimeErrors` option on the hbs inline compiler
- BUGFIX: conditionally import lazy engine css by @thoov
- HOUSEKEEPING: split hbs-loader into its own package (so ember-auto-import can also use it)
- COMPAT: updates to @embroider/util to follow latest ember canary

## 0.34.0 (2020-12-09)

- ENHANCEMENT: add publicAssetURL option to `@embroider/webpack` to support CDN deploys (the built-in webpack options for this didn't let you manipulate your index.html, since we take care of that directly in `@embroider/webpack`).
- COMPAT: update `@embroider/util` to follow internal refactoring on ember canary.
- HOUSEKEEPING: broccoli-related dependency updates
- DOCS: split the "Replacing the Component Helper" guide into its own document and expanded the use cases.

## 0.33.0 (2020-11-25)

- ENHANCEMENT: new staticAppPaths option
- ENHANCEMENT: fingerprint legacy scripts and styles in production by @simonihmig
- COMPAT: added packageRules for several more popular addons
- BUGFIX: don't include node-only types in @embroider/macros main entrypoint
- BUGFIX: correctly apply packageRules inside co-located templates
- ENHANCEMENT: add types for @embroider/util
- HOUSEKEEPING: eslint update

## 0.32.0 (2020-11-24)

- ENHANCEMENT: added a new `allowUnsafeDynamicComponents` option to support testing of apps that are partially-working under `staticComponents` mode
- BUGFIX: Fix `ensureSafeComponent` to not reuse registered component across owners by @simonihmig
- ENHANCEMENT: added a new `pluginHints` option that lets you achieve parallel builds even if some of your babel or htmlbars plugins are misbehaved
- HOUSEKEEPING: refactored plugin portability system to make `pluginHints` practical
- HOUSEKEEPING: updated to use `broccoli-node-api` types
- ENHANCEMENT: test coverage for `ensureSafeComponent` stability
- ENHANCEMENT: minimize CSS in prod by @thoov
- ENHANCEMENT: fix REUSE_WORKSPACE for in-repo-addons
- COMPAT: update `@embroider/util` usage of private API for ember 3.24 compatibility
- ENHANCEMENT: configure `@babel/plugin-transform-runtime` by default, making all apps smaller, especially if they support IE11.
- HOUSEKEEPING: update to released version of `fixturify-project` by @rwjblue

## 0.31.0 (2020-11-11)

- BREAKING: renamed the new `@embroider/addon` package to `@embroider/util` because it was misleading: apps are encouraged use these utilities too.
- COMPAT: allow code in addon's treeForApp to resolve dependencies from both the app and the addon
- ENHANCEMENT: respect the ensure-safe-component helper when statically analyzing templates
- BUGFIX: don't accidentally cache addon broccoli tree output that is not cacheable
- ENHANCEMENT: support pods layout for route-based code splitting by @simonihmig
- ENHANCEMENT: added new `invokes` rule for annotating dynamic component behavior
- BUGFIX: component snippet resolution had a regression in previous release
- ENHANCEMENT: expose TS types for `@embroider/router` by @simonihmig
- ENHANCEMENT: lazily load CSS from lazy engines by @thoov
- ENHANCEMENT: improvements to thoroughness of the embroider-compat-audit command
- BUGFIX: pin the embroider package versions added by @embroider/test-setup to newest by @simonihmig

## 0.30.0 (2020-11-03)

- BUGFIX: fix unnecessary inclusion of co-located templates
- COMPAT: support component helper invocations with '@'
- BREAKING: when using `staticComponents: true`, unsafe usage of the `{{component}}` helper has changed from a warning to an error. The warning was really not safe to ignore, because it's likely to cause runtime failures.
- ENHANCEMENT: `@embroider/compat` provides a new `embroider-compat-audit` command. With your app configured to build with Embroider, run `yarn embroider-compat-audit` or `npm run embroider-compat-audit`.

## 0.29.0 (2020-10-27)

- BUGFIX: dependencySatisfies macro fixes by @rwjblue

## 0.28.0 (2020-10-21)

- BUGFIX: fastboot hostWhiteList support by @simonihmig
- ENHANCEMENT: new @embroider/addon utility package
- HOUSEKEEPING: multiple dependency upgrades by @rwjblue
- DOCS: updated macros examples by @thoov
- DOCS: add timestamps to changelog by @sandstrom
- COMPAT: declare node versions by @rwjblue
- HOUSEKEEPING: faster and more reliable test suite infrastructure
- COMPAT: support a different form of \_super call in treeFor, by @thoov
- BUGFIX: rule-defined extra imports were getting module namespace vs default wrong, by @thoov
- COMPAT: support the most common special-cases of customized treeFor
- COMPAT: guard against stringly broccoli trees
- ENHANCEMENT: `@embroider/test-setup` can now force either classic or embroider mode without altering the project's deps
- BUGFIX: make runtime getConfig macro work as a class field initializer by @simonihmig

## 0.27.0 (2020-10-01)

- HOUSEKEEPING: linter upgrades
- COMPAT: add compatAdapter for ember-cli-addon-docs by @thoov
- ENHANCEMENT: created new `@embroider/test-setup` package to aid CI-testing of apps and addons

## 0.26.0 (2020-09-29)

- BUGFIX: don't include d.ts files from the app into the actual build
- COMPAT: support own-imports imports in code that came from treeForApp
- HOUSEKEEPING: updating the versions of babel used in our own test suite
- DOCS: add ember-try instructions to addon author guide by @thoov
- ENHANCEMENT: unresolved dynamic imports are now runtime errors, not build time errors, by @thoov
- COMPAT: fix loader.js compatibility issue by disabling its makeDefaultExport option by @simonihmig
- ENHANCEMENT: prevent cryptic errors when a (potentially optional) dependency isn't present by @thoov

## 0.25.0 (2020-09-22)

- BUGFIX: fix live rebuilding the owning addon when running a dummy app
- HOUSEKEEPING: upgrades for eslint by @simonihmig
- COMPAT: add packageRules for ember-element-helper by @simonihmig
- COMPAT: support ember-cli-typescript 4.x by @jamescdavis
- HOUSEKEEPING: upgrade typescript by @simonihmig
- COMPAT: avoid Testem.hookIntoTestFramework by @rwjblue
- BUGFIX: ensure macros package works in apps using staticComponents & staticHelpers

## 0.24.1

- BUGFIX: the 0.24.0 release introduced an accidental dependency change

## 0.24.0

- HOUSEKEEPING: add missing repository fields by @Turbo87
- ENHANCEMENT: support the component helper in rule snippets by @patricklx
- HOUSEKEEPING: sort package.json contents by @Turbo87
- BUGFIX: avoid duplication of the macros babel plugin
- BUGFIX: avoid duplication of the nullish-coalescing and optional-chaining babel plugins

## 0.23.0

- COMPAT: add compat adapter for ember-exam by @thoov
- BUGFIX: use renamed-packages for module name definitions by @thoov
- BUGFIX: use renamed-packages for template meta moduleName by @thoov

## 0.22.0

- COMPAT: add the newer public `in-element` helper to the built-in helpers list by @josemarluedke
- COMPAT: use runtime loader for tests

## 0.21.0

- ENHANCEMENT: make it easier for addons to emit macros into their consuming packages in classic builds
- COMPAT: patch a bug in ember-template-compiler so we can support all active LTS versions of ember-source
- COMPAT: avoid interactions with addons that manipulate the value of `window.require` over time

## 0.20.0

- COMPAT: remote our adapter for ember-window-mock because upstream now has an embroider-compatible solution
- ENHANCEMENT: added isTesting, isDevelopingApp, and isDevelopingThisPackage macros
- BUGFIX: handle addons with a customized ember-addon.main that use stock trees
- COMPAT: make customized tree detection robust enough to catch addons that mutate other addon instances
- COMPAT: support customized treeForAddonStyles
- BUGFIX: make our babel plugin order match classic builds by @thoov
- HOUSEKEEPING: use volta extends within our monorepo by @thoov
- BUGFIX: fix renamed-modules when used with languages that transpile to js
- COMPAT: follow template compiler changes in ember 3.17+ by @GCheung55
- DOCS: remove addon package publishing warning by @GavinJoyce

## 0.19.0

- HOUSEKEEPING: Updating some babel-related deps to avoid upstream bugs
- ENHANCEMENT: implement a build-variants system to begin supporting multiple simultaneous flavors of builds in stage3 packagers.
- BUGFIX: use the build-variants system to fix optimized production fastboot builds
- COMPAT: added a compat-adapter for ember-cli-fastboot-testing
- BUGFIX: make engine configs fastboot-friendly
- BUGFIX: preload webpack's lazy chunks in fastboot
- HOUSEKEEPING: update volta pinning on all packages in monorepo

## 0.18.0

- COMPAT: updated to new proposed fastboot v5 format (https://github.com/ember-fastboot/fastboot/pull/272)
- COMPAT: avoid spurious testem error when running tests directly in browser
- ENHANCEMENT: support static resolution of components named like `foo/index.js` as opposed to `foo.js`, by @NullVoxPopuli

## 0.17.0

- COMPAT: tolerate broken in-repo-addons for compatibility with ember-cli by @thoov
- ENHANCEMENT: add data-fastboot-ignore to scripts that shouldn't run in fastboot by @thoov

## 0.16.1

- BUGFIX: addons that return undefined from treeForFastboot caused a build-time exception
- BUGFIX: apps with sufficiently modern preset-env configuration saw webpack parse errors

## 0.16.0

- BUGFIX: improved support for in-repo addons, including in-repo addons inside in-repo addons
- ENHANCEMENT: full fastboot support (depends on upstream changes in fastboot that are still in a PR)
- ENHANCEMENT: addon rebuilding improvements
- BUGFIX: make @embroider/router coexist correctly with ember-engines

## 0.15.0

- ENHANCEMENT: lazy engines' own JS is now loaded lazily by @thoov
- HOUSEKEEPING: updated to node 12 by @SparshithNR
- ENHANCEMENT: apps with ember-engines can now build and run correctly
- ENHANCEMENT: macro system can now evaluate many more kinds of expressions, and supports optional chaining syntax, by @SparshithNR
- BUGFIX: support running test suites via `ember s`, not just `ember test`
- COMPAT: support in-repo-addons inside other addons, by @thoov
- HOUSEKEEPING: switch to github actions for our own CI, by @thoov

## 0.14.0

- ENHANCEMENT: multiple additions and bugfixes to the macro system by @simonihmig
- COMPAT: ast transforms in stage1 didn't see the same moduleNames as under stock ember-cli, by @SparshithNR
- COMPAT: always define `runningTests` by @thoov
- COMPAT: resolve ambiguous addon merges in the same order as stock ember-cli by @thoov
- COMPAT: more progress on engines support
- COMPAT: more progress on fastboot support by @SparshithNR
- BUGFIX: correctly handle ember-auto-import's dynamic `import()`
- DOCS: add info about disabling the webpack bundle analyzer browser by @ohcibi

## 0.13.0

- COMPAT: follow the stock build's special-case behavior that forbids "template.hbs" as a template-only component
- ENHANCEMENT: add support for apps with custom app-boot content by @dnalagatla
- ENHANCEMENT: allow explicitly declared relative externals, which makes it easier to workaround some badly-behaved addons
- BUGFIX: fixed a bug in the way we make module paths relative
- COMPAT: support ember-cli 3.16, which dropped a function we were calling.

## 0.12.0

- ENHANCEMENT: support for Octane's component template colocation.

## 0.11.1

- BUGFIX: the previous release broke CSS rebuilding if you were using the
  experimental BROCCOLI_ENABLED_MEMOIZE feature flag due to the way ember-cli
  constructs the app styles tree that Embroider relies on. This release includes
  a workaround.

## 0.11.0

- ENHANCEMENT: support rebuilding of linked addons when using the BROCCOLI_ENABLED_MEMOIZE feature flag

## 0.10.0

- BUGFIX: make TemplateCompiler's isParallelSafe flag survive clone()
- COMPAT: support ember-cli-htmlbars>=4, which has native support for inline hbs
- BUGFIX: fix CSS ordering between certain kinds of addon CSS by @kandhavivekraj
- COMPAT: updated compat adapter for ember-data 3.15 by @jenweber

## 0.9.0

- DOCS: improved README example code by @jenweber
- PERFORMANCE: memoize template compiler, by @kratiahuja and @stefanpenner
- BUGFIX: fix implicit-modules in apps with NPM scoped names
- BUGFIX: keep json and wasm as default resolvable extensions
- COMPAT: short-circuit template compilation to be compatible with addons with broken template preprocessors but no templates

## 0.8.0

- HOUSEKEEPING: upgrade css-loader.
- BUGFIX: include nested CSS files from addons that use no preprocessor
- ENHANCEMENT: support addons that customize treeForStyles and don't call `super`, by @simonihmig.
- DOCS: improvement to README by @simonihmig
- HOUSEKEEPING: update for compatibility with newest ember-cli-htmlbars

## 0.7.1

- BUGFIX: changes to CSS and public assets were not always reflected after rebuilds

## 0.7.0

- HOUSEKEEPING: multiple fixes and improvements by @stefanpenner
- ENHANCEMENT: treat dotfiles the same way ember-cli does by @thoov
- HOUSEKEEPING: upgrade babel plugin-debug-macros by @k-fish
- ENHANCEMENT: compatibility with app.import from node_modules with outputFile option
- ENHANCEMENT: build performance improvement by caching v2tree by @tmquinn
- ENHANCEMENT: allow interactive rebuilds of addons by @thoov
- ENHANCEMENT: fastboot compatibility improves by @dnalagatla
- ENHANCEMENT: support node's mjs extension by @knownasilya
- ENHANCEMENT: usage of getOrCreate cleaned up by @2hu12
- ENHANCEMENT: add support for nested angle components by @josemarluedke
- ENHANCEMENT: add support for pod module prefix by @josemarluedke
- ENHANCEMENT: add support for ember's new `on` and `fn` by @josemarluedke
- ENHANCEMENT: add compatibility rules for ember-basic-dropdown v2 by @josemarluedke
- DOCS: improved readme code samples by @efx

## 0.6.0

- BUGFIX: make renamed implicit-modules work
- ENHANCEMENT: expose outputPath from the standard build pipeline
- ENHANCEMENT: fix a build error when building ember engines
- BUGFIX: fix template compiler serialization during rebuilds
- ENHANCEMENT: improved test coverage of app.import with prepend, by @stefanpenner
- ENHANCEMENT: add support for app.import with the destDir argument, by @balinterdi
- ENHANCEMENT: teach resolver about Ember's component invocation dot rules
- ENHANCEMENT: teach resolver about more of Ember's built-ins

## 0.5.1

- COMPAT: tolerate addons that overwrite their own files

## 0.5.0

- COMPAT: added a compatAdapter for ember-svg-jar
- ENHANCEMENT: apps that use ember-cli-typescript are now supported
- BUGFIX: respect the app's custom babel config (this was a regression)
- COMPAT: try to match ember-cli's file-smooshing priority more closely when an addon is consumed multiple times
- BUGFIX: don't mess with bare `require` in non-Ember packages.
- COMPAT: adjust compatibility adapter for ember-data 3.11
- BUGFIX: correctly handled a renamed module inside a renamed package by @stefanpenner
- ENHANCEMENT: implement the outputFile option to app.import, by @stefanpenner
- BUGFIX: windows path handling by @lifeart
- ENHANCEMENT: skip the OneShot optimization on broccoli versions that don't need it, by @thoov
- BUGFIX: error message formatting on windows by @lifeart
- BUGFIX: don't leak the full filesystem path in compiled templates, by @lifeart
- BUGFIX: support a blank pod prefix by @lifeart
- BUGFIX: ignore new built-in angle-bracket components: Input, LinkTo, TextArea. By @cyk.
- HOUSEKEEPING: module name cleanup by @lifeart
- ENHANCEMENT: allow unresolved style by @lifeart
- HOUSEKEEPING: upgrade macro test fixtures by @stefanpenner
- ENHANCEMENT: invoke ember-cli-babel to get its latest default babel config, by @stefanpenner

## v0.4.3

- BUGFIX: nested files were missing from previous published packages

## v0.4.2

- BUGFIX: changing so we only publish compiled artifacts. Making our own TS compile cleanly when consumed by arbitrary other TS packages is not simple.

## v0.4.1

- BUGFIX: typings for dependencies should also be dependencies, not devDependencies. This fixes consumption by other TS packages.

## v0.4.0

- BUGFIX: windows path handling fixes by @lifeart
- ENHANCEMENT: apply babel to all directly-imported, third-party packages, unless explicitly opted out.
- ENHANCEMENT: implement the importSync macro as public API for synchronous dynamic imports
- ENHANCEMENT: support classic addons that stubbornly emit AMD despite our best efforts to disable their internal babel module transpilation, by @stefanpenner
- BUGFIX: correct the way we copy shared options objects on classic addon instances by @2hu12
- ENHANCEMENT: integrate with Ember's test system so that `settled` waits for lazy routes to load
- BUGFIX: compatibility with master ember-cli, which stopped filtering out non-JS files from trees like treeForAddon
- BUGFIX: don't automagically include node polyfills. A similar change was made in ember-auto-import for consistency.
- ENHANCEMENT: switch to using ember-cli-babel's public API to avoid compatibility issues, now that it provides serializable plugin configs, by @stefanpenner
- ENHANCEMENT: resolve dependencies in treeForApp relative to the addon that authored the module, not the app itself
- ENHANCEMENT: support non-typical addons that do their own extensions to the ember-cli-provided Addon base class
- ENHANCEMENT: improve ember-template-compiler loading for compat with a broader range of ember versions.
- DOCS: instructions on how to analyze build output, by @efx
- ENHANCEMENT: ensure that all active classic addons can always resolve each other, even when that would not normally be possible via node_modules resolution
- BUGFIX: don't double-handle renaming at both the package and module levels, by @jenweber
- BUGFIX: implicitly-included templates were registered under the wrong name, by @jenweber
- ENHANCEMENT: refer to modules by shorter relative paths whenever possible
- ENHANCEMENT: added compat adapter for ember-inflector
- ENHANCEMENT: smarter merging of package.json as part of in-progress fastboot support, by @dnalagatla
- ENHANCEMENT: support classic addons that need renaming of a single module without renaming a whole package
- ENHANCEMENT: support classic addons that mix two different formats ("/modules" and no "/modules" filesystem structure) in treeForAddon
- ENHANCEMENT: support customized rootURL

## v0.3.5

- BUGFIX: fixed a bug in the new externals system that was introduced in v0.3.4.
- ENHANCEMENT: added `failBuild` macro for providing late build-time errors from addons.
- BUGFIX: handle addons that fail to call super in `treeForAddon` and emit files into nonstandard namespaces.
- BUGFIX: support addons that emit a single JS file, rather than a directory, in their test-support tree.
- DOCS: some updates to SPEC.md
- BUGFIX: fixed an infinite recursion bug when addons have a cycle
- BUGFIX: added a clear warning when symlinks contain nonsense, by @stefanpenner.
- BUGFIX: support addons that make `this.options` a function rather than a POJO, by @patocallaghan.

## v0.3.4

- BUGFIX: we now correctly handle all known imports of hbs files, including
  "pods-like" addons that kepts their templates in nonstandard places.
- BUGFIX: warning printer output was incorrect
- BUGFIX: the dependencySatisfies macros now behave as expected when a
  prerelease version is present

## v0.3.3

- BUGFIX: lock our webpack version to workaround an upstream bug

## v0.3.2

- BUGFIX: support static component & helper resolution inside inline hbs
- BUGFIX: better compatibility with addons that depend on other addons implicitly
- BUGFIX: move extraImports to very start of the module they're inside
- BUGFIX: always use correct babel config and major version when parsing for imports
- BUGFIX: always use correct babel major verison in stage3

## v0.3.1

- BUGFIX: addons with CSS preprocessors would result in missing implicit-styles dependency errors

## v0.3.0

- route-based code splitting
- build performance improvements
- bugfix when npm-linking namespaced packages
- support in-repo addons and addon dummy apps

## v0.2.0

- allow template compiler parallelization in @embroider/webpack
- improved options for benchmarking core vs compat separately
- bugfixes to portable plugin config that allow more apps to use parallel babel
- test & linting system improvements by @Turbo87

## v0.1.0

- first release of the 0.1.0 series (there were 12 0.0.x releases already, which were too unstable to bother putting in a changelog.
- includes full support for statically resolving components and helpers
