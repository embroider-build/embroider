/* eslint-disable-next-line import/no-extraneous-dependencies */
import { it, expect, describe, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let addon;

vi.mock('@embroider/core', async importOriginal => ({
  ...(await importOriginal()),
  ResolverLoader: class {
    get resolver() {
      return {
        options: { engines: [{ activeAddons: [{ root: addon.root }] }] },
        packageCache: { ownerOfFile: () => addon },
      };
    }
  },
}));

const { assets } = await import('../src/assets');

describe('Vite plugin assets', () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'embroider-vite-assets-'));
    mkdirSync(join(root, 'public'));
    writeFileSync(join(root, 'present.txt'), 'present');
    addon = {
      name: 'my-addon',
      root,
      isV2Addon: () => true,
      meta: {
        'public-assets': {
          './present.txt': 'assets/present.txt',
          './dist/missing.txt': 'assets/missing.txt',
        },
      },
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  async function build() {
    const plugin = assets();
    plugin.configResolved({ command: 'build', publicDir: join(root, 'public') });
    const emitFile = vi.fn();
    await plugin.buildStart.handler.call({ emitFile });
    return emitFile;
  }

  it('emits the public assets an addon declares', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const emitFile = await build();

    expect(emitFile).toHaveBeenCalledTimes(1);
    expect(emitFile).toHaveBeenCalledWith(expect.objectContaining({ type: 'asset', fileName: 'assets/present.txt' }));
  });

  it('warns about and skips a declared public asset that does not exist', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const emitFile = await build();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('my-addon declares a public asset "./dist/missing.txt"'));
    expect(emitFile).not.toHaveBeenCalledWith(expect.objectContaining({ fileName: 'assets/missing.txt' }));
  });
});
