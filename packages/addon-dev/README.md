# @embroider/addon-dev

Utilities for working on v2 addons.

For a guide on porting a V1 addon to V2, see https://github.com/embroider-build/embroider/blob/main/PORTING-ADDONS-TO-V2.md

## Rollup Utilities

`@embroider/addon-dev/rollup` exports utilities for building addons with rollup. To use them:

1. Add the following `devDependencies` to your addon:

   - @embroider/addon-dev
   - rollup
   - @babel/core
   - @rollup/plugin-babel

2. Copy the rollup and babel configs from the [v2 addon blueprint](https://github.com/embroider-build/addon-blueprint)

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
