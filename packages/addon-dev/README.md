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

2. Copy the sample `rollup.config.mjs` in this repo to your own `rollup.config.mjs`.
  
  <details><summary>sample rollup.config.mjs</summary>

  ```js
  import babel from '@rollup/plugin-babel';
  import { Addon } from '@embroider/addon-dev/rollup';

  const addon = new Addon({
    srcDir: 'src',
    destDir: 'dist',
  });

  export default {
    // This provides defaults that work well alongside `publicEntrypoints` below.
    // You can augment this if you need to.
    output: addon.output(),

    plugins: [
      // These are the modules that users should be able to import from your
      // addon. Anything not listed here may get optimized away.
      addon.publicEntrypoints(['components/**/*.js', 'index.js']),

      // These are the modules that should get reexported into the traditional
      // "app" tree. Things in here should also be in publicEntrypoints above, but
      // not everything in publicEntrypoints necessarily needs to go here.
      addon.appReexports(['components/welcome-page.js']),

      // This babel config should *not* apply presets or compile away ES modules.
      // It exists only to provide development niceties for you, like automatic
      // template colocation.
      //
      // By default, this will load the actual babel config from the file
      // babel.config.json.
      babel({
        babelHelpers: 'bundled',
      }),

      // Follow the V2 Addon rules about dependencies. Your code can import from
      // `dependencies` and `peerDependencies` as well as standard Ember-provided
      // package names.
      addon.dependencies(),

      // Ensure that standalone .hbs files are properly integrated as Javascript.
      addon.hbs(),

      // addons are allowed to contain imports of .css files, which we want rollup
      // to leave alone and keep in the published output.
      addon.keepAssets(['**/*.css']),

      // Remove leftover build artifacts when starting a new build.
      addon.clean(),
    ],
  };
  ```

  </details>

3. Copy the sample `babel.config.json` in this repo to your own `babel.config.json`.

  <details><summary>sample babel.config.json</summary>
  

  ```json
  {
    "plugins": [
      "@embroider/addon-dev/template-colocation-plugin",
      ["@babel/plugin-proposal-decorators", { "legacy": true }],
      "@babel/plugin-transform-class-properties"
    ]
  }
  ```

  </details>

  alternatively, a `babel.config.cjs` may be used and that would like like this:

  <details><summary>sample babel.config.cjs</summary>

  ```js
  // Some addons need to transform their templates before they have a portable format.
  // In "classic" builds this was done at the application. In embroider it should
  // be done during the addon build.
  const someAstTransformPlugin = require('./some-ast-transform-plugin');

  module.exports = {
    plugins: [
      '@embroider/addon-dev/template-colocation-plugin',
      [
        'babel-plugin-ember-template-compilation',
        {
          targetFormat: 'hbs',
          compilerPath: 'ember-source/dist/ember-template-compiler',
          transforms: [
            someAstTransformPlugin,
            './path/to/another-template-transform-plugin',
          ],
        },
      ],
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      '@babel/plugin-transform-class-properties',
    ],
  };
  ```

  </details>

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
