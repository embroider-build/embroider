import type { Plugin } from 'rollup';
import minimatch from 'minimatch';
import { basename, dirname, relative } from 'path';
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
        let assetFileName = relative(from, id);

        // CSS may carry a source map produced by an earlier plugin's
        // load/transform hook (e.g. a plugin that rewrites CSS). Emit it as a
        // companion `.map` and link it so browser devtools can map the emitted
        // CSS back to the original source.
        //
        // This is gated to `.css` on purpose: the `sourceMappingURL` annotation
        // is a CSS/JS comment, so appending it to other kept assets (images,
        // arbitrary text, etc.) would corrupt them. CSS is also the only text
        // asset that realistically arrives here with a meaningful map.
        if (
          !ourMeta?.binaryLoaded &&
          assetFileName.toLowerCase().endsWith('.css')
        ) {
          let map = this.getCombinedSourcemap();
          if (map && map.mappings) {
            this.emitFile({
              type: 'asset',
              fileName: `${assetFileName}.map`,
              source: map.toString(),
            });
            output = `${code}\n/*# sourceMappingURL=${basename(
              assetFileName
            )}.map */\n`;
          }
        }

        let ref = this.emitFile({
          type: 'asset',
          fileName: assetFileName,
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

        // The original module content (the asset) is gone from the JS graph —
        // it's been emitted as a file and replaced by this placeholder. There's
        // nothing to map it to, so hand back an empty map rather than letting
        // rollup warn that this transform dropped the source map.
        return { code: replacement, map: { mappings: '' } };
      }
    },
    renderChunk(code, chunk) {
      if (!code.includes(marker)) {
        return null;
      }

      const { getName, imports } = nameTracker(code, exports);
      const magic = new MagicString(code);
      const pattern = new RegExp(`${marker}\\("([^"]+)"\\)`, 'g');

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(code)) !== null) {
        let ref = match[1];
        let assetFileName = this.getFileName(ref);
        let relativeName =
          './' + relative(dirname(chunk.fileName), assetFileName);
        let replacement = getName(relativeName) ?? '';
        let start = match.index;
        let end = start + match[0].length;
        if (replacement) {
          magic.update(start, end, replacement);
        } else {
          magic.remove(start, end);
        }
      }

      magic.prepend(imports());

      // Returning a map keeps the chunk's source map intact across the import
      // injection and marker replacement above.
      return {
        code: magic.toString(),
        map: magic.generateMap({ hires: true }),
      };
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
