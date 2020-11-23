import { TransformOptions } from '@babel/core';
import { makePortable } from '../src/portable-babel-config';
import { protocol } from '../src/portable-plugin-config';
import { join, sep } from 'path';

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

function runParallelSafe({ config, isParallelSafe }: { config: TransformOptions; isParallelSafe: boolean }): any {
  if (!isParallelSafe) {
    throw new Error(`not parallel safe`);
  }
  delete (global as any)[protocol];
  return run({ config });
}

function run({ config }: { config: TransformOptions }): any {
  return JSON.parse(JSON.stringify(config));
}

describe('portable-babel-config', () => {
  test('absolute path', () => {
    let config = makePortable(
      {
        plugins: ['/path/to/some/plugin.js'],
      },
      resolvableNames()
    );
    expect(runParallelSafe(config).plugins).toEqual(['/path/to/some/plugin.js']);
  });

  test('local path', () => {
    let config = makePortable(
      {
        plugins: ['./path/to/some/plugin.js'],
      },
      resolvableNames()
    );
    expect(runParallelSafe(config).plugins).toEqual(['/notional-base-dir/path/to/some/plugin.js'.split('/').join(sep)]);
  });

  test('package name', () => {
    let config = makePortable(
      {
        plugins: ['my-package'],
      },
      resolvableNames('my-package')
    );
    expect(runParallelSafe(config).plugins).toEqual([
      '/notional-base-dir/node_modules/my-package/index.js'.split('/').join(sep),
    ]);
  });

  test('package name shorthand', () => {
    let config = makePortable(
      {
        plugins: ['my-package'],
      },
      resolvableNames('babel-plugin-my-package')
    );
    expect(runParallelSafe(config).plugins).toEqual([
      '/notional-base-dir/node_modules/babel-plugin-my-package/index.js'.split('/').join(sep),
    ]);
  });

  test('namespaced package name', () => {
    let config = makePortable(
      {
        plugins: ['@me/my-package'],
      },
      resolvableNames('@me/my-package')
    );
    expect(runParallelSafe(config).plugins).toEqual([
      '/notional-base-dir/node_modules/@me/my-package/index.js'.split('/').join(sep),
    ]);
  });

  test('namespaced package name shorthand', () => {
    let config = makePortable(
      {
        plugins: ['@me/my-package'],
      },
      resolvableNames('@me/babel-plugin-my-package')
    );
    expect(runParallelSafe(config).plugins).toEqual([
      '/notional-base-dir/node_modules/@me/babel-plugin-my-package/index.js'.split('/').join(sep),
    ]);
  });

  test('resolves name with json-safe config', () => {
    let config = makePortable(
      {
        plugins: [['my-package', { theOptions: 'cool' }]],
      },
      resolvableNames('babel-plugin-my-package')
    );
    expect(runParallelSafe(config).plugins).toEqual([
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
      resolvableNames('babel-plugin-my-package')
    );
    expect(config.isParallelSafe).toBeFalsy();
    expect(run(config).plugins).toEqual([
      ['/notional-base-dir/node_modules/babel-plugin-my-package/index.js'.split('/').join(sep), options],
    ]);
  });

  test('passes through bare function', () => {
    let func = function () {};
    let config = makePortable(
      {
        plugins: [func],
      },
      resolvableNames()
    );
    expect(config.isParallelSafe).toBeFalsy();
    expect(run(config).plugins).toEqual([func]);
  });

  test('passes through function with args', () => {
    let func = function () {};
    let args = { theArgs: 'here' };
    let config = makePortable(
      {
        plugins: [[func, args]],
      },
      resolvableNames()
    );
    expect(config.isParallelSafe).toBeFalsy();
    expect(run(config).plugins).toEqual([[func, args]]);
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
      resolvableNames()
    );
    expect(config.isParallelSafe).toBeTruthy();
    let output = runParallelSafe(config);
    expect(output.plugins[0]).toBe('this is the example function with theParams=are here');
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
      resolvableNames()
    );
    expect(config.isParallelSafe).toBeTruthy();
    let output = runParallelSafe(config);
    expect(output.plugins[0]()).toBe('this is the example function with no params');
  });

  test('respects _parallelBabel api with with only requireFile on PluginTarget', () => {
    (exampleFunction as any)._parallelBabel = {
      requireFile: __filename,
    };
    let config = makePortable(
      {
        plugins: [exampleFunction],
      },
      resolvableNames()
    );
    expect(config.isParallelSafe).toBeTruthy();
    let output = runParallelSafe(config);
    expect(output.plugins[0].exampleFunction()).toBe('this is the example function with no params');
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
      resolvableNames('my-plugin')
    );
    expect(config.isParallelSafe).toBeTruthy();
    let output = runParallelSafe(config);
    expect(output.plugins[0][0]).toBe('/notional-base-dir/node_modules/my-plugin/index.js'.split('/').join(sep));
    expect(output.plugins[0][1]).toEqual({
      precompile: 'this is the example function with theParams=reconstituted precompile',
    });
  });

  test('undefined is a serializable value', function () {
    let config = makePortable(
      {
        plugins: ['./x', { value: undefined }],
      },
      resolvableNames()
    );
    expect(config.isParallelSafe).toBeTruthy();
    let output = runParallelSafe(config);
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
