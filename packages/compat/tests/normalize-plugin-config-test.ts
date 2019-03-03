import 'qunit';
import { NormalizedBabelConfig } from '../src/normalize-plugin-config';
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
    }
  };
}

function runParallelSafe(config: NormalizedBabelConfig): any {
  if (!config.isParallelSafe) {
    throw new Error(`not parallel safe`);
  }
  delete (global as any).__embroider_normalize_plugin_values__;
  return run(config);
}

function run(config: NormalizedBabelConfig): any {
  let module = { exports: {} };
  eval(config.serialize());
  return module.exports;
}

QUnit.module('parallel-plugin-config', function(hooks) {
  test('absolute path', function(assert) {
    let config = new NormalizedBabelConfig({
      plugins: ['/path/to/some/plugin.js']
    }, resolvableNames());
    assert.deepEqual(runParallelSafe(config).plugins, ['/path/to/some/plugin.js']);
  });

  test('local path', function(assert) {
    let config = new NormalizedBabelConfig({
      plugins: ['./path/to/some/plugin.js']
    }, resolvableNames());
    assert.deepEqual(runParallelSafe(config).plugins, ['/notional-base-dir/path/to/some/plugin.js']);
  });

  test('package name', function(assert) {
    let config = new NormalizedBabelConfig({
      plugins: ['my-package']
    }, resolvableNames('my-package'));
    assert.deepEqual(runParallelSafe(config).plugins, ['/notional-base-dir/node_modules/my-package/index.js']);
  });

  test('package name shorthand', function(assert) {
    let config = new NormalizedBabelConfig({
      plugins: ['my-package']
    }, resolvableNames('babel-plugin-my-package'));
    assert.deepEqual(runParallelSafe(config).plugins, ['/notional-base-dir/node_modules/babel-plugin-my-package/index.js']);
  });

  test('namespaced package name', function(assert) {
    let config = new NormalizedBabelConfig({
      plugins: ['@me/my-package']
    }, resolvableNames('@me/my-package'));
    assert.deepEqual(runParallelSafe(config).plugins, ['/notional-base-dir/node_modules/@me/my-package/index.js']);
  });

  test('namespaced package name shorthand', function(assert) {
    let config = new NormalizedBabelConfig({
      plugins: ['@me/my-package']
    }, resolvableNames('@me/babel-plugin-my-package'));
    assert.deepEqual(runParallelSafe(config).plugins, ['/notional-base-dir/node_modules/@me/babel-plugin-my-package/index.js']);
  });

  test('resolves name with json-safe config', function(assert) {
    let config = new NormalizedBabelConfig({
      plugins: [['my-package', { theOptions: 'cool' }]]
    }, resolvableNames('babel-plugin-my-package'));
    assert.deepEqual(runParallelSafe(config).plugins, [
      ['/notional-base-dir/node_modules/babel-plugin-my-package/index.js', { theOptions: 'cool' }]
    ]);
  });

  test('resolves name with arbitrary config', function(assert) {
    let options = { precompile() { return 'cool'; } };
    let config = new NormalizedBabelConfig({
      plugins: [['my-package', options]]
    }, resolvableNames('babel-plugin-my-package'));
    assert.ok(!config.isParallelSafe);
    assert.deepEqual(run(config).plugins, [
      ['/notional-base-dir/node_modules/babel-plugin-my-package/index.js', options]
    ]);
  });

  test('passes through bare function', function(assert) {
    let func = function() {};
    let config = new NormalizedBabelConfig({
      plugins: [func]
    }, resolvableNames());
    assert.ok(!config.isParallelSafe);
    assert.deepEqual(run(config).plugins, [
      func
    ]);
  });

  test('passes through function with args', function(assert) {
    let func = function() {};
    let args = { theArgs: 'here' };
    let config = new NormalizedBabelConfig({
      plugins: [[func, args]]
    }, resolvableNames());
    assert.ok(!config.isParallelSafe);
    assert.deepEqual(run(config).plugins, [
      [func, args]
    ]);
  });
});
