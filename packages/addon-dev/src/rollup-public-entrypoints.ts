import walkSync from 'walk-sync';
import type { Plugin } from 'rollup';

export default function publicEntrypoints(globs: string[]): Plugin {
  return {
    name: 'addon-modules',
    buildStart() {
      for (let name of walkSync('.', {
        globs,
      })) {
        this.emitFile({ type: 'chunk', id: name, fileName: name });
      }
    },
  };
}
