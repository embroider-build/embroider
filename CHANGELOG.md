# Embroider Changelog

## v1.0.0 (2022-01-19)

Declaring this as 1.0 to signifiy general level of stability and to give us more flexibility to distinguish minor and patch releases.

#### :internal: Internal

* Renamed default branch from master to main. 

#### :bug: Bug Fix
* `macros`
  * [#1081](https://github.com/embroider-build/embroider/pull/1081) fix importSync scope collision ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.50.2 (2022-01-14)

#### :bug: Bug Fix
* `compat`, `macros`
  * [#1076](https://github.com/embroider-build/embroider/pull/1076) add non-es6-compat to importSync ([@ef4](https://github.com/ef4))
* `core`, `macros`
  * [#1075](https://github.com/embroider-build/embroider/pull/1075) native v2 addons can always import from NPM ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.50.1 (2022-01-12)

#### :bug: Bug Fix
* `core`
  * [#1074](https://github.com/embroider-build/embroider/pull/1074) Ensure `babelFilter` config comes from fully qualified `@embroider/core` path in Stage 2 ([@krisselden](https://github.com/krisselden))
* `compat`, `core`, `macros`, `shared-internals`
  * [#1070](https://github.com/embroider-build/embroider/pull/1070) Ensure `dependencySatisfies` only considers actual dependencies (includes a fix for invalid results within monorepo scenarios) ([@NullVoxPopuli](https://github.com/NullVoxPopuli))

#### Committers: 2
- Kris Selden ([@krisselden](https://github.com/krisselden))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)


## v0.50.0 (2022-01-08)

#### :rocket: Enhancement
* `addon-shim`, `core`, `shared-internals`
  * [#1069](https://github.com/embroider-build/embroider/pull/1069) Make addon-shim a non-ember-addon ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix
* `compat`
  * [#1068](https://github.com/embroider-build/embroider/pull/1068) Widen the node_modules exclude pattern when copying v2 addons ([@ef4](https://github.com/ef4))
  * [#1064](https://github.com/embroider-build/embroider/pull/1064) Fix unsafe reuse of broccoli trees in OneShot ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.49.0 (2021-12-21)

#### :rocket: Enhancement
* `webpack`
  * [#1055](https://github.com/embroider-build/embroider/pull/1055) Accept custom `css-loader` and `style-loader` config in `@embroider/webpack` ([@dfreeman](https://github.com/dfreeman))
* `addon-shim`
  * [#1052](https://github.com/embroider-build/embroider/pull/1052) restore tree caching via `cacheKeyForTree` ([@RuslanZavacky](https://github.com/RuslanZavacky))

#### :bug: Bug Fix
* `core`
  * [#1048](https://github.com/embroider-build/embroider/pull/1048) Fix imported CSS with FastBoot ([@simonihmig](https://github.com/simonihmig))
  * [#1045](https://github.com/embroider-build/embroider/pull/1045) Append styles imported in JS to end of `document.head` ([@simonihmig](https://github.com/simonihmig))
* `macros`
  * [#1059](https://github.com/embroider-build/embroider/pull/1059) cleanup test copy-paste errors ([@ef4](https://github.com/ef4))
* `compat`, `util`
  * [#1053](https://github.com/embroider-build/embroider/pull/1053) resolve failed macro condition in ember-private-api ([@NullVoxPopuli](https://github.com/NullVoxPopuli))
* `compat`, `core`, `shared-internals`
  * [#1043](https://github.com/embroider-build/embroider/pull/1043) Make extraImports lazy ([@ef4](https://github.com/ef4))

#### :house: Internal
* [#1044](https://github.com/embroider-build/embroider/pull/1044) Fix typo in file assertion test matcher ([@rwjblue](https://github.com/rwjblue))

#### Committers: 6
- Dan Freeman ([@dfreeman](https://github.com/dfreeman))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Ruslan Zavacky ([@RuslanZavacky](https://github.com/RuslanZavacky))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- [@NullVoxPopuli](https://github.com/NullVoxPopuli)

## v0.48.1 (2021-12-08)

#### :bug: Bug Fix
* `compat`
  * [#1042](https://github.com/embroider-build/embroider/pull/1042) Fix ember-cli-babel optimization ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))


## v0.48.0 (2021-12-07)

#### :rocket: Enhancement
* `compat`, `core`, `router`
  * [#1021](https://github.com/embroider-build/embroider/pull/1021) Add `staticModifiers` option ([@Windvis](https://github.com/Windvis))

#### :bug: Bug Fix
* `compat`
  * [#1029](https://github.com/embroider-build/embroider/pull/1029) Don't resolve built-in components when used with the component helper ([@Windvis](https://github.com/Windvis))
  * [#1030](https://github.com/embroider-build/embroider/pull/1030) fix the ember-get-config compat adapter ([@ef4](https://github.com/ef4))
  * [#1035](https://github.com/embroider-build/embroider/pull/1035) Optimize ember-cli-babel handling ([@ef4](https://github.com/ef4))

#### :memo: Documentation
* `macros`
  * [#1031](https://github.com/embroider-build/embroider/pull/1031) Add `isTesting` and `isDevelopingApp` to readme ([@mydea](https://github.com/mydea))

#### :house: Internal
* `router`
  * [#1027](https://github.com/embroider-build/embroider/pull/1027) `@embroider/router` Ember 4 CI job compatibility ([@Windvis](https://github.com/Windvis))

#### Committers: 3
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Sam Van Campenhout ([@Windvis](https://github.com/Windvis))

## v0.47.2 (2021-11-11)

#### :bug: Bug Fix
* `compat`
  * [#1017](https://github.com/embroider-build/embroider/pull/1017) Ensure components + helpers can work from `this` paths with `staticComponents = true` & `staticHelpers = true` ([@thoov](https://github.com/thoov))
* `addon-dev`
  * [#1015](https://github.com/embroider-build/embroider/pull/1015) Address misleading warnings from rollup about externals ([@ef4](https://github.com/ef4))

#### :memo: Documentation
* `compat`
  * [#1011](https://github.com/embroider-build/embroider/pull/1011) Minor typo fix ([@thoov](https://github.com/thoov))

#### Committers: 2
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Travis Hoover ([@thoov](https://github.com/thoov))


## v0.47.1 (2021-10-25)

#### :rocket: Enhancement
* `compat`
  * [#1008](https://github.com/embroider-build/embroider/pull/1008) Support @ syntax in helpers ([@thoov](https://github.com/thoov))

#### :bug: Bug Fix
* `compat`
  * [#1009](https://github.com/embroider-build/embroider/pull/1009) Apply compileStyles to custom treeForAddonStyles ([@ef4](https://github.com/ef4))
* `compat`, `core`
  * [#1007](https://github.com/embroider-build/embroider/pull/1007) Fix exclusion of the hbs file of the pod components when `podModulePrefix === ''` ([@dcyriller](https://github.com/dcyriller))

#### :memo: Documentation
* `addon-shim`
  * [#1005](https://github.com/embroider-build/embroider/pull/1005) Remove command documentation from `addon-shim` package ([@simonihmig](https://github.com/simonihmig))

#### Committers: 4
- Cyrille ([@dcyriller](https://github.com/dcyriller))
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- Travis Hoover ([@thoov](https://github.com/thoov))


## v0.47.0 (2021-10-14)

#### :rocket: Enhancement
* `compat`, `core`, `macros`, `shared-internals`
  * [#893](https://github.com/embroider-build/embroider/pull/893) Support strict mode templates ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.46.2 (2021-10-11)

#### :bug: Bug Fix
* `addon-dev`
  * [#1003](https://github.com/embroider-build/embroider/pull/1003) addon-dev: list published files explicitly ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.46.1 (2021-10-11)

#### :bug: Bug Fix
* `addon-dev`
  * [#1002](https://github.com/embroider-build/embroider/pull/1002) addon-dev needs a prepare script ([@ef4](https://github.com/ef4))

#### Committers: 1
- Edward Faulkner ([@ef4](https://github.com/ef4))

## v0.46.0 (2021-10-11)

#### :boom: Breaking Change
* `addon-dev`, `addon-shim`, `compat`, `core`, `shared-internals`
  * [#1001](https://github.com/embroider-build/embroider/pull/1001) Create addon-dev package ([@ef4](https://github.com/ef4))

#### :rocket: Enhancement
* `addon-dev`, `addon-shim`, `compat`, `core`, `shared-internals`
  * [#1001](https://github.com/embroider-build/embroider/pull/1001) Create addon-dev package ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix
* `core`
  * [#974](https://github.com/embroider-build/embroider/pull/974) Production fastboot builds were incorrectly getting server code in the browser ([@thoov](https://github.com/thoov))
* `macros`
  * [#990](https://github.com/embroider-build/embroider/pull/990) Invalidate @embroider/macro's babel cache when addon version's change without mutating lock file (e.g. linking) ([@thoov](https://github.com/thoov))

#### :memo: Documentation
* `router`
  * [#930](https://github.com/embroider-build/embroider/pull/930) add note on route splitting with pods in readme ([@mydea](https://github.com/mydea))

#### :house: Internal
* `core`
  * [#989](https://github.com/embroider-build/embroider/pull/989) use babel-import-util ([@ef4](https://github.com/ef4))
  * [#988](https://github.com/embroider-build/embroider/pull/988) Remove leftover Babel 6 compatibility code ([@ef4](https://github.com/ef4))

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
* `addon-shim`, `compat`, `router`, `util`
  * [#959](https://github.com/embroider-build/embroider/pull/959) Upgrade ember-auto-import to latest in `@embroider/addon-shim` ([@stefanpenner](https://github.com/stefanpenner))

#### :bug: Bug Fix
* `compat`
  * [#958](https://github.com/embroider-build/embroider/pull/958) Add allowEmpty to `__COMPILED_STYLES__` funnel ([@thoov](https://github.com/thoov))

#### :house: Internal
* `router`, `util`
  * [#960](https://github.com/embroider-build/embroider/pull/960) Upgrade qunit  ([@stefanpenner](https://github.com/stefanpenner))

#### Committers: 2
- Stefan Penner ([@stefanpenner](https://github.com/stefanpenner))
- Travis Hoover ([@thoov](https://github.com/thoov))


## v0.44.0 (2021-09-02)

#### :boom: Breaking Change
* `webpack`
  * [#877](https://github.com/embroider-build/embroider/pull/877) [BREAKING] Respect JOBS count if present ([@stefanpenner](https://github.com/stefanpenner))

#### :rocket: Enhancement
* `compat`
  * [#941](https://github.com/embroider-build/embroider/pull/941) Add support for ember-cli addon proxy (bundle caching) ([@eoneill](https://github.com/eoneill))

#### :bug: Bug Fix
* `compat`
  * [#953](https://github.com/embroider-build/embroider/pull/953) fixes: Local helpers not resolved in tests #894 ([@lifeart](https://github.com/lifeart))
  * [#948](https://github.com/embroider-build/embroider/pull/948) Disable compat adapter for ember-inflector >= 4.0.0 (since it is not needed) ([@stefanpenner](https://github.com/stefanpenner))
  * [#934](https://github.com/embroider-build/embroider/pull/934) Ensure style compilation works properly with ember-cli >= 3.18 ([@stefanpenner](https://github.com/stefanpenner))
  * [#924](https://github.com/embroider-build/embroider/pull/924) Fix caching of template AST plugins (follow caching protocol of ember-cli-htmlbars) ([@eoneill](https://github.com/eoneill))
  * [#928](https://github.com/embroider-build/embroider/pull/928) Update custom package rules for ember-basic-dropdown ([@mydea](https://github.com/mydea))
* `router`
  * [#929](https://github.com/embroider-build/embroider/pull/929) Use @ember/test-waiters in @embroider/router ([@mydea](https://github.com/mydea))

#### :memo: Documentation
* [#923](https://github.com/embroider-build/embroider/pull/923) Add documentation how to use safe components in tests ([@mydea](https://github.com/mydea))

#### :house: Internal
* `addon-shim`, `compat`, `core`, `shared-internals`
  * [#955](https://github.com/embroider-build/embroider/pull/955) chore: improve package json typings ([@lifeart](https://github.com/lifeart))
* Other
  * [#937](https://github.com/embroider-build/embroider/pull/937) Tighten CI job timeout down to 15min ([@stefanpenner](https://github.com/stefanpenner))
  * [#944](https://github.com/embroider-build/embroider/pull/944) Fix SourceMaps when debugging published embroider ([@stefanpenner](https://github.com/stefanpenner))
  * [#942](https://github.com/embroider-build/embroider/pull/942) Update ember data ([@stefanpenner](https://github.com/stefanpenner))
  * [#940](https://github.com/embroider-build/embroider/pull/940) Limit linting and matrix discovery CI jobs to 5 minutes ([@stefanpenner](https://github.com/stefanpenner))
  * [#938](https://github.com/embroider-build/embroider/pull/938) Moving cache busting tests to separate CI job ([@thoov](https://github.com/thoov))
  * [#843](https://github.com/embroider-build/embroider/pull/843) [hygiene] Volta pin latest node / yarn ([@stefanpenner](https://github.com/stefanpenner))
  * [#925](https://github.com/embroider-build/embroider/pull/925) upgrade @ember/test-helpers ([@stefanpenner](https://github.com/stefanpenner))
* `router`
  * [#949](https://github.com/embroider-build/embroider/pull/949) Convert macro-sample-addon to new test scenario infra ([@thoov](https://github.com/thoov))
* `router`, `util`
  * [#935](https://github.com/embroider-build/embroider/pull/935) Bump ember-source in test scenarios to at-least ~3.22.0 ([@stefanpenner](https://github.com/stefanpenner))
  * [#933](https://github.com/embroider-build/embroider/pull/933) [Closes [#932](https://github.com/embroider-build/embroider/issues/932)] fix ember-canary test scenario ([@stefanpenner](https://github.com/stefanpenner))
  * [#925](https://github.com/embroider-build/embroider/pull/925) upgrade @ember/test-helpers ([@stefanpenner](https://github.com/stefanpenner))

#### Committers: 5
- Alex Kanunnikov ([@lifeart](https://github.com/lifeart))
- Eugene ONeill ([@eoneill](https://github.com/eoneill))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Stefan Penner ([@stefanpenner](https://github.com/stefanpenner))
- Travis Hoover ([@thoov](https://github.com/thoov))


## v0.43.5 (2021-08-09)

#### :rocket: Enhancement
* `compat`
  * [#918](https://github.com/embroider-build/embroider/pull/918) Add `needsCache` and `persistentOutput` to internal broccoli-plugins. ([@rwjblue](https://github.com/rwjblue))

#### :bug: Bug Fix
* `core`, `macros`, `shared-internals`
  * [#913](https://github.com/embroider-build/embroider/pull/913) Ensure `dependencySatisfies` invalidates when installed packages change ([@thoov](https://github.com/thoov))

#### :house: Internal
* [#917](https://github.com/embroider-build/embroider/pull/917) Improve Heimdall Types ([@krisselden](https://github.com/krisselden))

#### Committers: 3
- Kris Selden ([@krisselden](https://github.com/krisselden))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Travis Hoover ([@thoov](https://github.com/thoov))


## v0.43.4 (2021-08-03)

#### :rocket: Enhancement
* `compat`
  * [#915](https://github.com/embroider-build/embroider/pull/915) Reduce memory pressure from compat layer by disabling Heimdall node gathering during OneShotPlugin ([@rwjblue](https://github.com/rwjblue))

#### Committers: 2
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Kris Selden ([@krisselden](https://github.com/krisselden))


## v0.43.3 (2021-07-30)

#### :bug: Bug Fix
* `compat`
  * [#910](https://github.com/embroider-build/embroider/pull/910) Fix arguments to `preprocessCss` (to match classic build) ([@thoov](https://github.com/thoov))
  * [#880](https://github.com/embroider-build/embroider/pull/880) Fix compatibility with ember-data@3.27+ ([@ef4](https://github.com/ef4))
* `webpack`
  * [#914](https://github.com/embroider-build/embroider/pull/914) Remove transitive `loader-utils` dependency from `@embroider/webpack` ([@mydea](https://github.com/mydea))

#### Committers: 3
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Travis Hoover ([@thoov](https://github.com/thoov))


## v0.43.2 (2021-07-29)

#### :rocket: Enhancement
* `compat`, `core`
  * [#912](https://github.com/embroider-build/embroider/pull/912) Use `require` for retrieving the adjust imports info ([@krisselden](https://github.com/krisselden))

#### :bug: Bug Fix
* `hbs-loader`
  * [#831](https://github.com/embroider-build/embroider/pull/831) Replace loader-utils with built-in webpack 5 functionality ([@mydea](https://github.com/mydea))

#### :house: Internal
* `router`
  * [#911](https://github.com/embroider-build/embroider/pull/911) Upgrade ember-qunit to address canary deprecations ([@ef4](https://github.com/ef4))

#### Committers: 3
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Kris Selden ([@krisselden](https://github.com/krisselden))


## v0.43.1 (2021-07-28)

#### :rocket: Enhancement
* `compat`, `core`
  * [#907](https://github.com/embroider-build/embroider/pull/907) Deflate AdjustImportsOptions ([@krisselden](https://github.com/krisselden))

#### :bug: Bug Fix
* `core`
  * [#899](https://github.com/embroider-build/embroider/pull/899) support inert TemplateLiteral in hbs plugin ([@eoneill](https://github.com/eoneill))
* `compat`
  * [#900](https://github.com/embroider-build/embroider/pull/900) Only patch `ember-cli-deprecation-workflow` releases before `2.0.0` ([@alexlafroscia](https://github.com/alexlafroscia))
  * [#904](https://github.com/embroider-build/embroider/pull/904) Fix ember-test-selectors custom adapter for 6.x ([@mydea](https://github.com/mydea))

#### Committers: 5
- Alex LaFroscia ([@alexlafroscia](https://github.com/alexlafroscia))
- Eugene ONeill ([@eoneill](https://github.com/eoneill))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Kris Selden ([@krisselden](https://github.com/krisselden))
- Travis Hoover ([@thoov](https://github.com/thoov))


## v0.43.0 (2021-07-13)

#### :boom: Breaking Change
* `macros`
  * [#888](https://github.com/embroider-build/embroider/pull/888) Expose sourceOfConfig to macro config mergers ([@mydea](https://github.com/mydea))
* `babel-loader-7`, `compat`, `core`, `macros`, `shared-internals`, `webpack`
  * [#890](https://github.com/embroider-build/embroider/pull/890) Drop support for apps that use babel 6 ([@ef4](https://github.com/ef4))

#### :bug: Bug Fix
* `macros`
  * [#886](https://github.com/embroider-build/embroider/pull/886) `undefined` does not serialize with broccoli-babel-transpiler ([@thoov](https://github.com/thoov))
* `core`, `shared-internals`, `webpack`
  * [#881](https://github.com/embroider-build/embroider/pull/881) Fix race condition finding the owning package of a given file when using multiple workers ([@ef4](https://github.com/ef4))

#### Committers: 3
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Francesco Novy ([@mydea](https://github.com/mydea))
- Travis Hoover ([@thoov](https://github.com/thoov))


## v0.42.3 (2021-06-28)

#### :rocket: Enhancement
* `core`
  * [#875](https://github.com/embroider-build/embroider/pull/875) Improve Webpack logging output ([@stefanpenner](https://github.com/stefanpenner))

#### :bug: Bug Fix
* `macros`
  * [#865](https://github.com/embroider-build/embroider/pull/865) Enable parallelization of @embroider/macros in non-Embroider builds ([@thoov](https://github.com/thoov))
* `core`
  * [#872](https://github.com/embroider-build/embroider/pull/872) Template compiler plugin not removed due to bad path comparison on Windows ([@thoov](https://github.com/thoov))
* `compat`, `core`, `shared-internals`, `webpack`
  * [#870](https://github.com/embroider-build/embroider/pull/870) Ensure tmpdir usage internally is always the realpath ([@stefanpenner](https://github.com/stefanpenner))

#### :house: Internal
* `compat`
  * [#878](https://github.com/embroider-build/embroider/pull/878) redundant path resolution ([@ef4](https://github.com/ef4))
* Other
  * [#874](https://github.com/embroider-build/embroider/pull/874) Convert `sample-lib` to new test infra ([@thoov](https://github.com/thoov))

#### Committers: 3
- Edward Faulkner ([@ef4](https://github.com/ef4))
- Stefan Penner ([@stefanpenner](https://github.com/stefanpenner))
- Travis Hoover ([@thoov](https://github.com/thoov))


## v0.42.2 (2021-06-23)

#### :bug: Bug Fix
* `babel-loader-8`, `webpack`
  * [#868](https://github.com/embroider-build/embroider/pull/868) Fix issue with thread-loader + babel-loader performance ([@krisselden](https://github.com/krisselden))

#### :house: Internal
* Other
  * [#869](https://github.com/embroider-build/embroider/pull/869) Fix infinite loop in local testing scenario building ([@krisselden](https://github.com/krisselden))
* `addon-shim`, `util`
  * [#864](https://github.com/embroider-build/embroider/pull/864) Add missing typescript devDependency ([@rwjblue](https://github.com/rwjblue))

#### Committers: 2
- Kris Selden ([@krisselden](https://github.com/krisselden))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))


## v0.42.1 (2021-06-18)

#### :rocket: Enhancement
* `webpack`
  * [#860](https://github.com/embroider-build/embroider/pull/860) Ensure all errors are reported when an error occurs in webpack ([@rwjblue](https://github.com/rwjblue))

#### :bug: Bug Fix
* `util`
  * [#863](https://github.com/embroider-build/embroider/pull/863) Restore typings for `@embroider/util` ([@simonihmig](https://github.com/simonihmig))
* `compat`
  * [#853](https://github.com/embroider-build/embroider/pull/853) Better error message when an asset cannot be found in entry file ([@thoov](https://github.com/thoov))

#### :house: Internal
* Other
  * [#861](https://github.com/embroider-build/embroider/pull/861) Remove test-packages: macro-test and funky-sample-addon ([@thoov](https://github.com/thoov))
  * [#859](https://github.com/embroider-build/embroider/pull/859) Convert macro-test to new test structure ([@thoov](https://github.com/thoov))
  * [#858](https://github.com/embroider-build/embroider/pull/858) Remove ember-engines version pin ([@thoov](https://github.com/thoov))
  * [#854](https://github.com/embroider-build/embroider/pull/854) Convert engines-host-app to new test structure ([@thoov](https://github.com/thoov))
* `compat`
  * [#856](https://github.com/embroider-build/embroider/pull/856) Remove eager-engine, lazy-engine, and engine-host-app ([@thoov](https://github.com/thoov))

#### Committers: 3
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Simon Ihmig ([@simonihmig](https://github.com/simonihmig))
- Travis Hoover ([@thoov](https://github.com/thoov))


## v0.42.0 (2021-06-15)

#### :boom: Breaking Change
* `addon-shim`, `babel-loader-7`, `compat`, `core`, `hbs-loader`, `macros`, `router`, `shared-internals`, `test-setup`, `util`, `webpack`
  * [#852](https://github.com/embroider-build/embroider/pull/852) Drop support for Node 10, 11, 13, and 15. ([@rwjblue](https://github.com/rwjblue))

#### :bug: Bug Fix
* `core`
  * [#851](https://github.com/embroider-build/embroider/pull/851) Fix missing exports in @embroider/core `package.json` ([@thoov](https://github.com/thoov))
  * [#841](https://github.com/embroider-build/embroider/pull/841) Ensure babel transpilation cache is invalided when changing versions of babel plugins or AST transforms ([@stefanpenner](https://github.com/stefanpenner))
* `compat`, `core`, `macros`
  * [#839](https://github.com/embroider-build/embroider/pull/839) Fix Babel-Loader Caching for ember-template-compiler ([@stefanpenner](https://github.com/stefanpenner))
* `addon-shim`
  * [#828](https://github.com/embroider-build/embroider/pull/828) Update addon-shim to use ember-auto-import v2 final ([@josemarluedke](https://github.com/josemarluedke))

#### :house: Internal
* `addon-shim`, `compat`, `core`, `hbs-loader`, `macros`, `shared-internals`, `test-setup`, `util`, `webpack`
  * [#844](https://github.com/embroider-build/embroider/pull/844) Upgrade dependencies/devDependencies ([@stefanpenner](https://github.com/stefanpenner))
* Other
  * [#842](https://github.com/embroider-build/embroider/pull/842) Re-roll `yarn.lock` ([@stefanpenner](https://github.com/stefanpenner))
  * [#840](https://github.com/embroider-build/embroider/pull/840) Run linting in CI before running the full matrix of jobs ([@rwjblue](https://github.com/rwjblue))
  * [#837](https://github.com/embroider-build/embroider/pull/837) Remove `ember-cli-htmlbars-inline-precompile` in test packages ([@stefanpenner](https://github.com/stefanpenner))
  * [#832](https://github.com/embroider-build/embroider/pull/832) Schedule CI runs daily ([@rwjblue](https://github.com/rwjblue))
* `webpack`
  * [#838](https://github.com/embroider-build/embroider/pull/838) Ensure errors in `webpack.run` callback always reject ([@stefanpenner](https://github.com/stefanpenner))
* `addon-shim`
  * [#820](https://github.com/embroider-build/embroider/pull/820) Add `@embroider/addon-shim` repository data to package.json ([@rwjblue](https://github.com/rwjblue))

#### Committers: 4
- Josemar Luedke ([@josemarluedke](https://github.com/josemarluedke))
- Robert Jackson ([@rwjblue](https://github.com/rwjblue))
- Stefan Penner ([@stefanpenner](https://github.com/stefanpenner))
- Travis Hoover ([@thoov](https://github.com/thoov))


## v0.41.0 (2021-05-20)

#### :rocket: Enhancement
* `webpack`
  * [#812](https://github.com/embroider-build/embroider/pull/812) Update thread-loader to get RegExp serialization ([@bendemboski](https://github.com/bendemboski))
  * [#796](https://github.com/embroider-build/embroider/pull/796) Allow customization of Webpack's babel loader options ([@charlespierce](https://github.com/charlespierce))
  * [#795](https://github.com/embroider-build/embroider/pull/795) Allow `thread-loader` configuration ([@bendemboski](https://github.com/bendemboski))
* `compat`
  * [#770](https://github.com/embroider-build/embroider/pull/770) Add compat adapter for `ember-get-config` ([@alexlafroscia](https://github.com/alexlafroscia))
  * [#772](https://github.com/embroider-build/embroider/pull/772) Allow compat adapter's to expose shouldApplyAdapter ([@thoov](https://github.com/thoov))

#### :bug: Bug Fix
* `addon-shim`, `compat`, `core`, `util`
  * [#766](https://github.com/embroider-build/embroider/pull/766) Update to broccoli-funnel@3.0.5 ([@rwjblue](https://github.com/rwjblue))
* `compat`
  * [#797](https://github.com/embroider-build/embroider/pull/797) Use configPath to locate the configuration file, instead of assuming a fixed path ([@charlespierce](https://github.com/charlespierce))
  * [#784](https://github.com/embroider-build/embroider/pull/784) Remove usage of the Ember global ([@sandydoo](https://github.com/sandydoo))
  * [#785](https://github.com/embroider-build/embroider/pull/785) Improve semver checks for the modules polyfill ([@sandydoo](https://github.com/sandydoo))
* `test-setup`
  * [#792](https://github.com/embroider-build/embroider/pull/792) Install `webpack` alongside `@embroider/webpack` when using `@embroider/test-setup` ([@alexlafroscia](https://github.com/alexlafroscia))
* `webpack`
  * [#791](https://github.com/embroider-build/embroider/pull/791) Better error message with webpack v4 installed ([@bendemboski](https://github.com/bendemboski))

#### :memo: Documentation
* `addon-shim`
  * [#804](https://github.com/embroider-build/embroider/pull/804) Fix installation instructions in @embroider/addon-shim ([@rwjblue](https://github.com/rwjblue))
* `util`
  * [#807](https://github.com/embroider-build/embroider/pull/807) Add repository entry for the @embroider/util package ([@mansona](https://github.com/mansona))
* Other
  * [#789](https://github.com/embroider-build/embroider/pull/789) Update README for webpack install requirement ([@bendemboski](https://github.com/bendemboski))
  * [#782](https://github.com/embroider-build/embroider/pull/782) docs: for setting publicAssetUrl in non-production environments ([@timiyay](https://github.com/timiyay))

#### :house: Internal
* `compat`, `core`, `test-setup`, `webpack`
  * [#765](https://github.com/embroider-build/embroider/pull/765) Packager Refactoring ([@alexlafroscia](https://github.com/alexlafroscia))
* Other
  * [#774](https://github.com/embroider-build/embroider/pull/774) Convert static-app to new test structure ([@thoov](https://github.com/thoov))
  * [#816](https://github.com/embroider-build/embroider/pull/816) Limit CI jobs to 30 minutes ([@rwjblue](https://github.com/rwjblue))
  * [#790](https://github.com/embroider-build/embroider/pull/790) Update app template dependency versions ([@bendemboski](https://github.com/bendemboski))
* `addon-shim`
  * [#776](https://github.com/embroider-build/embroider/pull/776) github actions failing silently ([@ef4](https://github.com/ef4))

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
