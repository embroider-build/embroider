import { describe, expect, it, vi } from 'vitest';
import { rolldown } from 'rolldown';
import { babel } from '@rollup/plugin-babel';
import { join } from 'path';
import { ember, extensions } from '../src/ember';

// `ember()` creates a resolver, which needs an Embroider app. These tests don't use it.
vi.mock('@embroider/core', async importOriginal => {
  const actual = await importOriginal();
  class ResolverLoader {}
  return { ...actual, default: { ...actual, ResolverLoader }, ResolverLoader };
});

// The plugins `ember()` shares with optimizeDeps when the app configures Babel
// the way the app and addon blueprints do, with `extensions`.
async function optimizeDepsPlugins(babelPlugins = []) {
  const config = {
    plugins: [babel({ babelHelpers: 'bundled', babelrc: false, configFile: false, extensions, plugins: babelPlugins })],
  };
  const { config: hook } = ember().find(plugin => plugin.name === 'vite-plugin-ember-config');
  await hook.call({ meta: { rolldownVersion: '1.0.0' } }, config, { command: 'serve', mode: 'development' });
  return config.optimizeDeps.rolldownOptions.plugins;
}

async function prebundle(plugins) {
  const build = await rolldown({
    input: join(__dirname, 'fixtures', 'json-dependency', 'index.js'),
    plugins,
    logLevel: 'silent',
  });
  const { output } = await build.generate({ format: 'esm' });
  return output[0].code;
}

function markRun() {
  return {
    visitor: {
      StringLiteral(path) {
        if (path.node.value === 'not run') path.node.value = 'run';
      },
    },
  };
}

describe('plugins shared with optimizeDeps', () => {
  it('prebundle a dependency that requires JSON', async () => {
    const code = await prebundle(await optimizeDepsPlugins());

    expect(code).toContain('list-item');
    expect(code).toContain('map-value');
  });

  it("still run Babel on the dependency's JS", async () => {
    const code = await prebundle(await optimizeDepsPlugins([markRun]));

    expect(code).toMatch(/babel: "run"/);
  });
});
