import { rollupConfig } from "@embroider/build";

export default rollupConfig(import.meta, {
  publicEntrypoints: ["rollup.ts", "template-colocation-plugin.ts"],
});
