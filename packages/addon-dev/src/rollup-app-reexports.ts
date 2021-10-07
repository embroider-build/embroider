import minimatch from 'minimatch';
import type { Plugin } from 'rollup';

export default function appReexports(opts: {
  from: string;
  to: string;
  include: string[];
}): Plugin {
  return {
    name: 'app-reexports',
    generateBundle(_, bundle) {
      for (let filename of Object.keys(bundle)) {
        if (opts.include.some((glob) => minimatch(filename, glob))) {
          this.emitFile({
            type: 'asset',
            fileName: `app/${filename}`,
            source: `export { default } from "${filename}"`,
          });
        }
      }
    },
  };
}
