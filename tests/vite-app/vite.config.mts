import { defineConfig } from "vite";
import {
  resolver,
  hbs,
  scripts,
  templateTag,
  optimizeDeps,
} from "@embroider/vite";
import { resolve } from "path";
import { babel } from "@rollup/plugin-babel";

const root = "app";
const rewrittenApp = "node_modules/.embroider/rewritten-app";

export default defineConfig({
  root: '.',
  plugins: [
    hbs(),
    templateTag(),
    scripts(),
    resolver(),

    babel({
      babelHelpers: "runtime",

      // this needs .hbs because our hbs() plugin above converts them to
      // javascript but the javascript still also needs babel, but we don't want
      // to rename them because vite isn't great about knowing how to hot-reload
      // them if we resolve them to made-up names.
      extensions: [".gjs", ".js", ".hbs", ".ts", ".gts"],
    }),
  ],
  optimizeDeps: optimizeDeps(),
  server: {
    watch: {
      ignored: ["!**/node_modules/.embroider/rewritten-app/**"],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        tests: resolve('.', "tests/index.html"),
      }
    },
  },
});
