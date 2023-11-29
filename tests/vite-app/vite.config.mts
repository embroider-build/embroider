import { defineConfig } from "vite";
import {
  resolver,
  hbs,
  scripts,
  templateTag,
  addons
} from "@embroider/vite";
import { resolve } from "path";
import { babel } from "@rollup/plugin-babel";

const root = "app";
const rewrittenApp = "node_modules/.embroider/rewritten-app";

export default defineConfig({
  root: rewrittenApp,
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
  publicDir: null,
  optimizeDeps: { exclude: addons(__dirname) },
  server: {
    watch: {
      cwd: resolve('.'),
      ignored: ["!**/node_modules/.embroider/rewritten-app/**"],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(rewrittenApp, "index.html"),
        tests: resolve(rewrittenApp, "tests/index.html"),
      },
    },
  },
});
