import { allBabelVersions } from '@embroider/test-support';
import { Evaluator, buildLiterals } from '../../src/babel/evaluate-json';
import { VariableDeclarator, isIdentifier, Expression } from '@babel/types';
import { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';

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

function isNodePathPresent(path: NodePath<Expression | null | undefined>): path is NodePath<Expression> {
  return path.node != null;
}

function testEval(babelContext: typeof Babel) {
  let visitor = {
    VariableDeclarator: {
      exit(path: NodePath<VariableDeclarator>) {
        let id = path.get('id').node;
        let value = path.get('init');
        if (isIdentifier(id) && id.name === 'result' && isNodePathPresent(value)) {
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
