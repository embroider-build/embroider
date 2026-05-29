import path from 'path';

import type { Plugin } from 'rollup';
import { discoverEntrypoints } from './entrypoints';

export default function publicEntrypoints(args: {
  srcDir: string;
  include: string[];
  exclude?: string[];
}): Plugin {
  return {
    name: 'addon-modules',

    async buildStart() {
      // wait a bit first https://github.com/nodejs/node/issues/4760
      await new Promise((resolve) => setTimeout(resolve, 50));

      let entrypoints = discoverEntrypoints(args);

      for (const { name } of entrypoints) {
        this.addWatchFile(path.resolve(args.srcDir, name));
      }

      for (let { idName, fileName } of entrypoints) {
        this.emitFile({
          type: 'chunk',
          id: path.join(args.srcDir, idName),
          fileName,
        });
      }
    },
  };
}
