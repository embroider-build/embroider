import { babel } from '@rollup/plugin-babel';
import { ember } from '@embroider/rolldown';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  sourcemap: true,
  clean: true,
  dts: true,
  neverBundle: ['node:*', '@ember/*', '@glimmer/*'],
  plugins: [
    babel({
      babelHelpers: 'bundled',
      extensions: ['.mjs', '.gjs', '.js', '.mts', '.gts', '.ts', '.hbs', '.hbs.js', '.json'],
    }),
    ember(),
  ],
  devtools: {
    ui: true,
  },
});
