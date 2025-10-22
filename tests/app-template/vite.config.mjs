import { defineConfig } from "vite";
import { extensions, classicEmberSupport, ember } from "@embroider/vite";
import { babel } from "@rollup/plugin-babel";

export default defineConfig({
  plugins: [
    classicEmberSupport({ watch: false }),
    ember(),
    // extra plugins here
    babel({
      babelHelpers: "runtime",
      extensions,
    }),
  ],
});
