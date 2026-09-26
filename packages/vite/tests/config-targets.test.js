/* eslint-disable-next-line import/no-extraneous-dependencies */
import { it, expect, describe, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { configTargets } from '../src/config-targets';

describe('Vite plugin configTargets', () => {
  let dirs = [];

  const project = files => {
    // inside the package so vitest can load config/targets.js through vite
    const dir = mkdtempSync(join(__dirname, 'fixtures', 'config-targets-'));
    dirs.push(dir);
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(join(dir, name, '..'), { recursive: true });
      writeFileSync(join(dir, name), content);
    }
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    return dir;
  };

  const run = () => configTargets().config();

  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs = [];
  });

  it('leaves the Vite default target alone when no targets are configured', async () => {
    project({ 'package.json': JSON.stringify({ name: 'app' }) });

    expect(await run()).toBeUndefined();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('uses the browserslist key in package.json', async () => {
    project({ 'package.json': JSON.stringify({ name: 'app', browserslist: ['firefox 110'] }) });

    expect(await run()).toEqual({ build: { target: ['firefox110'] } });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('uses .browserslistrc', async () => {
    project({
      'package.json': JSON.stringify({ name: 'app' }),
      '.browserslistrc': 'safari 17\n',
    });

    expect(await run()).toEqual({ build: { target: ['safari17'] } });
  });

  it('uses config/targets.js and suggests moving to browserslist', async () => {
    project({
      'package.json': JSON.stringify({ name: 'app' }),
      'config/targets.js': `'use strict';\nconst browsers = ['chrome 100'];\nmodule.exports = { browsers };\n`,
    });

    expect(await run()).toEqual({ build: { target: ['chrome100'] } });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('config/targets.js is no longer the recommended way to set browser targets.')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('to the "browserslist" key in package.json, then delete config/targets.js.')
    );
  });

  it('prefers config/targets.js over browserslist and warns when both are present', async () => {
    project({
      'package.json': JSON.stringify({ name: 'app', browserslist: ['firefox 110'] }),
      'config/targets.js': `'use strict';\nconst browsers = ['chrome 100'];\nmodule.exports = { browsers };\n`,
    });

    expect(await run()).toEqual({ build: { target: ['chrome100'] } });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('WARNING'));
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Browser targets are defined in both config/targets.js and your browserslist config.')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('to the "browserslist" key in package.json, then delete config/targets.js.')
    );
  });

  it('falls back to browserslist when config/targets.js has no browsers', async () => {
    project({
      'package.json': JSON.stringify({ name: 'app', browserslist: ['firefox 110'] }),
      'config/targets.js': `'use strict';\nmodule.exports = {};\n`,
    });

    expect(await run()).toEqual({ build: { target: ['firefox110'] } });
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
