import { describe, test, expect, vi } from 'vitest';
import { rollup } from 'rollup';
import type { LoadResult, OutputAsset, OutputChunk, Plugin } from 'rollup';
import type * as Path from 'path';

import keepAssets from '../src/rollup-keep-assets';

// Make keep-assets see Windows path semantics no matter which OS runs the
// suite. This lives in its own file because the mock is file-wide. It only
// reaches modules that vitest transforms (our src); rollup and minimatch
// keep using the real `path`.
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof Path>();
  return { ...actual.win32, default: actual.win32 };
});

const FROM = 'C:\\proj\\src';
const ENTRY_ID = 'C:\\proj\\src\\components\\entry.js';
const CSS_ID = 'C:\\proj\\src\\css\\styles.css';

const CSS = '.foo { color: red; }\n';

// stands in for upstream plugins that resolve and load modules, producing the
// kind of ids rollup has on Windows
function stubModules(modules: Record<string, string>): Plugin {
  return {
    name: 'test-upstream',
    resolveId(id) {
      if (id === 'entry') return ENTRY_ID;
      if (id === '../css/styles.css') return CSS_ID;
      return undefined;
    },
    load(id) {
      return modules[id] as LoadResult;
    },
  };
}

async function build({
  entry,
  exports,
}: {
  entry: string;
  exports?: undefined | 'default' | '*';
}) {
  const bundle = await rollup({
    input: { 'components/entry': 'entry' },
    plugins: [
      stubModules({ [ENTRY_ID]: entry, [CSS_ID]: CSS }),
      keepAssets({ from: FROM, include: ['**/*.css'], exports }),
    ],
  });
  try {
    const { output } = await bundle.generate({
      format: 'es',
      entryFileNames: '[name].js',
    });
    return {
      chunk: output.find((o): o is OutputChunk => o.type === 'chunk')!,
      assets: output.filter((o): o is OutputAsset => o.type === 'asset'),
    };
  } finally {
    await bundle.close();
  }
}

function firstLine(code: string) {
  return code.split('\n')[0];
}

describe('keep-assets with Windows paths', () => {
  test('side-effect import of an asset in a sibling directory uses forward slashes', async () => {
    const { chunk } = await build({
      entry: `import "../css/styles.css";\nconsole.log("from entry");\n`,
    });
    expect(firstLine(chunk.code)).toBe(`import "./../css/styles.css"`);
  });

  test('default import of an asset in a sibling directory uses forward slashes', async () => {
    const { chunk } = await build({
      entry: `import value from "../css/styles.css";\nexport default value;\n`,
      exports: 'default',
    });
    expect(firstLine(chunk.code)).toBe(
      `import _asset_0_ from "./../css/styles.css"`
    );
  });

  test('emitted asset fileName uses forward slashes', async () => {
    const { assets } = await build({
      entry: `import "../css/styles.css";\nconsole.log("from entry");\n`,
    });
    expect(assets.map((a) => a.fileName)).toEqual(['css/styles.css']);
  });
});
