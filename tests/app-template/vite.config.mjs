import { defineConfig } from "vite";
import {
  resolver,
  hbs,
  scripts,
  templateTag,
  optimizeDeps,
  compatPrebuild,
  assets,
} from "@embroider/vite";
import { resolve } from "path";
import { babel } from "@rollup/plugin-babel";

const root = "node_modules/.embroider/rewritten-app";

export default defineConfig(({ mode }) => {
  return {
    root,
    // esbuild in vite does not support decorators
    esbuild: false,
    cacheDir: resolve("node_modules", ".vite"),
    plugins: [
      hbs(),
      templateTag(),
      scripts(),
      resolver(),
      compatPrebuild(),
      assets(),

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
        ignored: ["!**/node_modules/.embroider/rewritten-app/**"],
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
