# @embroider/macros

A standardized solution for modifying your package's Javascript and Glimmer templates at app-compilation-time.

## Motivation

Traditionally, Ember addons have a lot of power to run arbitrary code during the build process. This lets them do whatever they need to do, but it also makes them hard to statically analyze and makes them play badly with some tooling (like IDEs).

The [Embroider package spec](../../SPEC.md) proposes fixing this by making Ember addons much more static. But they will still need the ability to change themselves in certain ways at app compilation time. Hence this package.

This package works in both Embroider builds and normal ember-cli builds, so that addon authors can switch to this newer pattern without disruption.

## Javascript macros

- `getOwnConfig()`: a macro that returns arbitrary JSON-serializable configuration that was sent to your package. See "Setting Configuration" for how to get configuration in.

  Assuming a config of `{ flavor: 'chocolate' }`, this code:

  ```js
  import { getOwnConfig } from '@embroider/macros';
  console.log(getOwnConfig().flavor);
  ```

  Compiles to:

  ```js
  console.log({ flavor: 'chocolate' }.flavor);
  ```

- `getConfig(packageName)`: like `getOwnConfig`, but will retrieve the configuration that was sent to another package. We will resolve which one based on node_modules resolution rules from your package.

- `dependencySatisfies(packagename, semverRange)`: a macro that compiles to a boolean literal. It will be true if the given package can be resolved (via normal node_modules resolution rules) and meets the stated semver requirement. The package version will be `semver.coerce()`'d first, such that nonstandard versions like "3.9.0-beta.0" will appropriately satisfy constraints like "> 3.8".

  Assuming you have `ember-source` 3.9.0 available, this code:

  ```js
  import { dependencySatisfies } from '@embroider/macros';
  let hasNativeArrayHelper = dependencySatisfies('ember-source', '>=3.8.0');
  ```

  Compiles to:

  ```js
  let hasNativeArrayHelper = true;
  ```

* `macroIf(predicate, consequent, alternate)`: a compile time conditional. Lets you choose between two blocks of code and only include one of them. Critically, it will also strip import statements that are used only inside the dead block. The predicate is usually one of the other macros.

  This code:

  ```js
  import { dependencySatisfies, macroIf } from '@embroider/macros';
  import OldComponent from './old-component';
  import NewComponent from './new-component';
  export default macroIf(dependencySatisfies('ember-source', '>=3.8.0'), () => NewComponent, () => OldComponent);
  ```

  Will compile to either this:

  ```js
  import NewComponent from './new-component';
  export default NewComponent;
  ```

  Or this:

  ```js
  import OldComponent from './old-component';
  export default OldComponent;
  ```

* `failBuild(message, ...params)`: cause a compile-time build failure. Generally only useful if you put it inside a `macroIf`. All the arguments must be statically analyzable, and they get passed to Node's standard `utils.format()`.

  ```js
  import { macroIf, failBuild, dependencySatisfies } from '@embroider/macros';
  macroIf(
    dependencySatisfies('ember-source', '>=3.8.0'),
    () => true,
    () => failBuild('You need to have ember-source >= 3.8.0')
  );
  ```

* `importSync(moduleSpecifier)`: exactly like standard ECMA `import()` except instead of returning `Promise<Module>` it returns `Module`. Under Emroider this is interpreted at build-time. Under classic ember-cli it is interpreted at runtime. This exists to provide synchronous & dynamic import. That's not a think ECMA supports, but it's a thing Ember historically has done, so we sometimes need this macro to bridge the worlds.

## Template macros

These are analogous to the Javascript macros, although here (because we don't import them) they are all prefixed with "macro".

- `macroGetOwnConfig`: works like a helper that pulls values out of your config. For example, assuming you have the config:

  ```json
  {
    "items": [{ "score": 42 }]
  }
  ```

  Then:

  ```hbs
  <SomeComponent @score={{macroGetOwnConfig "items" "0" "score" }} />
  {{! ⬆️compiles to ⬇️ }}
  <SomeComponent @score={{42}} />
  ```

  If you don't pass any keys, you can get the whole thing (although this makes your template bigger, so use keys when you can):

  ```hbs
  <SomeComponent @config={{macroGetOwnConfig}} />
  {{! ⬆️compiles to ⬇️ }}
  <SomeComponent @config={{hash items=(array (hash score=42))}} />
  ```

* `macroGetConfig`: similar to `macroGetOwnConfig`, but takes the name of another package and gets that package's config. We will locate the other package following node_modules rules from your package. Additional extra arguments are treated as property keys just like in the previous examples.

  ```hbs
  <SomeComponent @config={{macroGetConfig "liquid-fire"}} />
  ```

* `macroDependencySatisfies`

  ```hbs
  <SomeComponent @canAnimate={{macroDependencySatisfies "liquid-fire" "*"}} />
  {{! ⬆️compiles to ⬇️ }}
  <SomeComponent @canAnimate={{true}} />
  ```

* `macroIf`: Like Ember's own `if`, this can be used in both block form and expresion form. The block form looks like:

  ```hbs
  {{#macroIf (macroGetOwnConfig "shouldUseThing") }}
    <Thing />
  {{else}}
    <OtherThing />
  {{/macroIf}}

  {{! ⬆️compiles to ⬇️ }}
  <Thing />
  ```

  The expression form looks like:

  ```hbs
  <div class="box {{macroIf (macroGetOwnConfig "extraModeEnabled") extraClass regularClass}}" />
  {{! ⬆️compiles to ⬇️ }}
  <div class="box {{extraClass}}"/>
  ```

- `macroMaybeAttrs`: This macro allows you to include or strip HTML attributes themselves (not just change their values). It works like an element modifier:

  ```hbs
  <div {{macroMaybeAttr (macroGetConfig "ember-test-selectors" "enabled") data-test-here data-test-there=42}} >
  {{! ⬆️compiles to either this ⬇️ }}
  <div data-test-here data-test-there=42 >
  {{! or this ⬇️ }}
  <div>
  ```

- `macroFailBuild`: cause a compile-time build failure. Generally only useful if you put it inside a `macroIf`. All the arguments must be statically analyzable, and they get passed to Node's standard `utils.format()`.

  ```hbs
  {{#macroIf (dependencySatisfies "important-thing" ">= 1.0")}}
    <UseThing />
  {{else}}
    {{macroFailBuild "You need to have import-thing >= 1.0"}}
  {{/macroIf}}
  ```

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
