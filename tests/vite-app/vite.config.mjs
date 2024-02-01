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
import { hmr } from 'ember-vite-hmr';


const root = "node_modules/.embroider/rewritten-app";

export default defineConfig({
  root,
  // esbuild in vite does not support decorators
  esbuild: false,
  plugins: [
    hbs(),
    templateTag(),
    scripts(),
    resolver(),
    hmr(),

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
    port: 4200,
    watch: {
      ignored: ["!**/node_modules/.embroider/rewritten-app/**"],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        tests: resolve(root, "tests/index.html"),
      },
    },
  },
});
