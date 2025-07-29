import { defineConfig } from "vite";
import {
  extensions,
  classicEmberSupport,
  ember,
  resolver,
} from "@embroider/vite";
import { babel } from "@rollup/plugin-babel";

export default defineConfig({
  plugins: [
    classicEmberSupport(),
    ember(),
    // extra plugins here
    babel({
      babelHelpers: "runtime",
      extensions,
    }),
  ],
  optimizeDeps: {
    exclude: ["@embroider/macros"],
    rollupOptions: {
      plugins: [resolver(), babel({ babelHelpers: "runtime", extensions })],
    },
  },
});
