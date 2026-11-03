import type { Plugin } from 'rollup';
import minimatch from 'minimatch';
import { dirname, relative } from 'path';
import { readFileSync } from 'fs';
import MagicString from 'magic-string';

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
        let replacement: string;
        if (exports === '*') {
          replacement = `export * from ${marker}("${ref}")`;
        } else if (exports === 'default') {
          replacement = `export default ${marker}("${ref}")`;
        } else {
          // side-effect only
          replacement = `${marker}("${ref}")`;
        }
        // the asset's content leaves the JS module graph here. An empty map is
        // rollup's convention for "deliberately no mapping", which keeps the
        // chunk's source map intact instead of breaking it.
        return { code: replacement, map: { mappings: '' as const } };
      }
    },
    renderChunk(code, chunk) {
      if (code.includes(marker)) {
        const { getName, imports } = nameTracker(code, exports);
        const magic = new MagicString(code);

        magic.replaceAll(
          new RegExp(`${marker}\\("([^"]+)"\\)`, 'g'),
          (_x: string, ref: string) => {
            let assetFileName = this.getFileName(ref);
            let relativeName =
              './' + relative(dirname(chunk.fileName), assetFileName);
            return getName(relativeName) ?? '';
          }
        );
        magic.prepend(imports());

        // returning a map keeps the chunk's source map accurate across the
        // injected imports and marker replacements
        return {
          code: magic.toString(),
          map: magic.generateMap({ hires: 'boundary' }),
        };
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
