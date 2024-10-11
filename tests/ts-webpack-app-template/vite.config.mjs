import { defineConfig } from 'vite';
import { resolver, hbs, scripts, templateTag, optimizeDeps, compatPrebuild, contentFor } from '@embroider/vite';
import { resolve } from 'path';
import { babel } from '@rollup/plugin-babel';

export default defineConfig({
  cacheDir: resolve('node_modules', '.vite'),
  resolve: {
    extensions: ['.mjs', '.gjs', '.js', '.mts', '.gts', '.ts', '.hbs', '.hbs.js', '.json'],
  },

  plugins: [
    hbs(),
    templateTag(),
    scripts(),
    resolver(),
    compatPrebuild(),
    contentFor(),

    babel({
      babelHelpers: 'runtime',

      // this needs .hbs because our hbs() plugin above converts them to
      // javascript but the javascript still also needs babel, but we don't want
      // to rename them because vite isn't great about knowing how to hot-reload
      // them if we resolve them to made-up names.
      extensions: ['.gjs', '.js', '.hbs', '.ts', '.gts'],
    }),
  ],
  optimizeDeps: optimizeDeps(),
  server: {
    port: 4200,
    watch: {
      ignored: ['!**/tmp/rewritten-app/**'],
    },
  },
  build: {
    outDir: resolve(process.cwd(), 'dist'),
    rollupOptions: {
      input: {
        main: 'index.html',
        tests: 'tests/index.html',
      },
    },
  },
});
