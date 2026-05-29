import { babel } from '@rollup/plugin-babel';
import { defineConfig } from 'tsdown';
import { Addon } from '@embroider/addon-dev/rollup';
import { tsdown } from '@embroider/addon-dev/tsdown';

const addon = new Addon({
  srcDir: 'src',
  destDir: 'dist',
});

export default defineConfig(
  tsdown(addon, {
    // These are the modules that users should be able to import from your
    // addon. Anything not listed here may get optimized away.
    publicEntrypoints: ['components/**/*.js', 'index.js'],

    // These are the modules that should get reexported into the traditional
    // "app" tree. Things in here should also be in publicEntrypoints above, but
    // not everything in publicEntrypoints necessarily needs to go here.
    appReexports: ['components/welcome-page.js'],

    // addons are allowed to contain imports of .css files, which we want to
    // leave alone and keep in the published output.
    keepAssets: [{ include: ['**/*.css'] }],

    // tsdown emits your `.d.ts` declarations (via oxc isolated declarations),
    // replacing the separate glint/ember-tsc step. Set to `false` to opt out.
    declarations: true,

    plugins: [
      // This babel config should *not* apply presets or compile away ES
      // modules. It exists only to provide development niceties for you, like
      // automatic template colocation and template compilation.
      //
      // By default, this will load the actual babel config from the file
      // babel.config.json.
      babel({
        babelHelpers: 'bundled',
        extensions: ['.js', '.ts', '.gjs', '.gts', '.hbs'],
      }),
    ],
  })
);
