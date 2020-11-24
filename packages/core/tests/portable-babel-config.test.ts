import { PluginItem, TransformOptions } from '@babel/core';
import { makePortable } from '../src/portable-babel-config';
import { join, sep, resolve } from 'path';
import exampleTarget from './example-target';
import { Portable, protocol } from '../src/portable';

function resolvableNames(...names: string[]) {
  return {
    resolve(name: string) {
      if (name.startsWith('/')) {
        return name;
      }
      if (name.startsWith('.')) {
        return join('/notional-base-dir', name);
      }
      if (names.includes(name)) {
        return join('/notional-base-dir/node_modules', name, 'index.js');
      }
      let e = new Error(`stub resolver failure for ${name}`);
      (e as any).code = 'MODULE_NOT_FOUND';
      throw e;
    },
  };
}

function loadParallelSafe({ config, isParallelSafe }: { config: TransformOptions; isParallelSafe: boolean }): any {
  if (!isParallelSafe) {
    throw new Error(`not parallel safe`);
  }
  delete (global as any)[protocol];
  return load({ config });
}

function load({ config }: { config: TransformOptions }): any {
  return JSON.parse(JSON.stringify(config));
}

function assertPortableBabelLauncher(plugin: PluginItem): { module: any; arg: any } {
  if (!Array.isArray(plugin)) {
    throw new Error(`expected array plugin not ${plugin}`);
  }
  expect(plugin[0]).toBe(resolve(__dirname, '../src/portable-babel-launcher.js'));
  return new Portable().hydrate(plugin[1]);
}

