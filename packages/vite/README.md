# @embroider/vite

Vite plugins that build Ember apps with Embroider.

## Usage

```js
// vite.config.mjs
import { defineConfig } from 'vite';
import { extensions, classicEmberSupport, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';

export default defineConfig({
  plugins: [
    classicEmberSupport(),
    ember(),
    babel({
      babelHelpers: 'runtime',
      extensions,
    }),
  ],
});
```

`classicEmberSupport()` is for apps that have an `ember-cli-build.js`. An app without that file can omit the plugin.

See the [top-level README](https://github.com/embroider-build/embroider#readme) for the status of the project and for the options.

## Contributing

See the top-level CONTRIBUTING.md in this monorepo.

## License

This project is licensed under the MIT License.
