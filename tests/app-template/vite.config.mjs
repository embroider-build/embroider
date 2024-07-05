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

const root = "tmp/rewritten-app";

export default defineConfig(({ mode }) => {
  return {
    root,
    // esbuild in vite does not support decorators
    esbuild: false,
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
    publicDir: resolve(process.cwd(), "public"),
    server: {
      port: 4200,
      watch: {
        ignored: ["!**/tmp/**"],
      },
    },
    build: {
      outDir: resolve(process.cwd(), "dist"),
      rollupOptions: {
        input: {
          main: resolve(root, "index.html"),
          ...(shouldBuildTests(mode)
            ? { tests: resolve(root, "tests/index.html") }
            : undefined),
        },
      },
    },
  };
});

function shouldBuildTests(mode) {
  return mode !== "production" || process.env.FORCE_BUILD_TESTS;
}
