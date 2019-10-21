# @embroider/macros

A standardized solution for modifying your package's Javascript and Glimmer templates at app-compilation-time.

## Motivation

Traditionally, Ember addons have a lot of power to run arbitrary code during the build process. This lets them do whatever they need to do, but it also makes them hard to statically analyze and makes them play badly with some tooling (like IDEs).

The [Embroider package spec](../../SPEC.md) proposes fixing this by making Ember addons much more static. But they will still need the ability to change themselves in certain ways at app compilation time. Hence this package.

This package works in both Embroider builds and normal ember-cli builds, so that addon authors can switch to this newer pattern without disruption.

## The Javascript Macros

TODO: update this to match latest version of RFC 507 as soon as that is implemented.

## The Template Macros

TODO: update this to match latest version of RFC 507 as soon as that is implemented.

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
       }
     }
   }
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

## Setting Configuration: Low Level API

Configuration is stored per NPM package, based off their true on-disk locations. So it's possible to configure two independent copies of the same package when they're being consumed by different subsets of the total NPM dependency graph.

Configuration gets set during the build process, from within Node.

The entrypoints to the low level API are:

- `import { MacrosConfig } from '@embroider/macros'`: constructs the shared global object that stores config. It has methods for setting configuration and for retrieving the necessary Babel and HTMLBars plugins that will implment the config. See `macros-config.ts` for details.

```

```
