This is unstable, incomplete, work-in-progress software. You have been warned.

# Embroider: an experimental build system for EmberJS apps

This repo implements a new three-stage build system for Ember apps.

1. The first stage achieves backward compatibility by building each classic Ember Addon package into a new **v2 package format**. This makes each package much more static and analyzable. The eventual goal is to do less and less work in this stage, as addons publish to NPM natively in v2 format.
2. The second stage takes a collection of v2-formatted addons plus an application and "compiles out" all Ember-specific conventions, such that the output can be understood by any tool that can handle standards-compliant Javascript. This stage is setup with good inputs and outputs that make it much easier to benefit from incremental improvements to our dependency analysis. The immediate goal is not to implement every possible optimization, but rather to make a good place for those optimizations to happen.
3. The third stage ("final packaging") can be handled by existing tools like Webpack, Rollup, or Parcel with only a small amount of configuration. Not because we want to force every Ember developer to choose and configure one of these tools! But because a stable, standards-compliant API between stage 2 and 3 improves our ability to innovate and experiment with taking the best parts of wider JS ecosystem tooling.

# V2 Package Spec

See [SPEC.md](https://github.com/embroider-build/embroider/blob/master/SPEC.md) for a draft of the new addon publication format we are targeting. Addon authors **SHOULD NOT** publish packages to NPM that use this format (yet), because it's still subject to change. The spec will eventually become an RFC, and only once that is final is it a good idea to publish using the format.

# Status

This is pre-alpha, don't use it, you have been warned.

I have been testing it against real applications and it already covers a large number of use cases. Soon I hope to reach a level of completeness that will benefit from testing by more people in more applications.

# How to try it

1. Add dependencies:

```
yarn add --dev @embroider/core @embroider/compat @embroider/webpack
```

2. Edit `ember-cli-build.js`:

   ```diff
   -return app.toTree();
   +const Webpack = require('@embroider/webpack').Webpack;
   +return require('@embroider/compat').compatBuild(app, Webpack);
   ```

    Alternatively, if you are passing optional extra broccoli trees into `app.toTree()`, you can rewrite like:

    ```diff
   -return app.toTree(extraTreeHere);
   +const Webpack = require('@embroider/webpack').Webpack;
   +return require('@embroider/compat').compatBuild(app, Webpack, {
   +  extraPublicTrees: [extraTreeHere]
   +});
    ```

3. Use `ember serve`, `ember test`, and `ember build` as usual.

# Contributing / Developing

1. Clone this repo.
2. Run `yarn compile` (or `yarn compile --watch`).
3. In each of the `./packages/*` directories, run `yarn link`.
4. In your app, `yarn link @embroider/core` and the other packages you need.

# Tests

There aren't any yet. Initial development has been done entirely against real apps, because even characterizing all the current behaviors we need to be compatible with is a big piece of the work.