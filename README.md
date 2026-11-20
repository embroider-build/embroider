# Embroider: translating existing Ember code into spec-compliant modern JavaScript


[![GitHub Actions CI][github-actions-badge]][github-actions-ci-url]

[github-actions-badge]: https://github.com/embroider-build/embroider/workflows/CI/badge.svg
[github-actions-ci-url]: https://github.com/embroider-build/embroider/actions?query=workflow%3ACI

This repo implements the Embroider translation layer and resolver that is used to allow modern build tooling with Ember Apps.

You can read more about the motivation and key ideas in the [intro to the SPEC](docs/spec.md).

## Status / Should I Use It?

There is an accepted RFC that will [make the Embroider build system the default for all newly generated Ember apps](https://rfcs.emberjs.com/id/0977-v2-app-format) i.e. when you run `ember new my-app` it will generate an Ember app that is built with [Vite](https://vite.dev) with this Embroider resolver installed as a plugin.

If you don't want to wait until that RFC has been fully implemented you can try out the [ember-vite-codemod](https://github.com/mainmatter/ember-vite-codemod) which will guide you through updating your existing applications or you can try the current [draft blueprint for an Embroider based Ember ember app](https://github.com/embroider-build/app-blueprint) and follow the instructions on that README.

Embroider with Vite is considered production ready so you should try it out and let us know if you discover any issues with your Applications

## For Addon Authors

Addon authors should see [ADDON-AUTHOR-GUIDE.md](docs/addon-author-guide.md) for advice on how to get their existing addons ready for Embroider. 

The [v2 Addon Format RFC](https://github.com/emberjs/rfcs/pull/507) is the official spec for the packages that Embroider natively handles. Common patterns and best practices for authoring these have been collected in the [v2 addon FAQs](./docs/v2-faq.md). For creating a new v2 addon from scratch, we recommend using our [v2 addon blueprint](https://github.com/embroider-build/addon-blueprint). For porting existing v1 addons, we refer to the [v2 porting guide](./docs/porting-addons-to-v2.md).

## Options

Set Embroider options in a config file in the root of your app:

```js
// embroider.config.js (or embroider.config.cjs)
export default {
  splitAtRoutes: ['route.name'], // can also be a RegExp
};
```

Embroider finds the file with [lilconfig](https://github.com/antonk52/lilconfig) and searches only the app root. The file can also be the `"embroider"` key in `package.json`, `.embroiderrc.json`, `.embroiderrc.js`, `.embroiderrc.cjs`, or a file in `.config/`. Embroider does not read `.mjs` files. In an app with `"type": "module"`, use an ESM `embroider.config.js`.

The options are documented in detail in [Core Options](https://github.com/embroider-build/embroider/blob/main/packages/core/src/options.ts) and [Compat Options](https://github.com/embroider-build/embroider/blob/main/packages/compat/src/options.ts).

### Apps with `ember-cli-build.js`

The config file accepts every option of `compatBuild`. The options that you give to `compatBuild` still work:

```js
// ember-cli-build.js
const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { compatBuild } = require('@embroider/compat');

module.exports = async function (defaults) {
  const { buildOnce } = await import('@embroider/vite');
  let app = new EmberApp(defaults, {});

  return compatBuild(app, buildOnce, {
    staticInvokables: true, // this is the default so you don't need to set it
  });
};
```

If the config file and `compatBuild` set the same option, Embroider uses the value from the config file and shows a deprecation. Move the option to the config file.

### Apps without `ember-cli-build.js`

The config file accepts these options:

- `splitAtRoutes`
- `staticAppPaths`
- `modulePrefix`: the start of the app's module names in `@embroider/virtual/compat-modules`. The default is `"."`, which gives names like `"./routes/about"`, for the strict resolver of Ember 7.2 and later. An app that uses ember-resolver must set it to the `name` in its `package.json`.
- `appDir`: the folder of the app files, for example `'./demo-app'`. The default comes from the `exports` in `package.json`. A v2 addon with a test app in its own package needs it, because its `exports` point at its published files.

To split routes, the app must:

- use `@embroider/router` for its router
- give the modules from `@embroider/virtual/compat-modules` to its resolver

For example, with the strict resolver of Ember 7.2 and later:

```js
import Application from '@ember/application';
import compatModules from '@embroider/virtual/compat-modules';

export default class App extends Application {
  modules = compatModules;
}
```

## Environment variables

For optional features, Embroider supports the following environment variables:

- `EMBROIDER_WORKING_DIRECTORY`: by default Embroider writes internal build-time artifacts like rewritten packages to `node_modules/.embroider`. In the case of running multiple builds concurrently (e.g. building for production and test in parallel) this would cause conflicts when concurrent processes try to write into the same directory. For this case you can point each Embroider process to a different directory using this environment variable. It can be an absolute file path, or relative to the application root directory.

## Compatibility

### Ember version

Requires Ember 3.28.11 or greater

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
