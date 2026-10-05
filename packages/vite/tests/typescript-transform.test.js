/* eslint-disable-next-line import/no-extraneous-dependencies */
import { describe, expect, it } from 'vitest';
/* eslint-disable-next-line import/no-extraneous-dependencies */
import { resolveConfig } from 'vite';
import { typescriptTransform } from '../src/typescript-transform';

function runHook(config, { rolldown }) {
  const { config: hook } = typescriptTransform();
  const context = { meta: rolldown ? { rolldownVersion: '1.0.0' } : {} };
  hook.handler.call(context, config, { command: 'serve', mode: 'development' });
  return config;
}

// What Vitest's own `vitest:config` plugin does (enforce: 'pre', no hook order).
const vitestLikePlugin = {
  name: 'vitest-like-config',
  enforce: 'pre',
  config(config) {
    if (config.oxc !== false) {
      config.oxc ??= {};
      config.oxc.target ??= 'node22';
    }
  },
};

describe('typescriptTransform', () => {
  it('runs before plugins without a hook order', () => {
    expect(typescriptTransform().config.order).toBe('pre');
  });

  it('turns oxc off with rolldown (Vite 8)', () => {
    expect(runHook({}, { rolldown: true }).oxc).toBe(false);
  });

  it('turns esbuild off before Vite 8', () => {
    expect(runHook({}, { rolldown: false }).esbuild).toBe(false);
  });

  it("keeps the app's own transform config", () => {
    expect(runHook({ oxc: { target: 'es2022' } }, { rolldown: true }).oxc).toEqual({ target: 'es2022' });
    expect(runHook({ esbuild: { target: 'es2022' } }, { rolldown: false }).esbuild).toEqual({
      target: 'es2022',
    });
  });

  it('is not undone by a plugin that configures oxc, such as Vitest', async () => {
    const resolved = await resolveConfig(
      { configFile: false, logLevel: 'silent', plugins: [vitestLikePlugin, typescriptTransform()] },
      'serve'
    );

    expect(resolved.oxc).toBe(false);
  });
});
