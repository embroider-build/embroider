import { defineConfig } from "vite";
import { embroider, hbs } from "@embroider/vite";

console.log(hbs);

import { babel } from "@rollup/plugin-babel";

export default defineConfig({
  root: "node_modules/.embroider/rewritten-app",
  plugins: [
    embroider(),
    { ...hbs(), enforce: "pre" },

    babel({
      babelHelpers: "runtime",

      // this needs .hbs because our hbs() plugin above converts them to
      // javascript but the javascript still also needs babel, but we don't want
      // to rename them because vite isn't great about knowing how to hot-reload
      // them if we resolve them to made-up names.
      extensions: [".js", ".hbs"],
    }),
  ],
  optimizeDeps: {
    exclude: ["@embroider/macros"],
  },
  server: {
    watch: {
      ignored: ["!**/node_modules/.embroider/rewritten-app/**"],
    },
  },
});
