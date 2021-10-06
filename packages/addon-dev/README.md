# @embroider/addon-dev

Utilities for working on v2 addons.

## Rollup Utilities

`@embroider/addon-dev/rollup` exports utilities for building addons with rollup:

- `hbs` a rollup plugin that converts standalone `.hbs` files to valid Javascript.
- `publicEntrypoints` a rollup plugin that allows you to list globs for all the modules that are considered public entrypoints to your addon.
- `clean` the rollup-plugin-delete utility for cleaning your output directory between builds

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
