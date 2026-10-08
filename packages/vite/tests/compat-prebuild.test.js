import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

// `emberBuild` resolves ember-cli relative to cwd, which is not installed for this package,
// and forks a real long running build. Both are stubbed so the test can drive the plugin's
// lifecycle directly.
vi.mock('child_process', () => ({ fork: vi.fn() }));

vi.mock('node:module', async importOriginal => {
  return {
    ...(await importOriginal()),
    createRequire: () => ({ resolve: () => '/fake/node_modules/ember-cli/lib/cli/index.js' }),
  };
});

const { fork } = await import('child_process');
const { compatPrebuild } = await import('../src/build');

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

// The watch branch resolves once the forked build reports success on stdout.
function reportBuildSuccessful(child) {
  child.emit('spawn');
  child.stdout.emit('data', 'Build successful (1234ms)');
}

async function startServer(plugin, child) {
  plugin.config({}, { command: 'serve', mode: 'development' });
  const started = plugin.options();
  reportBuildSuccessful(child);
  await started;
}

describe('compatPrebuild', () => {
  beforeEach(() => {
    fork.mockReset();
  });

  it('terminates the prebuild watcher when the dev server closes', async () => {
    const child = fakeChild();
    fork.mockReturnValue(child);
    const plugin = compatPrebuild();

    await startServer(plugin, child);
    plugin.closeBundle();

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  // Vite discards the plugin instance and builds a new one on restart. Before this fix the
  // old watcher was never referenced again, so every restart orphaned one.
  it('does not leave the previous watcher running across a dev server restart', async () => {
    const first = fakeChild();
    fork.mockReturnValue(first);
    const firstPlugin = compatPrebuild();
    await startServer(firstPlugin, first);

    firstPlugin.closeBundle();

    const second = fakeChild();
    fork.mockReturnValue(second);
    const secondPlugin = compatPrebuild();
    await startServer(secondPlugin, second);

    expect(first.kill).toHaveBeenCalledWith('SIGTERM');
    expect(second.kill).not.toHaveBeenCalled();
  });

  it('kills nothing after a production build, which forks no watcher', async () => {
    const child = fakeChild();
    fork.mockReturnValue(child);
    const plugin = compatPrebuild();

    plugin.config({}, { command: 'build', mode: 'production' });
    const built = plugin.options();
    child.emit('exit', 0);
    await built;

    plugin.closeBundle();

    expect(child.kill).not.toHaveBeenCalled();
  });
});
