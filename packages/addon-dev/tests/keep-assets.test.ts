import { describe, test, expect } from 'vitest';
import { rollup } from 'rollup';
import type { Plugin, RollupLog } from 'rollup';
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
const CSS_ID = '/proj/src/styles.css';
const ENTRY_ID = '/proj/src/entry.js';

const SCOPED_CSS = '.foo_scoped { color: red; }\n';

// Stands in for a plugin (like ember-scoped-css) that loads/rewrites the CSS
// and hands rollup a `{ code, map }` from its load hook.
function upstream(): Plugin {
  return {
    name: 'test-upstream',
    resolveId(id) {
      if (id === 'entry') return ENTRY_ID;
      if (id === './styles.css') return CSS_ID;
      return undefined;
    },
    load(id) {
      if (id === ENTRY_ID) {
        return `import "./styles.css";\nconsole.log("from entry");\n`;
      }
      if (id === CSS_ID) {
        return {
          code: SCOPED_CSS,
          map: {
            version: 3,
            sources: ['styles.css'],
            sourcesContent: ['.foo { color: red; }\n'],
            names: [],
            // maps the start of the output back to the start of the source
            mappings: 'AAAA',
          },
        };
      }
      return undefined;
    },
  };
}

async function build() {
  const warnings: RollupLog[] = [];
  const bundle = await rollup({
    input: 'entry',
    onwarn(warning) {
      warnings.push(warning);
    },
    plugins: [upstream(), keepAssets({ from: FROM, include: ['**/*.css'] })],
  });
  const { output } = await bundle.generate({ format: 'es', sourcemap: true });
  await bundle.close();
  return { output, warnings };
}

describe('keep-assets source maps', () => {
  test('does not warn that sourcemaps are broken', async () => {
    const { warnings } = await build();
    const broken = warnings.filter((w) => w.code === 'SOURCEMAP_BROKEN');
    expect(broken).toEqual([]);
  });

  test('emits a companion .map for the kept CSS asset and links it', async () => {
    const { output } = await build();

    const css = output.find(
      (o) => o.type === 'asset' && o.fileName === 'styles.css'
    );
    const map = output.find(
      (o) => o.type === 'asset' && o.fileName === 'styles.css.map'
    );

    expect(css, 'the CSS asset was emitted').toBeTruthy();
    expect(map, 'a companion styles.css.map asset was emitted').toBeTruthy();

    const cssSource = css!.type === 'asset' ? String(css!.source) : '';
    expect(cssSource).toContain(SCOPED_CSS.trim());
    expect(cssSource).toContain('/*# sourceMappingURL=styles.css.map */');

    const parsed = JSON.parse(
      map!.type === 'asset' ? String(map!.source) : '{}'
    );
    expect(parsed.version).toBe(3);
    expect(parsed.sources.some((s: string) => s.endsWith('styles.css'))).toBe(
      true
    );
    expect(parsed.mappings.length).toBeGreaterThan(0);
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
    // A plugin-provided text asset gets a synthesized identity map from rollup,
    // but it is not CSS — appending a `sourceMappingURL` comment would corrupt
    // it (e.g. an arbitrary `.xyz` asset that the consuming build then can't
    // parse). It must be emitted verbatim.
    const XYZ_ID = '/proj/src/custom.xyz';
    const E_ID = '/proj/src/entry.js';

    const warnings: RollupLog[] = [];
    const bundle = await rollup({
      input: 'entry',
      onwarn: (w) => warnings.push(w),
      plugins: [
        {
          name: 'custom',
          resolveId(id) {
            if (id === 'entry') return E_ID;
            if (id === './custom.xyz') return XYZ_ID;
            return undefined;
          },
          load(id) {
            if (id === E_ID)
              return `import value from "./custom.xyz";\nexport default value;\n`;
            if (id === XYZ_ID) return 'Custom Content';
            return undefined;
          },
        } satisfies Plugin,
        keepAssets({ from: FROM, include: ['**/*.xyz'], exports: 'default' }),
      ],
    });
    const { output } = await bundle.generate({ format: 'es', sourcemap: true });
    await bundle.close();

    const xyz = output.find(
      (o) => o.type === 'asset' && o.fileName === 'custom.xyz'
    );
    expect(xyz, 'the .xyz asset was emitted').toBeTruthy();
    expect(xyz!.type === 'asset' ? String(xyz!.source) : '').toBe(
      'Custom Content'
    );
    expect(
      output.find((o) => o.fileName === 'custom.xyz.map'),
      'no .map for a non-CSS asset'
    ).toBeFalsy();
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
      const map = output.find(
        (o) => o.type === 'asset' && o.fileName === 'logo.png.map'
      );
      expect(map, 'no spurious .map for a binary asset').toBeFalsy();
    } finally {
      await bundle.close();
    }
    expect(warnings.filter((w) => w.code === 'SOURCEMAP_BROKEN')).toEqual([]);
  });
});
