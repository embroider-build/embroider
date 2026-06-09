/* eslint-disable-next-line import/no-extraneous-dependencies */
import { it, expect, describe, vi } from 'vitest';

// `resolver()` builds a ResolverLoader(process.cwd()), which requires a real
// embroider app at cwd. We only need the `vite-plugin-ember-config` plugin from
// ember(), so stub the resolver plugin out.
vi.mock('../src/resolver', () => ({ resolver: () => ({ name: 'stub-resolver' }) }));

import { ember } from '../src/ember';

// Regression test: ember() defaults optimizeDeps.entries to the app entry, so a
// bad import in a test file can't abort the scan and disable app pre-bundling.

function getConfigHook() {
  const plugin = ember().find(
    p => p && typeof p === 'object' && 'name' in p && p.name === 'vite-plugin-ember-config'
  );
  if (!plugin || typeof plugin.config !== 'function') {
    throw new Error('vite-plugin-ember-config config hook not found');
  }
  return plugin.config.bind(plugin);
}

// The hook mutates `config` in place and sets entries before its later
// rolldown/esbuild wiring (which needs a full Vite context); ignore a late throw.
async function runConfigHook(userConfig) {
  const hook = getConfigHook();
  const env = { command: 'serve', mode: 'development' };
  try {
    await hook.call({}, userConfig, env);
  } catch {
    // ignore – the entries default is applied before any throw
  }
  return userConfig;
}

describe('ember() optimizeDeps.entries', () => {
  it('defaults the dependency-optimizer scan to the app entry (not test HTML)', async () => {
    const config = await runConfigHook({ plugins: [] });
    expect(config.optimizeDeps?.entries).toEqual(['index.html']);
  });

  it('does not override an explicit optimizeDeps.entries', async () => {
    const config = await runConfigHook({
      plugins: [],
      optimizeDeps: { entries: ['index.html', 'app/**/*.{ts,js,gts,gjs}'] },
    });
    expect(config.optimizeDeps?.entries).toEqual(['index.html', 'app/**/*.{ts,js,gts,gjs}']);
  });
});
