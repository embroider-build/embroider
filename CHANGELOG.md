# Embroider Changelog

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
