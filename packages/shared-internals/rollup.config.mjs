import { rollupConfig } from '@embroider/build';

export default rollupConfig(import.meta, {
  publicEntrypoints: ['index.ts', 'browser-index.ts', 'babel-plugin-cache-busting.ts', 'template-colocation-plugin.ts'],
});
