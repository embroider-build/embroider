import { defineConfig } from "vite";
import { embroider } from "@embroider/vite";
import { babel } from "@rollup/plugin-babel";

export default defineConfig({
  plugins: [embroider(), babel({ babelHelpers: "runtime" })],
  optimizeDeps: {
    exclude: ["@embroider/macros"],
  },
  server: {
    watch: {
      ignored: ["!**/node_modules/.embroider/rewritten-app/**"],
    },
  },
});
