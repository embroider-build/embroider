# Embroider: translating existing Ember code into spec-compliant modern JavaScript

[![GitHub Actions CI][github-actions-badge]][github-actions-ci-url]

[github-actions-badge]: https://github.com/embroider-build/embroider/workflows/CI/badge.svg
[github-actions-ci-url]: https://github.com/embroider-build/embroider/actions?query=workflow%3ACI

This repo implements a new three-stage build system for Ember apps:

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

You can read more about the motivation and key ideas in the [intro to the SPEC](docs/spec.md).

## Status / Should I Use It?

Several large, heavily-tested Ember apps are shipping to production with Embroider. So if you are excited to adopt Embroider, it is a reasonable choice. The main risks to be aware of if you choose to use Embroider in production are:

- you're likely to discover some Ember addons don't work or break your build
- Embroider's own configuration options are subject to change, so you'll need
  to read the CHANGELOG.md when updating the Embroider packages.

Alternatively, it is totally safe to stick with the traditional build pipeline and wait for the official cutover point when EmberCLI starts generating new apps with Embroider by default.

## For Addon Authors

Addon authors should see [ADDON-AUTHOR-GUIDE.md](docs/addon-author-guide.md) for advice on how to get their existig addons ready for Embroider. 

The [v2 Addon Format RFC](https://github.com/emberjs/rfcs/pull/507) is the official spec for the packages that Embroider natively handles. Common patterns and best practices for authoring these have been collected in the [v2 addon FAQs](./docs/v2-faq.md). For creating a new v2 addon from scratch, we recommend using our [v2 addon blueprint](https://github.com/embroider-build/addon-blueprint). For porting existing v1 addons, we refer to the [v2 porting guide](./docs/porting-addons-to-v2.md).

## How to try it

1. Add dependencies:

   ```
   yarn add --dev @embroider/core @embroider/compat @embroider/webpack webpack
   ```

2. Edit `ember-cli-build.js`:

   ```diff
   -return app.toTree();
   +const { Webpack } = require('@embroider/webpack');
   +return require('@embroider/compat').compatBuild(app, Webpack);
   ```

   Alternatively, if you are passing optional extra broccoli trees into
   `app.toTree()`, you can rewrite like:

   ```diff
   -return app.toTree(extraTreeHere);
   +const { Webpack } = require('@embroider/webpack');
   +return require('@embroider/compat').compatBuild(app, Webpack, {
   +  extraPublicTrees: [extraTreeHere]
   +});
   ```

3. Use `ember serve`, `ember test`, and `ember build` as usual.

## Options

You can pass options into Embroider by passing them into the `compatBuild` function like:

```js
return require('@embroider/compat').compatBuild(app, Webpack, {
  // staticAddonTestSupportTrees: true,
  // staticAddonTrees: true,
  // staticHelpers: true,
  // staticModifiers: true,
  // staticComponents: true,
  // staticEmberSource: true,
  // splitAtRoutes: ['route.name'], // can also be a RegExp
  // packagerOptions: {
  //    webpackConfig: { }
  // }
});
```

The options are documented in detail in [Core Options](https://github.com/embroider-build/embroider/blob/main/packages/core/src/options.ts), [Compat Options](https://github.com/embroider-build/embroider/blob/main/packages/compat/src/options.ts), and [Webpack Options](https://github.com/embroider-build/embroider/blob/main/packages/webpack/src/options.ts).

The recommended steps when introducing Embroider into an existing app are:

1. First make it work with no options. This is the mode that supports maximum backward compatibility. If you're hitting errors, first look at the "Compatibility with Classic Builds" section below.
2. Enable `staticAddonTestSupportTrees` and `staticAddonTrees` and test your application. This is usually safe, because most code in these trees gets consumed via `import` statements that we can analyze. But you might find exceptional cases where some code is doing a more dynamic thing.
3. Enable `staticHelpers` and `staticModifiers` and test. This is usually safe because addon helpers and modifiers get invoked declaratively in templates and we can see all invocations.
4. Enable `staticComponents`, and work to eliminate any resulting build warnings about dynamic component invocation. You may need to add `packageRules` that declare where invocations like `{{component someComponent}}` are getting `someComponent` from.
5. Once your app is working with all of the above, you can enable `splitAtRoutes` and add the `@embroider/router` and code splitting should work. See the packages/router/README.md for details and limitations.

## Configuring asset URLs

If you are serving your assets from a different origin (like a CDN) from where your index.html content will
be served from, you can use the publicAssetURL option to specify the base URL. In pre-Embroider Ember apps,
this was accomplished by configuring the `fingerprint: { prepend: ... }` option handled by broccoli-asset-rev.

```js
return require('@embroider/compat').compatBuild(app, Webpack, {
  packagerOptions: {
    publicAssetURL: EmberApp.env() === 'production' ? 'https://your-cdn-here.com/' : '/', // This should be a URL ending in "/"
  },
});
```

## Template Tag Codemod

Edit `ember-cli-build.js`:
```js
return require('@embroider/compat').templateTagCodemod(app, {
  shouldTransformPath: (path) => { return true; },
  dryRun: true,
});
```
Run a normal ember build to transform your hbs templates into template tag single file components.
Requires optimized build (static* flags to be turned on)

### Options

* `shouldTransformPath` - allows users to filter the templates that the code mod would run on
* `dryRun` - option can be used to obtain a summary of the changed the build would perform and which files it would act upon

### Limitations

* App templates only
* `@embroider/compat` >= 3.6.0

## Compatibility

### Ember version

Requires Ember 3.28.11 or greater

### With Classic Builds

While we have a strong emphasis on backward compatibility with classic builds, there are a few places where you may need to make changes to your code:

#### Lazy Engines

If you're using lazy loaded engines, you need to use `@embroider/router`, which is a drop-in replacement for `@ember/routing/router`:

```diff
-import EmberRouter from '@ember/routing/router';
+import EmberRouter from '@embroider/router';
```

See [@embroider/router README](./packages/router/README.md) for more details.

## Analyzing Bundles

see [`ANALYZING.md`](docs/analyzing.md)

## Contributing

see [`CONTRIBUTING.md`](CONTRIBUTING.md)

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

Thanks to [Cardstack](https://github.com/cardstack) for sponsoring Embroider's development.

Thanks to the [Embroider Initiative](https://mainmatter.com/embroider-initiative/) sponsors for contributing to Embroider's development: 

- [Intercom](https://www.intercom.com/)
- [Ticketsolve](https://www.ticketsolve.com/)
- [Crowdstrike](https://www.crowdstrike.com/)
- [Auditboard](https://auditboard.com/)
- [HashiCorp](https://www.hashicorp.com/)
- [OTA Insight](https://www.otainsight.com/)
- [XBE](https://www.x-b-e.com/)
- [Teamtailor](https://www.teamtailor.com/)
