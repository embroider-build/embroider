import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'vite';
import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import { fork } from 'child_process';

import { compatPrebuild } from '../src/build';

// The plugin forks ember-cli to build. Here it gets a fake child process instead.
vi.mock('child_process', () => {
  return {
    fork: vi.fn(),
  };
});

// The plugin locates ember-cli before forking it. Here that lookup always succeeds.
vi.mock('node:module', async importOriginal => {
  return {
    ...(await importOriginal()),
    createRequire: () => ({
      resolve: () => '/app/node_modules/ember-cli/lib/cli/index.js',
    }),
  };
});

function fakeWatchingBuild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

function reportFirstBuild(watchingBuild) {
  watchingBuild.emit('spawn');
  watchingBuild.stdout.emit('data', 'Build successful');
}

describe('@embroider/vite builder plugin', () => {
  let watchingBuild;
  let server;

  beforeEach(async () => {
    // The plugin echoes the build's output.
    vi.spyOn(console, 'log').mockImplementation(() => {});

    watchingBuild = fakeWatchingBuild();
    fork.mockImplementation(() => {
      setImmediate(() => reportFirstBuild(watchingBuild));
      return watchingBuild;
    });

    server = await createServer({
      root: resolve(__dirname, 'fixtures/scripts'),
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      optimizeDeps: { noDiscovery: true },
      plugins: [compatPrebuild()],
    });
  });

  afterEach(async () => {
    await server.close();
    vi.restoreAllMocks();
  });

  it('keeps the watching build running while the dev server is open', () => {
    expect(watchingBuild.kill).not.toHaveBeenCalled();
  });

  it('stops the watching build when the dev server closes', async () => {
    await server.close();

    expect(watchingBuild.kill).toHaveBeenCalledOnce();
  });
});
