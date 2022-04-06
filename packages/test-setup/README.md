# @embroider/test-setup

This package exists to make it easier to add Embroider compatibility testing to your addon's or app's continuous integration (CI) matrix.

It's small and and doesn't actually install Embroider. Instead, it gives you a utility that will cause your project to build using Embroider if Embroider happens to be present. This lets you conditionally add Embroider only when you want to test it (via [ember-try](https://github.com/ember-cli/ember-try), for example).

## Should I use this in my addon?

Yes. By testing under Embroider, you ensure that your addon won't block apps from working under Embroider.

## Should I use this in my app?

Maybe. **This package is intended for CI testing only**. If you're ready to switch completely to Embroider, you should not use `@embroider/test-setup`. You should directly depend on the Embroider packages so you can control what version you're getting and how it's configured.

That said, adding Embroider to your app's CI matrix is a great way to help ensure Embroider will support your app well once it hits a stable release. We want to hear from you if it doesn't work, so we can figure out why. So using the package is a good idea, up until the point where you don't need it anymore because you're switching full-time to Embroider.

# How to use it

1. Add `@embroider/test-setup` as a devDependency of your app or addon.
2. Modify your `ember-cli-build.js` file:

   ```diff
   - return app.toTree();
   + const { maybeEmbroider } = require('@embroider/test-setup');
   + return maybeEmbroider(app);
   ```

3. In `config/ember-try.js`, add one or more of the scenarios we provide

   ```js
   const getChannelURL = require('ember-source-channel-url');
   const { embroiderSafe, embroiderOptimized } = require('@embroider/test-setup');
   module.exports = async function () {
     return {
       scenarios: [
         {
           name: 'ember-release',
           npm: {
             devDependencies: {
               'ember-source': await getChannelURL('release'),
             },
           },
         },
         embroiderSafe(),
         embroiderOptimized(),
       ],
     };
   };
   ```

4. If your CI system invokes ember-try scenarios one by one, make sure to add these new scenarios to your matrix (for example, in `.travis.yml` or `.github/workflows/ci.yml`). Their names are `embroider-safe` and `embroider-optimized`.

# Understanding the scenarios

The `embroiderSafe()` scenario configures Embroider with its most backward-compatible settings.

The `embroiderOptimized()` scenario tests with Embroider with its most aggressive settings.

It's important for addons to work correctly under both scenarios, because this gives app authors the widest range of options to use as they migrate. Working under `embroiderOptimized()` does not guarantee you work under `embroiderSafe()`, because the optimized builds can actually compile-out certain problematic behaviors (like broken-but-unused modules).

It's less important for apps to work correctly under both -- you can pick one and just ensure you keep working under it. It's also OK to manage your own configuration directly, if you've achieved a level of support somewhere between these extremes.

# API Docs

### `maybeEmbroider(app, [embroiderOptions])`

This function always accepts your `app` (the value returned from `new EmberApp` or `new EmberAddon` in `ember-cli-build.js`). It always returns a broccoli tree.

When Embroider is not present in the app's dependencies, it does exactly the same thing as `app.toTree()`. But when Embroider is present, it uses Embroider and if it sees one of our pre-defined scenario names in the environment variable `EMBROIDER_TEST_SETUP_OPTIONS`, it will merge those pre-defined options into any options that you provided.

For detailed documentation on what can go in `embroiderOptions`, see the comments in [Core Options](`https://github.com/embroider-build/embroider/blob/main/packages/core/src/options.ts`) and [Compat Options](https://github.com/embroider-build/embroider/blob/main/packages/compat/src/options.ts).

If you normally pass extra broccoli trees to the `app.toTree()` method, you can still do so and should use the `extraPublicTrees` option:

```diff
-return app.toTree([icons, fonts]);
+return maybeEmbroider(app, { extraPublicTrees: [icons, fonts] });
```

### `embroiderSafe([emberTryConfig])`

Returns an ember-try scenario that configures Embroider to use the most compatible options. You can optionally pass additional ember-try arguments that will be merged into the provided scenario, like:

```js
embroiderSafe({
  npm: {
    devDependencies: {
      somethingExtra: '1.0.0',
    },
  },
  env: {
    WHATEVER: 'hi',
  },
});
```

### `embroiderOptimized([emberTryConfig])`

Returns an ember-try scenario that configures Embroider to use the most aggressive options. You can optionally pass additional ember-try arguments that will be merged into the provided scenario, like:

```js
embroiderOptimized({
  npm: {
    devDependencies: {
      somethingExtra: '1.0.0',
    },
  },
  env: {
    WHATEVER: 'hi',
  },
});
```
