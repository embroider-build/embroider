# Embroider Changelog

## master

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
