import type { Plugin } from 'rollup';
import minimatch from 'minimatch';
import { dirname, relative } from 'path';

// randomly chosen, we're just looking to have high-entropy identifiers that
// won't collide with anyting else in the source
let counter = 11559;

export default function keepAssets({
  from,
  include,
  exports,
}: {
  from: string;
  include: string[];
  exports?: undefined | 'default' | '*';
}): Plugin {
  const marker = `__copy_asset_marker_${counter++}__`;

  return {
    name: 'copy-assets',

    transform(code: string, id: string) {
      if (include.some((pattern) => minimatch(id, pattern))) {
        let ref = this.emitFile({
          type: 'asset',
          fileName: relative(from, id),
          source: code,
        });
        if (exports === '*') {
          return `export * from ${marker}("${ref}")`;
        } else if (exports === 'default') {
          return `export default ${marker}("${ref}")`;
        } else {
          // side-effect only
          return `${marker}("${ref}")`;
        }
      }
    },
    renderChunk(code, chunk) {
      const { getName, imports } = nameTracker(code, exports);

      code = code.replace(
        new RegExp(`${marker}\\("([^"]+)"\\)`, 'g'),
        (_x, ref) => {
          let assetFileName = this.getFileName(ref);
          let relativeName =
            './' + relative(dirname(chunk.fileName), assetFileName);
          return getName(relativeName) ?? '';
        }
      );
      return imports() + code;
    },
  };
}

function nameTracker(code: string, exports: undefined | 'default' | '*') {
  let counter = 0;
  let assets = new Map<string, string | undefined>();

  function getName(assetName: string): string | undefined {
    if (assets.has(assetName)) {
      return assets.get(assetName)!;
    }
    if (!exports) {
      assets.set(assetName, undefined);
      return undefined;
    }
    while (true) {
      let candidate = `_asset_${counter++}_`;
      if (!code.includes(candidate)) {
        assets.set(assetName, candidate);
        return candidate;
      }
    }
  }

  function imports() {
    return (
      [...assets]
        .map(([assetName, importedName]) => {
          if (importedName) {
            return `import ${importedName} from "${assetName}"`;
          } else {
            return `import "${assetName}"`;
          }
        })
        .join('\n') + '\n'
    );
  }

  return { getName, imports };
}
