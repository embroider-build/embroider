# @embroider/macros

A standardized solution for modifying your package's Javascript and Glimmer templates at app-compilation-time.

## Motivation

Traditionally, Ember addons have a lot of power to run arbitrary code during the build process. This lets them do whatever they need to do, but it also makes them hard to statically analyze and makes them play badly with some tooling (like IDEs).

The [Embroider package spec](../../SPEC.md) proposes fixing this by making Ember addons much more static. But they will still need the ability to change themselves in certain ways at app compilation time. Hence this package.

This package works in both Embroider builds and normal ember-cli builds, so that addon authors can switch to this newer pattern without disruption.

## Examples

TODO

## The Macros

### dependencySatisfies

Tests whether a given dependency is present and satisfies the given semver range.

## Setting Configuration: from an Ember app

1. Add `@embroider/macros` as `devDependency`.
2. In `ember-cli-build.js`, do:

   ```js
   let app = new EmberApp(defaults, {
     '@embroider/macros': {
       // this is how you configure your own package
       setOwnConfig: {
         // your config goes here
       },
       // this is how you can optionally send configuration into your
       // dependencies, if those dependencies choose to use
       // @embroider/macros configs.
       setConfig: {
         'some-dependency': {
           // config for some-dependency
         },
       },
     },
   });
   ```

## Setting Configuration: from an Ember Addon

1. Add `@embroider/macros` as `dependency`.
2. In `index.js`, do:

   ```js
   module.exports = {
     name: require('./package').name,
     options: {
       '@embroider/macros': {
         setOwnConfig: {
           // your config goes here
         },
         setConfig: {
           'some-dependency': {
             // config for some-dependency
           },
         },
       },
     },
   };
   ```
