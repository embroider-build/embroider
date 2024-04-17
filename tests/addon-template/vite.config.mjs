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
        ignored: ["!**/node_modules/.embroider/rewritten-app/**"],
      },
    },
    // If the "app" is a classic addon dummy app, the public directory is tests/dummy/public,
    // any public directory at the root would rather contain the assets provided by the addon,
    // which are managed by the assets plugin.
    publicDir: resolve(process.cwd(), "tests/dummy/public"),
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
