import type { Plugin } from 'rollup';
import minimatch from 'minimatch';
import { dirname, relative } from 'path';
import { readFileSync } from 'fs';

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
  const marker = `__keep_assets_marker_${counter++}__`;

  return {
    name: 'keep-assets',

    // we implement a load hook for the assets we're keeping so that we can
    // capture their true binary representations. If we fell through to the
    // default rollup load hook we would get utf8 interpretations of them.
    //
    // Our plugin should be placed after any other plugins that have their own
    // load hooks, in which case this will not run but our transform hook will
    // still over from there.
    load(id: string) {
      if (include.some((pattern) => minimatch(id, pattern))) {
        return {
          code: readFileSync(id).toString('binary'),
          meta: {
            'keep-assets': {
              binaryLoaded: true,
            },
          },
        };
      }
    },

    transform(code: string, id: string) {
      let output: Buffer | string = code;
      let ourMeta = this.getModuleInfo(id)?.meta?.['keep-assets'];
      if (ourMeta?.binaryLoaded) {
        // when the code was produced by our own load hook it is binary-encoded
        // string and we can emit the true bytes.
        output = Buffer.from(code, 'binary');
      }
      if (include.some((pattern) => minimatch(id, pattern))) {
        let ref = this.emitFile({
          type: 'asset',
          fileName: relative(from, id),
          source: output,
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
      if (code.includes(marker)) {
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
      }
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
