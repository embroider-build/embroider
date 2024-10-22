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

### addon.keepAssets(patterns: string[], exports?: 'default' | '*')

A rollup plugin to preserve imports of non-Javascript assets unchanged in your published package. For example, the v2-addon-blueprint uses:

```js
addon.keepAssets(['**/*.css'])
```

so that the line `import "./my.css"` in your addon will be preserved and the corresponding CSS file will get included at the right path. 

`keepAssets` is intended to compose correctly with other plugins that synthesize CSS imports, like `glimmer-scoped-css`. It will capture their output and produce real CSS files in your published package.

The `exports` option defaults to `undefined` which means the assets are used for side-effect only and don't export any values. This is the supported way to use CSS in v2 addons. But you can also preserve assets that present themselves as having default exports with the value `"default"` or arbitrary named exports with the value `"*"`. For example:

```js
addon.keepAssets(["**/*.png"], "default")
```

lets you say `import imageURL from './my-image.png'`. Not that this pattern is **not** automatically supported in V2 addons and you would need to tell apps that consume your addon to handle it in a custom way.

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
