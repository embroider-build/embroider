import { allBabelVersions } from '@embroider/test-support';
import { Evaluator, buildLiterals } from '../../src/babel/evaluate-json';
import type { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import { types as t } from '@babel/core';
import 'code-equality-assertions/jest';
import type State from '../../src/babel/state';
import { initState } from '../../src/babel/state';
import { resolve } from 'path';

describe('evaluation', function () {
  allBabelVersions({
    babelConfig() {
      return {
        plugins: [testEval],
      };
    },
    createTests(transform) {
      test('member access', () => {
        let code = transform(`const result = ({ x: 42 }).x;`);
        expect(code).toMatch(`result = 42`);
      });

      if (transform.babelMajorVersion !== 6) {
        test('optional chaining non-nullish member access', () => {
          let code = transform(`const result = ({ x: 42 })?.x;`);
          expect(code).toMatch(`result = 42`);
        });

        test('object literal non-nullish member access parses OK', () => {
          let code = transform(`const result = { ...content\n}?.[0].content;`);
          expect(code).toEqualCode(`const result = { ...content\n}?.[0].content;`);
        });

        test('optional chaining nullish member access', () => {
          let code = transform(`const result = knownUndefinedValue?.x;`);
          expect(code).toMatch(`result = undefined`);
        });
      }

      test('instanceof is not statically known', () => {
        let code = transform(`const result = x instanceof y;`);
        expect(code).toMatch(`result = x instanceof y`);
      });

      test('binary operators can be statically known', () => {
        let code = transform(`const result = 1 + 2;`);
        expect(code).toMatch(`result = 3`);
      });

      test('binary operators with an unknown input are left alone', () => {
        let code = transform(`const result = 1 + someNumber();`);
        expect(code).toMatch(`result = 1 + someNumber();`);
      });

      test('unary operators can be statically known', () => {
        let code = transform(`const result = !0;`);
        expect(code).toMatch(`result = true`);
      });

      test('unary operators with an unknown input are left alone', () => {
        let code = transform(`const result = !someNumber();`);
        expect(code).toMatch(`result = !someNumber();`);
      });

      test('logical operators with an known input are evaluated', () => {
        let code = transform(`const result = 1 && knownValue;`);
        expect(code).toMatch(`result = 2`);
      });

      test('logical operators with an unknown inputs are left alone', () => {
        let code = transform(`const result = 1 && someValue;`);
        expect(code).toMatch(`result = 1 && someValue;`);
      });

      test('assignment operators with an unknown right side value left alone', () => {
        let code = transform(`const result = someNumber();`);
        expect(code).toMatch(`result = someNumber();`);
        code = transform(`const result = someNumber;`);
        expect(code).toMatch(`result = someNumber;`);
      });

      test('assignment operators with a known inputs are evaluated', () => {
        let code = transform(`const result = knownValue;`);
        expect(code).toMatch(`result = 2`);
      });

      test('conditional operators with an unknown inputs are left alone', () => {
        let code = transform(`const result = 1 ? someValue : true;`);
        expect(code).toMatch(`result = 1 ? someValue : true;`);
      });

      test('conditional operators with a known inputs are evaluated', () => {
        let code = transform(`const result = 1 ? knownValue : b = "shouldn't evaluate this";`);
        expect(code).toMatch(`result = 2`);
      });

      test('array expressions with entirely known inputs are evaluated', () => {
        let code = transform(`const result = [1, knownValue, ({ a: 'b' }).a];`);
        expect(code).toMatch(`result = [1, 2, "b"]`);
      });

      test('array expressions containing unknown inputs are left alone', () => {
        let code = transform(`const result = [1, knownValue, unknownValue];`);
        expect(code).toMatch(`result = [1, knownValue, unknownValue];`);
      });

      test('object expressions with all known inputs are evaluated', () => {
        let code = transform(`const result = { a: 1, b: knownValue };`);
        expect(code).toMatch(`"a": 1`);
        expect(code).toMatch(`"b": 2`);
      });

      test('object expressions with an unknown input are left alone', () => {
        let code = transform(`const result = { a: 1, b: unknownValue };`);
        expect(code).toMatch(`a: 1`);
        expect(code).toMatch(`b: unknownValue`);
      });
    },
  });
});

describe('hasRuntimeImplementation', function () {
  allBabelVersions({
    babelConfig() {
      return {
        plugins: [[testRuntime, { appPackageRoot: resolve(__dirname, '..', '..') }]],
      };
    },
    createTests(transform) {
      test('boolean literal', () => {
        let code = transform(`const result = true;`);
        expect(code).toMatch(`result = false`);
      });

      test('string literal', () => {
        let code = transform(`const result = 'foo';`);
        expect(code).toMatch(`result = false`);
      });

      test('number literal', () => {
        let code = transform(`const result = 1;`);
        expect(code).toMatch(`result = false`);
      });

      test('null literal', () => {
        let code = transform(`const result = null;`);
        expect(code).toMatch(`result = false`);
      });

      test('undefined literal', () => {
        let code = transform(`const result = undefined;`);
        expect(code).toMatch(`result = false`);
      });

      test('isTesting', () => {
        let code = transform(`
        import { isTesting } from '@embroider/macros';
        const result = isTesting()`);
        expect(code).toMatch(`result = true`);
      });

      test('getConfig', () => {
        let code = transform(`
        import { getConfig } from '@embroider/macros';
        const result = getConfig('foo')`);
        expect(code).toMatch(`result = false`);
      });

      test('getConfig property access', () => {
        let code = transform(`
        import { getConfig } from '@embroider/macros';
        const result = getConfig('foo').bar`);
        expect(code).toMatch(`result = false`);
      });

      // this is throwing internally, not sure how to fix
      test.skip('getOwnConfig', () => {
        let code = transform(`
        import { getOwnConfig } from '@embroider/macros';
        const result = getOwnConfig()`);
        expect(code).toMatch(`result = false`);
      });

      test('getGlobalConfig', () => {
        let code = transform(`
        import { getGlobalConfig } from '@embroider/macros';
        const result = getGlobalConfig()`);
        expect(code).toMatch(`result = false`);
      });

      test('getGlobalConfig property access', () => {
        let code = transform(`
        import { getGlobalConfig } from '@embroider/macros';
        const result = getGlobalConfig().foo`);
        expect(code).toMatch(`result = false`);
      });

      test('getGlobalConfig fastboot access', () => {
        let code = transform(`
        import { getGlobalConfig } from '@embroider/macros';
        const result = getGlobalConfig().fastboot`);
        expect(code).toMatch(`result = true`);
      });

      // fastboot.isRunning relies on dynamic evaluation at runtime. For backwards compatibility we keep it working. See https://github.com/embroider-build/embroider/issues/1804
      test('getGlobalConfig fastboot.isRunning access', () => {
        let code = transform(`
        import { getGlobalConfig } from '@embroider/macros';
        const result = getGlobalConfig().fastboot.isRunning`);
        expect(code).toMatch(`result = true`);
      });

      test('getGlobalConfig fastboot?.isRunning access', () => {
        let code = transform(`
        import { getGlobalConfig } from '@embroider/macros';
        const result = getGlobalConfig().fastboot?.isRunning`);
        expect(code).toMatch(`result = true`);
      });

      test('static object', () => {
        let code = transform(`const result = { foo: 'bar' }`);
        expect(code).toMatch(`result = false`);
      });

      test('object with runtime', () => {
        let code = transform(`
        import { isTesting } from '@embroider/macros';
        const result = { foo: isTesting() }`);
        expect(code).toMatch(`result = true`);
      });

      test('static array', () => {
        let code = transform(`const result = [1, 2]`);
        expect(code).toMatch(`result = false`);
      });

      test('array with runtime', () => {
        let code = transform(`
        import { isTesting } from '@embroider/macros';
        const result = [1, isTesting(), 2]`);
        expect(code).toMatch(`result = true`);
      });

      test('static assignment', () => {
        let code = transform(`
        let foo;
        const result = foo = 1;`);
        expect(code).toMatch(`result = false`);
      });

      test('assignment with runtime', () => {
        let code = transform(`
        import { isTesting } from '@embroider/macros';
        let foo;
        const result = foo = isTesting();`);
        expect(code).toMatch(`result = true`);
      });

      test('call expression', () => {
        let code = transform(`const result = foo();`);
        expect(code).toMatch(`result = undefined`);
      });

      test('binary expression', () => {
        let code = transform(`const result = 1 === 1;`);
        expect(code).toMatch(`result = false`);
      });

      test('binary expression with runtime', () => {
        let code = transform(`
        import { isTesting } from '@embroider/macros';
        const result = true === isTesting();`);
        expect(code).toMatch(`result = true`);
      });

      test('logical expression', () => {
        let code = transform(`const result = true && false`);
        expect(code).toMatch(`result = false`);
      });

      test('logical expression with runtime', () => {
        let code = transform(`
        import { isTesting } from '@embroider/macros';
        const result = true && isTesting();`);
        expect(code).toMatch(`result = true`);
      });

      test('unary expression', () => {
        let code = transform(`const result = !false`);
        expect(code).toMatch(`result = false`);
      });

      test('unary expression with runtime', () => {
        let code = transform(`
        import { isTesting } from '@embroider/macros';
        const result = !isTesting();`);
        expect(code).toMatch(`result = true`);
      });

      test('ternary expression', () => {
        let code = transform(`const result = true ? 1 : 2`);
        expect(code).toMatch(`result = false`);
      });

      test('ternary expression with runtime', () => {
        let code = transform(`
        import { isTesting } from '@embroider/macros';
        const result = true ? isTesting() : 2;`);
        expect(code).toMatch(`result = true`);
      });

      test('identifier', () => {
        let code = transform(`const result = knownValue;`);
        expect(code).toMatch(`result = false`);
      });

      test('member expression', () => {
        let code = transform(`const result = { foo: true }`);
        expect(code).toMatch(`result = false`);
      });

      test('member expression with runtime', () => {
        let code = transform(`
        import { isTesting } from '@embroider/macros';
        const result = { foo: isTesting() }`);
        expect(code).toMatch(`result = true`);
      });
    },
  });
});

function isNodePathPresent(path: NodePath<t.Expression | null | undefined>): path is NodePath<t.Expression> {
  return path.node != null;
}

function testEval(babelContext: typeof Babel) {
  let visitor = {
    VariableDeclarator: {
      exit(path: NodePath<t.VariableDeclarator>) {
        let id = path.get('id').node;
        let value = path.get('init');
        if (t.isIdentifier(id) && id.name === 'result' && isNodePathPresent(value)) {
          let evaluator = new Evaluator({
            locals: {
              knownValue: 2,
              knownUndefinedValue: undefined,
            },
          });
          let result = evaluator.evaluate(value);
          if (result.confident) {
            value.replaceWith(buildLiterals(result.value, babelContext));
          }
        }
      },
    },
  };
  return { visitor };
}

function testRuntime(babelContext: typeof Babel) {
  let visitor = {
    Program: {
      enter(path: NodePath<t.Program>, state: State) {
        initState(t, path, state);
      },
    },
    VariableDeclarator: {
      exit(path: NodePath<t.VariableDeclarator>, state: State) {
        let id = path.get('id').node;
        let value = path.get('init');
        if (t.isIdentifier(id) && id.name === 'result' && isNodePathPresent(value)) {
          let evaluator = new Evaluator({
            locals: {
              knownValue: 2,
              knownUndefinedValue: undefined,
            },
            state,
          });
          let result = evaluator.evaluate(value);
          value.replaceWith(
            buildLiterals(result.confident ? result.hasRuntimeImplementation : undefined, babelContext)
          );
        }
      },
    },
  };
  return { visitor };
}
