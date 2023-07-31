import { rollupConfig } from '@embroider/build';

export default rollupConfig(import.meta, {
  publicEntrypoints: ['index.ts'],
});
