import { defineConfig } from 'rolldown';
import { ember } from '@embroider/rolldown';
import { babel } from '@rollup/plugin-babel';

export default defineConfig({
  input: ['src/index.ts'],
  plugins: [
    babel({
      babelHelpers: 'bundled',
      extensions: ['.mjs', '.gjs', '.js', '.mts', '.gts', '.ts', '.hbs', '.hbs.js', '.json'],
    }),
    ember(),
  ],
});
