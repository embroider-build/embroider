import { resolve } from "node:path";
import url from "node:url";

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    outDir: "dist",
    target: ["es2021"],
    ssr: true, // aka, "node mode"
    minify: false,
    sourcemap: true,
    lib: {
      entry: [
        resolve(__dirname, "src/rollup.ts"),
        resolve(__dirname, "src/template-colocation-plugin.ts"),
        resolve(__dirname, "src/commands.ts"),
      ],
      name: "@embroider/addon-dev",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["@embroider/core"],
    },
  },
  plugins: [
    dts({
      rollupTypes: true,
      outDir: "declarations",
    }),
  ],
});
