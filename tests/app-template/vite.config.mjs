import { defineConfig } from "vite";
import {
  extensions,
  classicEmberSupport,
  ember,
  ssrPlugin,
} from "@embroider/vite";
import { babel } from "@rollup/plugin-babel";

export default defineConfig({
  plugins: [
    ssrPlugin(),
    classicEmberSupport(),
    ember(),
    // extra plugins here
    babel({
      babelHelpers: "runtime",
      extensions,
    }),
  ],
});