describe('portable-babel-config', () => {
  test('absolute path', () => {
    let config = makePortable(
      {
        plugins: ['/path/to/some/plugin.js'],
      },
      resolvableNames(),
      []
    );
    expect(loadParallelSafe(config).plugins).toEqual(['/path/to/some/plugin.js']);
  });

  test('local path', () => {
    let config = makePortable(
      {
        plugins: ['./path/to/some/plugin.js'],
      },
      resolvableNames(),
      []
    );
    expect(loadParallelSafe(config).plugins).toEqual([
      '/notional-base-dir/path/to/some/plugin.js'.split('/').join(sep),
    ]);
  });

  test('package name', () => {
    let config = makePortable(
      {
        plugins: ['my-package'],
      },
      resolvableNames('my-package'),
      []
    );
    expect(loadParallelSafe(config).plugins).toEqual([
      '/notional-base-dir/node_modules/my-package/index.js'.split('/').join(sep),
    ]);
  });

  test('package name shorthand', () => {
    let config = makePortable(
      {
        plugins: ['my-package'],
      },
      resolvableNames('babel-plugin-my-package'),
      []
    );
    expect(loadParallelSafe(config).plugins).toEqual([
      '/notional-base-dir/node_modules/babel-plugin-my-package/index.js'.split('/').join(sep),
    ]);
  });

  test('namespaced package name', () => {
    let config = makePortable(
      {
        plugins: ['@me/my-package'],
      },
      resolvableNames('@me/my-package'),
      []
    );
    expect(loadParallelSafe(config).plugins).toEqual([
      '/notional-base-dir/node_modules/@me/my-package/index.js'.split('/').join(sep),
    ]);
  });

  test('namespaced package name shorthand', () => {
    let config = makePortable(
      {
        plugins: ['@me/my-package'],
      },
      resolvableNames('@me/babel-plugin-my-package'),
      []
    );
    expect(loadParallelSafe(config).plugins).toEqual([
      '/notional-base-dir/node_modules/@me/babel-plugin-my-package/index.js'.split('/').join(sep),
    ]);
  });

  test('resolves name with json-safe config', () => {
    let config = makePortable(
      {
        plugins: [['my-package', { theOptions: 'cool' }]],
      },
      resolvableNames('babel-plugin-my-package'),
      []
    );
    expect(loadParallelSafe(config).plugins).toEqual([
      ['/notional-base-dir/node_modules/babel-plugin-my-package/index.js'.split('/').join(sep), { theOptions: 'cool' }],
    ]);
  });

  test('resolves name with arbitrary config', () => {
    let options = {
      precompile() {
        return 'cool';
      },
    };
    let config = makePortable(
      {
        plugins: [['my-package', options]],
      },
      resolvableNames('babel-plugin-my-package'),
      []
    );
    expect(config.isParallelSafe).toBeFalsy();
    let { module, arg } = assertPortableBabelLauncher(load(config).plugins[0]);
    expect(module).toBe('/notional-base-dir/node_modules/babel-plugin-my-package/index.js');
    expect(arg).toEqual(options);
  });

  test('passes through bare function', () => {
    let func = function () {};
    let config = makePortable(
      {
        plugins: [func],
      },
      resolvableNames(),
      []
    );
    expect(config.isParallelSafe).toBeFalsy();
    let { module } = assertPortableBabelLauncher(load(config).plugins[0]);
    expect(module).toBe(func);
  });

  test('passes through function with args', () => {
    let func = function () {};
    let args = { theArgs: 'here' };
    let config = makePortable(
      {
        plugins: [[func, args]],
      },
      resolvableNames(),
      []
    );
    expect(config.isParallelSafe).toBeFalsy();
    let { module, arg } = assertPortableBabelLauncher(load(config).plugins[0]);
    expect(module).toBe(func);
    expect(arg).toEqual(args);
  });

  test('respects _parallelBabel api with buildUsing on PluginTarget', () => {
    (exampleFunction as any)._parallelBabel = {
      requireFile: __filename,
      buildUsing: 'exampleFunction',
      params: {
        theParams: 'are here',
      },
    };
    let config = makePortable(
      {
        plugins: [exampleFunction],
      },
      resolvableNames(),
      []
    );
    expect(config.isParallelSafe).toBeTruthy();
    let { module } = assertPortableBabelLauncher(load(config).plugins[0]);
    expect(module).toEqual('this is the example function with theParams=are here');
  });

  test('respects _parallelBabel api with useMethod on PluginTarget', () => {
    (exampleFunction as any)._parallelBabel = {
      requireFile: __filename,
      useMethod: 'exampleFunction',
    };
    let config = makePortable(
      {
        plugins: [exampleFunction],
      },
      resolvableNames(),
      []
    );
    expect(config.isParallelSafe).toBeTruthy();
    let { module } = assertPortableBabelLauncher(load(config).plugins[0]);
    expect(module).toBe(exampleFunction);
  });

  test('respects _parallelBabel api with with only requireFile on PluginTarget', () => {
    (exampleTarget as any)._parallelBabel = {
      requireFile: resolve(__dirname, 'example-target.js'),
    };
    let config = makePortable(
      {
        plugins: [[exampleTarget, 'hi']],
      },
      resolvableNames(),
      []
    );
    expect(config.isParallelSafe).toBeTruthy();
    let output = loadParallelSafe(config);
    let { module, arg } = assertPortableBabelLauncher(output.plugins[0]);
    expect(module).toEqual(exampleTarget);
    expect(arg).toEqual('hi');
  });

  test('respects _parallelBabel api on PluginOptions', () => {
    function precompile() {}
    precompile._parallelBabel = {
      requireFile: __filename,
      buildUsing: 'exampleFunction',
      params: { theParams: 'reconstituted precompile' },
    };

    let config = makePortable(
      {
        plugins: [['my-plugin', { precompile }]],
      },
      resolvableNames('my-plugin'),
      []
    );
    expect(config.isParallelSafe).toBeTruthy();
    let output = loadParallelSafe(config);
    let { module, arg } = assertPortableBabelLauncher(output.plugins[0]);
    expect(module).toEqual('/notional-base-dir/node_modules/my-plugin/index.js');
    expect(arg).toEqual({ precompile: 'this is the example function with theParams=reconstituted precompile' });
  });

  test('undefined is a serializable value', function () {
    let config = makePortable(
      {
        plugins: ['./x', { value: undefined }],
      },
      resolvableNames(),
      []
    );
    expect(config.isParallelSafe).toBeTruthy();
    let output = loadParallelSafe(config);
    expect(output.plugins[0][1].value).toBeUndefined();
  });
});

export function exampleFunction(params: any) {
  if (params) {
    return `this is the example function with theParams=${params.theParams}`;
  } else {
    return `this is the example function with no params`;
  }
}

export function examplePlugin(_babel: any, params: any) {
  if (params) {
    return `this is the example plugin with params=${params}`;
  } else {
    return `this is the example plugin with no params`;
  }
}
