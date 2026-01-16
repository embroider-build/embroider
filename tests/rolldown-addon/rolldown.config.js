import { defineConfig } from 'rolldown';
import { ember } from '@embroider/rolldown';
import { babel } from '@rollup/plugin-babel';

export default defineConfig({
  input: ['src/index.ts'],
  // sourcemap: true,
  // clean: true,
  // dts: false,
  // tsconfig: './tsconfig.build.json',
  // tsconfig: true,
  plugins: [
    babel({
      babelHelpers: 'bundled',
      extensions: ['.mjs', '.gjs', '.js', '.mts', '.gts', '.ts', '.hbs', '.hbs.js', '.json'],
    }),
    ember(),
  ],
});
