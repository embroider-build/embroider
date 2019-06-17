import 'qunit';
import main, { isDefineExpression, Options as AdjustImportsOptions } from '../src/babel-plugin-adjust-imports';
import Types from '@babel/types';
import { transformSync } from '@babel/core';

const { test, only } = QUnit;

QUnit.module('babel-plugin-adjust-imports');

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

function getFirstCallExpresssionPath(source: string) {
  const ast: any = parse(source, {
    sourceType: 'module',
  });

  let path: any;

  traverse(ast, {
    CallExpression(_path: any) {
      if (path) {
        return;
      }
      path = _path;
    },
  });

  return path;
}

function isDefineExpressionFromSource(source: string) {
  return isDefineExpression(Types, getFirstCallExpresssionPath(source));
}

test('isDefineExpression works', function(assert) {
  assert.equal(isDefineExpressionFromSource(`apple()`), false);
  assert.equal(isDefineExpressionFromSource(`(apple())`), false);
  assert.equal(isDefineExpressionFromSource(`(define('module', [], function() { }))`), true);
  assert.equal(isDefineExpressionFromSource(`define('module', [], function() {});`), true);
  assert.equal(isDefineExpressionFromSource(`define('foo', ['apple'], function() {});`), true);
  assert.equal(isDefineExpressionFromSource(`define;define('module', [], function() {});`), true);
  assert.equal(isDefineExpressionFromSource(`define;define('module', function() {});`), false);
  assert.equal(isDefineExpressionFromSource(`define;define('module');`), false);
  assert.equal(isDefineExpressionFromSource(`define;define(1, [], function() { });`), false);
  assert.equal(isDefineExpressionFromSource(`define;define('b/a/c', ['a', 'b', 'c'], function() { });`), true);
  assert.equal(isDefineExpressionFromSource(`import foo from 'foo'; define('apple')`), false);
  assert.equal(isDefineExpressionFromSource(`define('apple'); import foo from 'foo'`), false);
});

only('main', function(assert) {
  const options: AdjustImportsOptions = {
    activeAddons: {},
    renameModules: { a: 'c' },
    renamePackages: { module: 'other-module', apple: 'banana' },
    extraImports: [],
    relocatedFiles: {},
    externalsDir: 'test',
  };

  {
    const { code } = transformSync(`define('module', ['a', 'b', 'c'], function() {})`, {
      plugins: [[main, options]],
      filename: 'some-file.js',
    }) as any;

    assert.equal(code, `define("other-module", ["c", 'b', 'c'], function () {});`);
  }

  {
    const { code } = transformSync(`define('module', ['module/a', 'module/b', 'module/c'], function() {})`, {
      plugins: [[main, options]],
      filename: 'some-file.js',
    }) as any;

    assert.equal(
      code,
      `define("other-module", ["other-module/a", "other-module/b", "other-module/c"], function () {});`
    );
  }

  {
    const { code } = transformSync(`import apple from 'apple'`, {
      plugins: [[main, options]],
      filename: 'some-file.js',
    }) as any;

    assert.equal(code, `import apple from "banana";`);
  }
});
