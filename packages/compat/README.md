# @embroider/compat

Backward compatibility layer for the Embroider build system.

## Usage

```js
// ember-cli-build.js
const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { compatBuild } = require('@embroider/compat');

module.exports = async function (defaults) {
  const { buildOnce } = await import('@embroider/vite');
  let app = new EmberApp(defaults, {});

  return compatBuild(app, buildOnce);
};
```

`compatBuild` takes options as its third argument. They are documented in [Compat Options](https://github.com/embroider-build/embroider/blob/main/packages/compat/src/options.ts) and [Core Options](https://github.com/embroider-build/embroider/blob/main/packages/core/src/options.ts).

See the [top-level README](https://github.com/embroider-build/embroider#readme) for the status of the project.

## Contributing

See the top-level CONTRIBUTING.md in this monorepo.

## License

This project is licensed under the MIT License.
