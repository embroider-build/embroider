/* eslint-disable-next-line import/no-extraneous-dependencies */
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ember } from '../src/ember';

// Provide synthetic default export for @embroider/core so resolver plugins bundled in ember() can run under Vitest CJS/ESM interop
vi.mock('@embroider/core', async importOriginal => {
  const orig = await importOriginal();
  return { ...orig, default: orig };
});

describe('vite-plugin-ember-config', () => {
  async function runConfigHook(config = {}) {
    const plugin = ember().find(p => p.name === 'vite-plugin-ember-config');
    await plugin.config(config, { command: 'serve', mode: 'development' });
    return config;
  }

  describe('server.port', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'embroider-ember-config-test-'));
    });

    afterEach(() => {
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('defaults to 4200', async () => {
      const config = await runConfigHook({ root: tempDir });
      expect(config.server.port).toBe(4200);
    });

    it('reads custom port defined in .ember-cli', async () => {
      writeFileSync(
        join(tempDir, '.ember-cli'),
        `{
          /** validate that block comments in .ember-cli are not an issue. */
          "disableAnalytics": false,
          // validate line comments are not an issue.
          "port": 5700
        }`
      );
      const config = await runConfigHook({ root: tempDir });
      expect(config.server.port).toBe(5700);
    });
  });
});
