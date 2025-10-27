# `@embroider/vite`


## Install

```bash
npm add --save-dev @embroider/vite
```

## Usage

```js
// vite.config.js or vite.config.mjs
import { defineConfig } from "vite";
import { classicEmberSupport, ember } from "@embroider/vite";

export default defineConfig({
  plugins: [
    classicEmberSupport(),
    ember(),
    
    // ...
  ],
});
```

And then start your app with `vite` or `npm exec vite`

## exports


### `ember`


The `ember()` plugin is responsible for:
- gjs / gts support
- resolving imports, addons, dealing with app-tree-merging
- configuring 
  - the dev server
  - the `index.html` and `tests/index.html` as entrypoints (depending on build environment)
  - production builds

This plugin has no options.

### `classicEmberSupport`

The `classicEmberSupport()` plugin is need if you need (or have):

- hbs and content-for support
- the compatibility prebuild (running ember-cli / broccoli)
- classic asset pipelines
- any v1 addons (direct or indirect)
  You can check which v1 addons you may have via [this tool](https://github.com/IgnaceMaes/ember-addon-v2-scanner)
  ```bash
  npx ember-addon-v2-scanner@latest
  ```
- the `config/environment.js` (a node file) to be interpreted to to browser-runtime (with the help of `@embroider/config-meta-loader`)
- rely on behaviors in `ember-cli-build.js` (or `ember-cli-build.cjs`)

#### `classicEmberSupport({ watch: false })`

By default, `classicEmberSupport` will tell `ember-cli` to start in watch mode (`{ watch: true }`). This is recommended if you still have v1 addons that you develop.
If you don't have any v1 addons that you want to develop, or if your file system has run out of file-watchers, you may set `{ watch: false }`, to have ember-cli build once when you boot up your app via `vite`.

#### `classicEmberSupport({ reusePrebuild: true })`

By default, `classicEmberSupport` will not re-use the "prebuild" created by running `ember-cli` (`{ reusePrebuild: false }`). When setting `{ reusePrebuild: true }`, watchmode (described above, via setting (or using the default) `{ watch: true }`) will be turned off and set to `false`.

This option helps improve subsequent start up times of your dev server, and caches the build in the same way `vite` decides to cache its cacheable work (such as optimized deps).

When starting your dev server with `vite --force`, the old prebuild will be ignored, and `ember-cli` will run once more, as if there was no cache.

