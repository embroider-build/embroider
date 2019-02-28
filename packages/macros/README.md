# @embroider/macros

A standardized solution for modifying your package's Javascript and Glimmer templates at app-compilation-time.

## Motivation

Traditionally, Ember addons have a lot of power to run arbitrary code during the build process. This lets them do whatever they need to do, but it also makes them hard to statically analyze and make them not play well with a lot of tooling (like IDEs).

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
    console.log({ "flavor": "chocolate" }.flavor);
    ```

 - `getConfig(packageName)`: like `getOwnConfig`, but will retrieve the configuration that was sent to another package. We will resolve which one based on node_modules resolution rules from your package.

 - `dependencySatisfies(packagename, semverRange)`: a macro that compiles to a boolean literal. It will be true if the given package can be resolved (via normal node_modules resolution rules) and meets the stated semver requirement.

    Assuming you have `ember-source` 3.9.0 available, this code:

    ```js
    import { semverSatisfies } from '@embroider/macros';
    let hasNativeArrayHelper = semverSatisfies('ember-source', '>=3.8.0');
    ```

    Compiles to:

    ```js
    let hasNativeArrayHelper = true;
    ```


- `macroIf(predicate, consequent, alternate)`: a compile time conditional. Lets you choose between two blocks of code and only include one of them. Critically, it will also strip import statements that are used only inside the dead block. The predicate is usually one of the other macros.

```js

```





```js
import { dependencySatisfies, macroIf } from '@embroider/macros';
import legacyVersion from './legacy';
import newVersion from './newVersion';

const implementation = macroIf(
  dependencySatisfies('ember-source', '> 3.8.0'),
  () => newVersion,
  () => legacyVersion
);
export default implementation;
```

will compile to this for new enough versions of `ember-source`:

```js
import { dependencySatisfies, macroIf } from '@embroider/macros';
import legacyVersion from './legacy';
import newVersion from './newVersion';

const implementation = macroIf(
  dependencySatisfies('ember-source', '> 3.8.0'),
  () => newVersion,
  () => legacyVersion
);
export default implementation;
```


