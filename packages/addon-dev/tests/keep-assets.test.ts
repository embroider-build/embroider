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

const CSS = '.foo { color: red; }\n';

// stands in for upstream plugins that load modules
function stubModules(modules: Record<string, string>): Plugin {
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

const DEFAULT_MODULES: Record<string, string> = {
  [ENTRY_ID]: `import "./styles.css";\nconsole.log("from entry");\n`,
  [CSS_ID]: CSS,
};

async function build({
  modules = DEFAULT_MODULES,
  include = ['**/*.css'],
  exports = undefined as undefined | 'default' | '*',
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
  const { output } = await bundle.generate({ format: 'es', sourcemap: true });
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

  test('kept CSS is emitted byte-for-byte, with no .map', async () => {
    const { output } = await build();
    expect(findAsset(output, 'styles.css')).toBe(CSS);
    expect(findAsset(output, 'styles.css.map')).toBeUndefined();
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

  test('non-CSS assets are left untouched', async () => {
    const { output, warnings } = await build({
      modules: {
        [ENTRY_ID]: `import value from "./custom.xyz";\nexport default value;\n`,
        [`${FROM}/custom.xyz`]: 'Custom Content',
      },
      include: ['**/*.xyz'],
      exports: 'default',
    });
    expect(findAsset(output, 'custom.xyz')).toBe('Custom Content');
    expect(findAsset(output, 'custom.xyz.map')).toBeUndefined();
    expect(brokenSourcemapWarnings(warnings)).toEqual([]);
  });

  test('binary assets are emitted without a spurious .map', async () => {
    // keep-assets' own load hook reads the bytes off disk, so this needs a
    // real file on disk.
    const dir = mkdtempSync(join(tmpdir(), 'keep-assets-'));
    const pngId = join(dir, 'logo.png');
    const entryId = join(dir, 'entry.js');
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    writeFileSync(pngId, bytes);
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
      const png = output.find(
        (o) => o.type === 'asset' && o.fileName === 'logo.png'
      ) as OutputAsset | undefined;
      expect(Buffer.from(png!.source as Uint8Array)).toEqual(bytes);
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
