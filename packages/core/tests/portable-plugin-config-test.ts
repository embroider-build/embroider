import 'qunit';
import PortableBabelConfig from '../src/portable-babel-config';
import { join } from 'path';
const { test } = QUnit;

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

function runParallelSafe(config: PortableBabelConfig): any {
  if (!config.isParallelSafe) {
    throw new Error(`not parallel safe`);
  }
  delete (global as any).__embroider_normalize_plugin_values__;
  return run(config);
}

function run(config: PortableBabelConfig): any {
  let module = { exports: {} } as any;
  eval(config.serialize());
  return module.exports;
}

QUnit.module('portable-plugin-config', function() {
  test('absolute path', function(assert) {
    let config = new PortableBabelConfig(
      {
        plugins: ['/path/to/some/plugin.js'],
      },
      resolvableNames()
    );
    assert.deepEqual(runParallelSafe(config).plugins, ['/path/to/some/plugin.js']);
  });

  test('local path', function(assert) {
    let config = new PortableBabelConfig(
      {
        plugins: ['./path/to/some/plugin.js'],
      },
      resolvableNames()
    );
    assert.deepEqual(runParallelSafe(config).plugins, ['/notional-base-dir/path/to/some/plugin.js']);
  });

  test('package name', function(assert) {
    let config = new PortableBabelConfig(
      {
        plugins: ['my-package'],
      },
      resolvableNames('my-package')
    );
    assert.deepEqual(runParallelSafe(config).plugins, ['/notional-base-dir/node_modules/my-package/index.js']);
  });

  test('package name shorthand', function(assert) {
    let config = new PortableBabelConfig(
      {
        plugins: ['my-package'],
      },
      resolvableNames('babel-plugin-my-package')
    );
    assert.deepEqual(runParallelSafe(config).plugins, [
      '/notional-base-dir/node_modules/babel-plugin-my-package/index.js',
    ]);
  });

  test('namespaced package name', function(assert) {
    let config = new PortableBabelConfig(
      {
        plugins: ['@me/my-package'],
      },
      resolvableNames('@me/my-package')
    );
    assert.deepEqual(runParallelSafe(config).plugins, ['/notional-base-dir/node_modules/@me/my-package/index.js']);
  });

  test('namespaced package name shorthand', function(assert) {
    let config = new PortableBabelConfig(
      {
        plugins: ['@me/my-package'],
      },
      resolvableNames('@me/babel-plugin-my-package')
    );
    assert.deepEqual(runParallelSafe(config).plugins, [
      '/notional-base-dir/node_modules/@me/babel-plugin-my-package/index.js',
    ]);
  });

  test('resolves name with json-safe config', function(assert) {
    let config = new PortableBabelConfig(
      {
        plugins: [['my-package', { theOptions: 'cool' }]],
      },
      resolvableNames('babel-plugin-my-package')
    );
    assert.deepEqual(runParallelSafe(config).plugins, [
      ['/notional-base-dir/node_modules/babel-plugin-my-package/index.js', { theOptions: 'cool' }],
    ]);
  });

  test('resolves name with arbitrary config', function(assert) {
    let options = {
      precompile() {
        return 'cool';
      },
    };
    let config = new PortableBabelConfig(
      {
        plugins: [['my-package', options]],
      },
      resolvableNames('babel-plugin-my-package')
    );
    assert.ok(!config.isParallelSafe);
    assert.deepEqual(run(config).plugins, [
      ['/notional-base-dir/node_modules/babel-plugin-my-package/index.js', options],
    ]);
  });

  test('passes through bare function', function(assert) {
    let func = function() {};
    let config = new PortableBabelConfig(
      {
        plugins: [func],
      },
      resolvableNames()
    );
    assert.ok(!config.isParallelSafe);
    assert.deepEqual(run(config).plugins, [func]);
  });

  test('passes through function with args', function(assert) {
    let func = function() {};
    let args = { theArgs: 'here' };
    let config = new PortableBabelConfig(
      {
        plugins: [[func, args]],
      },
      resolvableNames()
    );
    assert.ok(!config.isParallelSafe);
    assert.deepEqual(run(config).plugins, [[func, args]]);
  });

  test('respects _parallelBabel api with buildUsing on PluginTarget', function(assert) {
    (exampleFunction as any)._parallelBabel = {
      requireFile: __filename,
      buildUsing: 'exampleFunction',
      params: {
        theParams: 'are here',
      },
    };
    let config = new PortableBabelConfig(
      {
        plugins: [exampleFunction],
      },
      resolvableNames()
    );
    assert.ok(config.isParallelSafe);
    let output = runParallelSafe(config);
    assert.equal(output.plugins[0], 'this is the example function with theParams=are here');
  });

  test('respects _parallelBabel api with useMethod on PluginTarget', function(assert) {
    (exampleFunction as any)._parallelBabel = {
      requireFile: __filename,
      useMethod: 'exampleFunction',
    };
    let config = new PortableBabelConfig(
      {
        plugins: [exampleFunction],
      },
      resolvableNames()
    );
    assert.ok(config.isParallelSafe);
    let output = runParallelSafe(config);
    assert.equal(output.plugins[0](), 'this is the example function with no params');
  });

  test('respects _parallelBabel api with with only requireFile on PluginTarget', function(assert) {
    (exampleFunction as any)._parallelBabel = {
      requireFile: __filename,
    };
    let config = new PortableBabelConfig(
      {
        plugins: [exampleFunction],
      },
      resolvableNames()
    );
    assert.ok(config.isParallelSafe);
    let output = runParallelSafe(config);
    assert.equal(output.plugins[0].exampleFunction(), 'this is the example function with no params');
  });

  test('respects _parallelBabel api on PluginOptions', function(assert) {
    function precompile() {}
    precompile._parallelBabel = {
      requireFile: __filename,
      buildUsing: 'exampleFunction',
      params: { theParams: 'reconstituted precompile' },
    };

    let config = new PortableBabelConfig(
      {
        plugins: [['my-plugin', { precompile }]],
      },
      resolvableNames('my-plugin')
    );
    assert.ok(config.isParallelSafe);
    let output = runParallelSafe(config);
    assert.equal(output.plugins[0][0], '/notional-base-dir/node_modules/my-plugin/index.js');
    assert.deepEqual(output.plugins[0][1], {
      precompile: 'this is the example function with theParams=reconstituted precompile',
    });
  });

  test('undefined is a serializable value', function(assert) {
    let config = new PortableBabelConfig(
      {
        plugins: ['./x', { value: undefined }],
      },
      resolvableNames()
    );
    assert.ok(config.isParallelSafe);
    let output = runParallelSafe(config);
    assert.equal(output.plugins[0][1].value, undefined, 'value should be undefined');
  });
});

export function exampleFunction(params: any) {
  if (params) {
    return `this is the example function with theParams=${params.theParams}`;
  } else {
    return `this is the example function with no params`;
  }
}
