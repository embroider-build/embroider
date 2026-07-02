import { describe, test, expect } from 'vitest';
import { rollup } from 'rollup';
import type {
  LoadResult,
  OutputAsset,
  OutputChunk,
  Plugin,
  RollupLog,
} from 'rollup';
import {
  TraceMap,
  originalPositionFor,
  type EncodedSourceMap,
} from '@jridgewell/trace-mapping';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import keepAssets from '../src/rollup-keep-assets';

// generated { line (1-based), column (0-based) } of the first occurrence of `token`
function generatedPositionOf(code: string, token: string) {
  const index = code.indexOf(token);
  const before = code.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length };
}

const FROM = '/proj/src';
const ENTRY_ID = '/proj/src/entry.js';
const CSS_ID = '/proj/src/styles.css';

const SCOPED_CSS = '.foo_scoped { color: red; }\n';

// a real (non-identity) map like one produced by a rewriting plugin
function mapFor(source: string) {
  return {
    version: 3,
    sources: [source],
    sourcesContent: ['.foo { color: red; }\n'],
    names: [],
    // maps the start of the output back to the start of the source
    mappings: 'AAAA',
  };
}

type StubModule = string | { code: string; map?: unknown };

// stands in for upstream plugins (like ember-scoped-css) that load modules
// and may hand rollup a `{ code, map }` from their load hook
function stubModules(modules: Record<string, StubModule>): Plugin {
  return {
    name: 'test-upstream',
    resolveId(id) {
      if (id === 'entry') return ENTRY_ID;
      if (id.startsWith('./')) return `${FROM}/${id.slice(2)}`;
      return undefined;
    },
    load(id) {
      return modules[id] as LoadResult;
    },
  };
}

const DEFAULT_MODULES: Record<string, StubModule> = {
  [ENTRY_ID]: `import "./styles.css";\nconsole.log("from entry");\n`,
  [CSS_ID]: { code: SCOPED_CSS, map: mapFor('styles.css') },
};

async function build({
  modules = DEFAULT_MODULES,
  include = ['**/*.css'],
  exports = undefined as undefined | 'default' | '*',
  sourcemap = true as boolean | 'inline' | 'hidden',
} = {}) {
  const warnings: RollupLog[] = [];
  const bundle = await rollup({
    input: 'entry',
    onwarn: (w) => warnings.push(w),
    plugins: [
      stubModules(modules),
      keepAssets({ from: FROM, include, exports }),
    ],
  });
  const { output } = await bundle.generate({ format: 'es', sourcemap });
  await bundle.close();
  return { output, warnings };
}

function findAsset(
  output: (OutputChunk | OutputAsset)[],
  fileName: string
): string | undefined {
  const asset = output.find(
    (o) => o.type === 'asset' && o.fileName === fileName
  );
  return asset ? String((asset as OutputAsset).source) : undefined;
}

function brokenSourcemapWarnings(warnings: RollupLog[]) {
  return warnings.filter((w) => w.code === 'SOURCEMAP_BROKEN');
}

