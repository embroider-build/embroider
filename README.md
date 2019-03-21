Embroider: a modern build system for EmberJS apps
===============================================================================

[![Build Status](https://travis-ci.org/embroider-build/embroider.svg?branch=master)](https://travis-ci.org/embroider-build/embroider)

This repo implements a new three-stage build system for Ember apps.

1. The first stage achieves backward compatibility by building each classic
   Ember Addon package into a new **v2 package format**. This makes each package
   much more static and analyzable. The eventual goal is to do less and less
   work in this stage, as addons publish to NPM natively in v2 format.

2. The second stage takes a collection of v2-formatted addons plus an
   application and "compiles out" all Ember-specific conventions, such that the
   output can be understood by any tool that can handle standards-compliant
   Javascript. This stage is setup with good inputs and outputs that make it
   much easier to benefit from incremental improvements to our dependency
   analysis. The immediate goal is not to implement every possible optimization,
   but rather to make a good place for those optimizations to happen.

3. The third stage ("final packaging") can be handled by existing tools like
   Webpack, Rollup, or Parcel with only a small amount of configuration. Not
   because we want to force every Ember developer to choose and configure one of
   these tools! But because a stable, standards-compliant API between stage 2
   and 3 improves our ability to innovate and experiment with taking the best
   parts of wider JS ecosystem tooling.


Status / Should I Use It?
-------------------------------------------------------------------------------

This is beta-quality software. Teams are encouraged to test their apps and
addons using Embroider and report bugs. We need more real-world testing before
we can hit stable 1.0 and integrate into ember-cli as the default build
pipeline.

The main risks to be aware of if you choose to use Embroider in production are:

 - you're likely to discover some Ember addons don't work or break your build
 - Embroider's own configuration options are subject to change, so you'll need
   to read the CHANGELOG.md when updating the Embroider packages.


V2 Package Spec
-------------------------------------------------------------------------------

See [SPEC.md](SPEC.md) for a draft of the new addon publication format we are
targeting. Addon authors **SHOULD NOT** publish packages to NPM that use this
format (yet), because it's still subject to change. The spec will eventually
become an RFC, and only once that is final is it a good idea to publish using
the format.


How to try it
-------------------------------------------------------------------------------

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

   Alternatively, if you are passing optional extra broccoli trees into
   `app.toTree()`, you can rewrite like:

   ```diff
   -return app.toTree(extraTreeHere);
   +const Webpack = require('@embroider/webpack').Webpack;
   +return require('@embroider/compat').compatBuild(app, Webpack, {
   +  extraPublicTrees: [extraTreeHere]
   +});
   ```

3. Use `ember serve`, `ember test`, and `ember build` as usual.


Contributing
-------------------------------------------------------------------------------

see [`CONTRIBUTING.md`](CONTRIBUTING.md)


License
-------------------------------------------------------------------------------

This project is licensed under the [MIT License](LICENSE).
