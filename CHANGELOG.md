# Embroider Changelog

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
