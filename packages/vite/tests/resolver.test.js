/* eslint-disable-next-line import/no-extraneous-dependencies */
import { describe, it, expect, vi } from 'vitest';
/* eslint-disable-next-line import/no-extraneous-dependencies */
import { createServer, createLogger } from 'vite';
import { ember } from '../src/ember';
import { resolver } from '../src/resolver';

vi.mock('@embroider/core', async importOriginal => {
  const actual = await importOriginal();
  class FakeResolverLoader {
    get resolver() {
      return {
        options: {
          appRoot: process.cwd(),
          engines: [],
        },
        packageCache: {},
        async resolve(request) {
          return request.virtualize({
            type: 'vendor-js',
            specifier: request.specifier,
          }).resolvedTo;
        },
      };
    }
  }
  return {
    ...actual,
    default: {
      ...actual,
      ResolverLoader: FakeResolverLoader,
      virtualContent: () => ({ src: '', watches: [] }),
    },
    ResolverLoader: FakeResolverLoader,
    virtualContent: () => ({ src: '', watches: [] }),
  };
});

describe('embroider-resolver plugin', () => {
  it('does not call emitFile during serve mode when the dev server closes', async () => {
    const warnings = [];
    const customLogger = createLogger('warn');
    customLogger.warn = msg => {
      warnings.push(msg);
    };

    const server = await createServer({
      configFile: false,
      customLogger,
      server: {
        middlewareMode: true,
        watch: null,
      },
      optimizeDeps: {
        noDiscovery: true,
      },
      plugins: [ember()],
    });

    await server.close();

    expect(warnings.filter(w => w.includes('emitFile() is not supported in serve mode'))).toEqual([]);
  });

  it('does not call emitFile in buildEnd when configResolved has not run', async () => {
    const plugin = resolver({ rolldown: true });
    const emitFile = vi.fn();

    await plugin.buildEnd.call({ emitFile });

    expect(emitFile).not.toHaveBeenCalled();
  });

  it('emits and awaits virtual files during build mode', async () => {
    const plugin = resolver();
    const emitted = [];

    plugin.configResolved({
      command: 'build',
      mode: 'development',
      cacheDir: '/tmp/vite-cache',
    });

    await plugin.buildEnd.call({
      emitFile(file) {
        emitted.push(file.name);
        return 'ref-id';
      },
    });

    expect(emitted).toEqual([
      'embroider-virtual-vendor.js',
      'embroider-virtual-vendor.css',
      'embroider-virtual-test-support.js',
      'embroider-virtual-test-support.css',
    ]);
  });

  it('emits only vendor virtual files during production build mode', async () => {
    const plugin = resolver();
    const emitted = [];

    plugin.configResolved({
      command: 'build',
      mode: 'production',
      cacheDir: '/tmp/vite-cache',
    });

    await plugin.buildEnd.call({
      emitFile(file) {
        emitted.push(file.name);
        return 'ref-id';
      },
    });

    expect(emitted).toEqual(['embroider-virtual-vendor.js', 'embroider-virtual-vendor.css']);
  });
});
