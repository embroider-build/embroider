import { defineConfig } from "vite";
import {
  resolver,
  hbs,
  scripts,
  templateTag,
  optimizeDeps,
  compatPrebuild,
  assets,
  contentFor,
} from "@embroider/vite";
import { resolve } from "path";
import { babel } from "@rollup/plugin-babel";

export default defineConfig(({ mode }) => {
  return {
    cacheDir: resolve("node_modules", ".vite"),
    resolve: {
      extensions: [
        ".mjs",
        ".gjs",
        ".js",
        ".mts",
        ".gts",
        ".ts",
        ".hbs",
        ".hbs.js",
        ".json",
      ],
    },
    plugins: [
      hbs(),
      templateTag(),
      scripts(),
      resolver(),
      compatPrebuild(),
      assets(),
      contentFor(),

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
        ignored: ["!**/tmp/rewritten-app/**"],
      },
    },
    // If the "app" is a classic addon dummy app, the public directory is tests/dummy/public,
    // any public directory at the root would rather contain the assets provided by the addon,
    // which are managed by the assets plugin.
    publicDir: "tests/dummy/public",
    build: {
      outDir: "dist",
      rollupOptions: {
        input: {
          main: "index.html",
          ...(shouldBuildTests(mode)
            ? { tests: "tests/index.html" }
            : undefined),
        },
      },
    },
  };
});

function shouldBuildTests(mode) {
  return mode !== "production" || process.env.FORCE_BUILD_TESTS;
}
