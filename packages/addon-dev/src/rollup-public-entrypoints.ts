import walkSync from 'walk-sync';
import type { Plugin } from 'rollup';
import { join } from 'path';

export default function publicEntrypoints(args: {
  srcDir: string;
  include: string[];
}): Plugin {
  return {
    name: 'addon-modules',
    buildStart() {
      for (let name of walkSync(args.srcDir, {
        globs: args.include,
      })) {
        this.emitFile({
          type: 'chunk',
          id: join(args.srcDir, name),
          fileName: name,
        });
      }
    },
  };
}
