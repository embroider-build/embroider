# @embroider/addon-dev

Utilities for working on v2 addons.

For a guide on porting a V1 addon to V2, see https://github.com/embroider-build/embroider/blob/main/docs/porting-addons-to-v2.md

## Rollup Utilities

`@embroider/addon-dev/rollup` exports utilities for building addons with rollup. To use them:

1. Add the following `devDependencies` to your addon:

   - @embroider/addon-dev
   - rollup
   - @babel/core
   - @rollup/plugin-babel

2. Copy the `./sample-rollup.config.js` in this repo to your own `rollup.config.js`.
3. Copy the `./sample-babel.config.json` in this repo to your own `babel.config.json`.

### addon.publicAssets(path <required>, options)

A rollup plugin to expose a folder of assets. `path` is a required to define which folder to expose. `options.include` is a glob pattern passed to `walkSync.include` to pick files. `options.exlude` is a glob pattern passed to `walkSync.ignore` to exclude files. `options.namespace` is the namespace to expose files, defaults to the package name + the path that you provided e.g. if you call `addon.publicAssets('public')` in a v2 addon named `super-addon` then your namespace will default to `super-addon/public`.

## addon-dev command

The `addon-dev` command helps with common tasks in v2 addons.

- linking up a test application that is embedded within your addon's repo
- synchronizing `devDependencies` from an embedded test application out into
  your addon's actual package.json

(You can avoid the need for both of these if you keep your addon and its test app as separate packages in a monorepo instead.)

## Contributing

See the top-level CONTRIBUTING.md in this monorepo.

## License

This project is licensed under the MIT License.
