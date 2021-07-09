import main, {
  isDefineExpression,
  isDynamicImportExpression,
  isImportSyncExpression,
  Options as AdjustImportsOptions,
} from '../src/babel-plugin-adjust-imports';
import { transformSync } from '@babel/core';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { types as t } from '@babel/core';

describe('babel-plugin-adjust-imports', function () {
  function getFirstCallExpresssionPath(source: string) {
    const ast: any = parse(source, { sourceType: 'module' });
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
    return isDefineExpression(t, getFirstCallExpresssionPath(source));
  }

  function isImportSyncExpressionFromSource(source: string) {
    return isImportSyncExpression(t, getFirstCallExpresssionPath(source));
  }
  function isDynamicImportExpressionFromSource(source: string) {
    return isDynamicImportExpression(t, getFirstCallExpresssionPath(source));
  }

  test('isDefineExpression works', function () {
    expect(isDefineExpressionFromSource(`apple()`)).toBe(false);
    expect(isDefineExpressionFromSource(`(apple())`)).toBe(false);
    expect(isDefineExpressionFromSource(`(define('module', [], function() { }))`)).toBe(true);
    expect(isDefineExpressionFromSource(`define('module', [], function() {});`)).toBe(true);
    expect(isDefineExpressionFromSource(`define('foo', ['apple'], function() {});`)).toBe(true);
    expect(isDefineExpressionFromSource(`define;define('module', [], function() {});`)).toBe(true);
    expect(isDefineExpressionFromSource(`define;define('module', function() {});`)).toBe(false);
    expect(isDefineExpressionFromSource(`define;define('module');`)).toBe(false);
    expect(isDefineExpressionFromSource(`define;define(1, [], function() { });`)).toBe(false);
    expect(isDefineExpressionFromSource(`define;define('b/a/c', ['a', 'b', 'c'], function() { });`)).toBe(true);
    expect(isDefineExpressionFromSource(`import foo from 'foo'; define('apple')`)).toBe(false);
    expect(isDefineExpressionFromSource(`define('apple'); import foo from 'foo'`)).toBe(false);
  });

  test('isImportSyncExpression works', function () {
    expect(
      isImportSyncExpressionFromSource(`
      import { importSync } from '@embroider/macros';
      importSync('foo');
    `)
    ).toBe(true);
    expect(
      isImportSyncExpressionFromSource(`
      import { importSync as i } from '@embroider/macros';
      i('foo');
    `)
    ).toBe(true);
    expect(
      isImportSyncExpressionFromSource(`
      import { foo as importSync } from 'foobar';
      importSync('foo');
    `)
    ).toBe(false);
    expect(
      isImportSyncExpressionFromSource(`
      import { foo as i } from 'foobar';
      i('foo');
    `)
    ).toBe(false);
  });

  test('isDynamicImportExpression works', function () {
    expect(isDynamicImportExpressionFromSource(`import('foo');`)).toBe(true);
    expect(isDynamicImportExpressionFromSource(`async () => { await import('foo'); }`)).toBe(true);
    expect(isDynamicImportExpressionFromSource(`import foo from 'foo';`)).toBe(false);
  });

  test('main', function () {
    const options: AdjustImportsOptions = {
      activeAddons: {},
      renameModules: { a: 'c' },
      renamePackages: { module: 'other-module', apple: 'banana' },
      extraImports: [],
      relocatedFiles: {},
      externalsDir: 'test',
      resolvableExtensions: ['.js', '.hbs'],
      emberNeedsModulesPolyfill: false,
    };

    {
      const { code } = transformSync(`define('module', ['a', 'b', 'c'], function() {})`, {
        plugins: [[main, options]],
        filename: 'some-file.js',
      }) as any;

      expect(code).toBe(`define("other-module", ["c", 'b', 'c'], function () {});`);
    }

    {
      const { code } = transformSync(`define('module', ['module/a', 'module/b', 'module/c'], function() {})`, {
        plugins: [[main, options]],
        filename: 'some-file.js',
      }) as any;

      expect(code).toBe(
        `define("other-module", ["other-module/a", "other-module/b", "other-module/c"], function () {});`
      );
    }

    {
      const { code } = transformSync(`import apple from 'apple'`, {
        plugins: [[main, options]],
        filename: 'some-file.js',
      }) as any;

      expect(code).toBe(`import apple from "banana";`);
    }
  });
});