describe('keep-assets source maps', () => {
  test('does not warn that sourcemaps are broken', async () => {
    const { warnings } = await build();
    expect(brokenSourcemapWarnings(warnings)).toEqual([]);
  });

  test('emits a companion .map for kept CSS that has an upstream map', async () => {
    const { output } = await build();

    const css = findAsset(output, 'styles.css');
    const map = findAsset(output, 'styles.css.map');
    expect(map, 'a companion styles.css.map asset was emitted').toBeTruthy();

    expect(css).toContain(SCOPED_CSS.trim());
    expect(css).toContain('/*# sourceMappingURL=styles.css.map */');

    const parsed = JSON.parse(map!);
    expect(parsed.version).toBe(3);
    expect(parsed.sources).toEqual(['styles.css']);
    expect(parsed.mappings.length).toBeGreaterThan(0);
  });

  test('CSS with no upstream map is emitted byte-for-byte, with no .map', async () => {
    // rollup synthesizes an identity map for any plugin-loaded module, which
    // must not be mistaken for a real upstream map
    const { output, warnings } = await build({
      modules: { ...DEFAULT_MODULES, [CSS_ID]: SCOPED_CSS },
    });
    expect(findAsset(output, 'styles.css')).toBe(SCOPED_CSS);
    expect(findAsset(output, 'styles.css.map')).toBeUndefined();
    expect(brokenSourcemapWarnings(warnings)).toEqual([]);
  });

  test('output sourcemap settings control the emitted map', async () => {
    // sourcemap: false suppresses both the .map and the annotation
    let { output } = await build({ sourcemap: false });
    expect(findAsset(output, 'styles.css')).toBe(SCOPED_CSS);
    expect(findAsset(output, 'styles.css.map')).toBeUndefined();

    // sourcemap: 'inline' embeds the map instead of emitting a file
    ({ output } = await build({ sourcemap: 'inline' }));
    expect(findAsset(output, 'styles.css')).toContain(
      'sourceMappingURL=data:application/json;charset=utf-8;base64,'
    );
    expect(findAsset(output, 'styles.css.map')).toBeUndefined();

    // sourcemap: 'hidden' emits the .map but not the annotation
    ({ output } = await build({ sourcemap: 'hidden' }));
    expect(findAsset(output, 'styles.css')).toBe(SCOPED_CSS);
    expect(findAsset(output, 'styles.css.map')).toBeTruthy();
  });

  test('absolute paths in `sources` are rebased relative to the emitted map', async () => {
    const { output } = await build({
      modules: {
        ...DEFAULT_MODULES,
        [CSS_ID]: { code: SCOPED_CSS, map: mapFor(CSS_ID) },
      },
    });
    const parsed = JSON.parse(findAsset(output, 'styles.css.map')!);
    expect(parsed.sources).toEqual(['styles.css']);
  });

  test('keeps the JS chunk source map accurate across the injected imports', async () => {
    const { output } = await build();

    const chunk = output.find((o) => o.type === 'chunk');
    expect(chunk, 'a JS chunk was emitted').toBeTruthy();
    if (chunk?.type !== 'chunk') return;

    // the kept asset's import is hoisted back in
    expect(chunk.code).toContain('import "./styles.css"');
    expect(chunk.map).toBeTruthy();

    // ...and the map is still *accurate* after that injection. `console.log`
    // is on line 2 of the entry; prepending the import must not knock its
    // mapping off — it should still trace back to line 2 of the original.
    const tracer = new TraceMap(chunk.map as unknown as EncodedSourceMap);
    const original = originalPositionFor(
      tracer,
      generatedPositionOf(chunk.code, 'console.log')
    );
    expect(original.source?.endsWith('entry.js')).toBe(true);
    expect(original.line).toBe(2);
    expect(original.column).toBe(0);
  });

  test('non-CSS assets are left untouched (no map, no annotation)', async () => {
    // appending a `sourceMappingURL` comment to an arbitrary asset would
    // corrupt it; it must be emitted verbatim
    const { output, warnings } = await build({
      modules: {
        [ENTRY_ID]: `import value from "./custom.xyz";\nexport default value;\n`,
        [`${FROM}/custom.xyz`]: 'Custom Content',
      },
      include: ['**/*.xyz'],
      exports: 'default',
    });
    expect(findAsset(output, 'custom.xyz')).toBe('Custom Content');
    expect(
      findAsset(output, 'custom.xyz.map'),
      'no .map for a non-CSS asset'
    ).toBeUndefined();
    expect(brokenSourcemapWarnings(warnings)).toEqual([]);
  });

  test('dropping a real upstream map on an unannotatable asset stays loud', async () => {
    const { output, warnings } = await build({
      modules: {
        [ENTRY_ID]: `import "./custom.xyz";\n`,
        [`${FROM}/custom.xyz`]: {
          code: 'Custom Content',
          map: mapFor('custom.xyz'),
        },
      },
      include: ['**/*.xyz'],
    });
    // there is no comment syntax for .xyz, so the asset stays verbatim...
    expect(findAsset(output, 'custom.xyz')).toBe('Custom Content');
    expect(findAsset(output, 'custom.xyz.map')).toBeUndefined();
    // ...and the dropped map surfaces as rollup's usual warning instead of
    // being silently suppressed
    expect(brokenSourcemapWarnings(warnings).length).toBeGreaterThan(0);
  });

  test('binary assets are emitted without a spurious .map', async () => {
    // keep-assets' own load hook reads the bytes off disk, so this needs a
    // real file on disk.
    const dir = mkdtempSync(join(tmpdir(), 'keep-assets-'));
    const pngId = join(dir, 'logo.png');
    const entryId = join(dir, 'entry.js');
    writeFileSync(pngId, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));
    writeFileSync(entryId, `import "./logo.png";\n`);

    const warnings: RollupLog[] = [];
    const bundle = await rollup({
      input: entryId,
      onwarn: (w) => warnings.push(w),
      plugins: [keepAssets({ from: dir, include: ['**/*.png'] })],
    });
    try {
      const { output } = await bundle.generate({
        format: 'es',
        sourcemap: true,
      });
      expect(
        findAsset(output, 'logo.png.map'),
        'no spurious .map for a binary asset'
      ).toBeUndefined();
    } finally {
      await bundle.close();
    }
    expect(brokenSourcemapWarnings(warnings)).toEqual([]);
  });
});
