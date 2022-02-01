/**
  *  This file should live at ./config/rollup.config.js
  *  and the babel config at ./config/babel.config.js (if the babel config is ESM)
  *    _if the babel config is CJS, it can be at the addon root_
  *
  *  The command to build:
  *
  *    `rollup -c ./config/rollup.config.js`
  */
import path from 'path';

import alias from '@rollup/plugin-alias';
import multiInput from 'rollup-plugin-multi-input';
import ts from 'rollup-plugin-ts';
import { defineConfig } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { Addon } from '@embroider/addon-dev/rollup';

import babelConfig from './babel.config';
import packageJson from '../package.json';

const addon = new Addon({
  srcDir: 'src',
  destDir: 'dist',
});

const transpilation = [
  // Instruct rollup how to resolve ts and hbs imports
  // (importing a template-only component, for example)
  nodeResolve({ resolveOnly: ['./'], extensions: ['.js', '.ts', '.hbs'] }),

  // Allow top-level imports (what folks are used to from v1 addons)
  // During the build, anything referencing a top-level import will be
  // replaced with a relative import.
  // DANGER: it's somewhat easy to cause circular references with this tool
  alias({
    entries: [
      {
        find: '#types',
        replacement: path.resolve('src', '-private', 'types.ts'),
      },
      {
        find: packageJson.name,
        replacement: path.resolve('src'),
      },
      {
        find: `${packageJson.name}/(.*)`,
        replacement: path.resolve('src/$1'),
      },
    ],
  }),

  // This babel config should *not* apply presets or compile away ES modules.
  // It exists only to provide development niceties for you, like automatic
  // template colocation.
  // See `babel.config.json` for the actual Babel configuration!
  ts({
    // can be changed to swc or other transpilers later
    // but we need the ember plugins converted first
    // (template compilation and co-location)
    transpiler: 'babel',
    browserslist: false,
    babelConfig,
    // setting this true greatly improves performance, but
    // at the cost of safety (and no declarations output in your dist directory).
    transpileOnly: false,
    tsconfig: {
      fileName: 'tsconfig.json',
      hook: (config) => ({ ...config, declaration: true }),
    },
  }),

  // Follow the V2 Addon rules about dependencies. Your code can import from
  // `dependencies` and `peerDependencies` as well as standard Ember-provided
  // package names.
  addon.dependencies(),

  // Ensure that standalone .hbs files are properly integrated as Javascript.
  addon.hbs(),

  // addons are allowed to contain imports of .css files, which we want rollup
  // to leave alone and keep in the published output.
  // addon.keepAssets(['**/*.css']),
];

// these should be JS, even though the authored format is TS
const globallyAvailable = ['components/**/*.js', 'services/*.js'];

export default defineConfig({
  input: ['src/**/*{js,hbs,ts}'],
  output: addon.output(),
  plugins: [
    // allows specifying glob inputs so we can transpile each module separately
    multiInput(),

    ...transpilation,

    // These are the modules that users should be able to import from your
    // addon. Anything not listed here may get optimized away.
    addon.publicEntrypoints([...globallyAvailable]),

    // These are the modules that should get reexported into the traditional
    // "app" tree. Things in here should also be in publicEntrypoints above, but
    // not everything in publicEntrypoints necessarily needs to go here.
    //
    // This generates an `_app_/` directory in your output directory
    // and updates an 'ember-addon.app-js' entry in your package.json
    addon.appReexports([...globallyAvailable]),

    // Remove leftover build artifacts when starting a new build.
    addon.clean(),
  ],
});
