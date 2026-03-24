# @embroider/macros

A standardized solution for modifying your package's Javascript and Glimmer templates at app-compilation-time.

## Motivation

Traditionally, Ember addons have a lot of power to run arbitrary code during the build process. This lets them do whatever they need to do, but it also makes them hard to statically analyze and makes them play badly with some tooling (like IDEs).

The [Embroider package spec](../../docs/spec.md) proposes fixing this by making Ember addons much more static. But they will still need the ability to change themselves in certain ways at app compilation time. Hence this package.

This package works in both Embroider and Classical builds, so that addon authors can switch to this newer pattern without disruption.

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

## The Macros

### macroCondition

The `macroCondition` macro allows branch level code isolation (and deletion in the case of production builds). Generally macroConditions are viewed as a foundation macro and are combined with others marcos (detailed below) to create more complex scenarios. `macroCondition` takes a single argument which must be statically known or another macro which will compile down to a static value.

```js
import { macroCondition } from '@embroider/macros';

if (macroCondition(true)) {
  // this branch will remain in both dev and production builds
} else if (macroCondition(false)) {
  // this branch will never be hit and furthermore in production
  // builds it will be fully removed
}

// they can also be used as ternary expressions:
let specialVariable = 'Hello ' + (macroCondition(true) ? 'Bob' : 'Jane');

console.log(specialVariable); // will print "Hello Bob"
```

Macros can also be used inside of templates:

```hbs
{{#if (macroCondition true)}}
  red
{{else}}
  blue
{{/if}}
```

Starting with Ember 3.25 you can also use it to conditionally apply modifiers:

```hbs
<button {{(if (macroCondition true) on) "click" this.something}}>Submit</button>
```

However, in all cases the argument to `macroCondition` must be statically analyzable:

```js
import { macroCondition } from '@embroider/macros';

let foo = true;
if (macroCondition(foo)) {
  // this is not allowed as the first argument must be statically known
}
```

### importSync

The primary reason for Embroider's existence is to create statically analyzable builds. An under pinning of this
is the ability to walk and understand the dependency graph of every module. Embroider can natively understand `imports` such as `import foo as 'foo'` but cannot handle `require`'s (imagine: `require(bar ? 'bar' : 'baz')`. The `importSync` macro is way to "tell" Embroider about the existence of a module and to bring it into a package's scope such that it can be discovered and included into the final build. `importSync` takes a single static string as its only required argument.

```js
import { importSync } from '@embroider/macros';

let foo = importSync('foo');

// will compile to:

let foo = require('foo');
```

#### hint

When using `importSync` on non ember-addon packages both the package being imported from *and* `ember-auto-import` *must* be in the `dependencies` of your addons `package.json`.

### dependencySatisfies

Tests whether a given dependency is present and satisfies the given semver range. Both arguments must be strings and the second argument will be passed into [semver's satisfies](https://github.com/npm/node-semver#usage) method.

```js
import { dependencySatisfies } from '@embroider/macros';

let doesFooExist = dependencySatisfies('foo', '1.0.0');

// will compile to:

let doesFooExist = true; // or false if the dependency was not satisfied
```

We can use this macro along with the `macroCondition` and `importSync` macro's from above to do something more complex:

```js
import { macroCondition, dependencySatisfies, importSync } from '@embroider/macros';

if (macroCondition(dependencySatisfies('ember-qunit', '*'))) {
  return importSync('ember-qunit');
} else if (macroCondition(dependencySatisfies('ember-mocha', '*'))) {
  return importSync('ember-mocha');
}
```

```hbs
{{macroDependencySatisfies 'qunit' '^2.8.0'}}
```

### getOwnConfig, getConfig, and getGlobalConfig

A common pattern is to have a set of configuration properties that you define (or a consumer defines for you) which you base certain build time conditions around. This is achieved via the `getOwnConfig`, `getConfig`, and `getGlobalConfig` macros (depending on which config you want to read).

```js
module.exports = {
  name: require('./package').name,
  options: {
    '@embroider/macros': {
      setOwnConfig: {
        themeColor: 'red',
      },
    },
  },
  included() {
    this._super.included.apply(this, arguments);
    this.options['@embroider/macros'].setOwnConfig.shouldIncludeMinifiedLibrary = false;
  },
};
```

```js
import { getOwnConfig, importSync, macroCondition } from '@embroider/macros';

if (macroCondition(getOwnConfig().shouldIncludeMinifiedLibrary)) {
  importSync('minified-library');
} else {
  importSync('unminified-library');
}
```

```hbs
<button class="{{macroGetOwnConfig "themeColor"}}">My Themed Button</button>
```

### isTesting, isDevelopingApp

These methods can be used in conjunction with `macroCondition` to tree-shake code for specific environments.

```js
import { isTesting, isDevelopingApp, macroCondition } from '@embroider/macros';

if (macroCondition(isTesting())) {
  // some test code - stripped out when not running tests
} else {
  // some non-test code
}

if (macroCondition(isDevelopingApp())) {
  // some code when app is in development environment - stripped out in production builds
} else {
  // some production code
}
```

Note that these can be used in combination - e.g. if you run tests in the production environment, `isTesting()` will be true, but `isDevelopingApp()` will be false.

## Glint usage
If you are using [Glint](https://typed-ember.gitbook.io/glint/) and `environment-ember-loose`, you can add all the macros to your app at once by adding

```ts
import type { EmbroiderMacrosRegistry } from "@embroider/macros";
```
to your app's e.g. `types/glint.d.ts` file, and making sure your registry extends from EmbroiderMacrosRegistry:

```ts
declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry
    extends EmbroiderMacrosRegistry {
      // ...
    }
}
```

## Real world examples

Below are a list of addons that have started using `@embroider/macros` so that you can get a feel for common use cases that can be solved via the macro system.

- [ember-exam](https://github.com/ember-cli/ember-exam)
- [ember-bootstrap](https://github.com/kaliber5/ember-bootstrap)
- [ember-stargate](https://github.com/kaliber5/ember-stargate)
