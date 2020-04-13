import { allBabelVersions } from '@embroider/test-support';
import evaluate, { buildLiterals } from '../../src/babel/evaluate-json';
import { VariableDeclarator, isIdentifier, Expression } from '@babel/types';
import { NodePath } from '@babel/traverse';

describe('evaluation', function() {
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

      test('functions are evaluated with known arguments are evaluated ', () => {
        let code = transform(`const result = functionCall(knownValue);`);
        expect(code).toMatch(`result = 2`);
        code = transform(`const result = functionCall();`);
        expect(code).toMatch(`result = 4`);
      });

      test('functions are evaluated with with an unknown inputs are left alone', () => {
        let code = transform(`const result = functionCall(someValue);`);
        expect(code).toMatch(`result = functionCall(someValue);`);
      });

      test('array expressions with a known inputs are evaluated', () => {
        let code = transform(`const result = [1, knownValue, functionCall(true)];`);
        expect(code).toMatch(`result = [1, 2, true]`);
      });

      test('array expressions with a unknown inputs are left alone', () => {
        let code = transform(`const result = [1, unknownValue, true];`);
        expect(code).toMatch(`result = [1, unknownValue, true];`);
      });

      test('object expressions with a known inputs are evaluated', () => {
        let code = transform(`const result = { a: 1, b: knownValue, c: functionCall(true) };`);
        expect(code).toMatch(`"a": 1`);
        expect(code).toMatch(`"b": 2`);
        expect(code).toMatch(`"c": true`);
      });

      test('object expressions with a unknown inputs are left alone', () => {
        let code = transform(`const result = { a: 1, b: unknownValue, c: functionCall(true) };`);
        expect(code).toMatch(`a: 1`);
        expect(code).toMatch(`b: unknownValue`);
        expect(code).toMatch(`c: functionCall(true)`);
      });
    },
  });
});

function nodePathNotNull(path: NodePath<Expression | null>): path is NodePath<Expression> {
  return path.node != null;
}

function testEval() {
  let visitor = {
    VariableDeclarator: {
      exit(path: NodePath<VariableDeclarator>) {
        let id = path.get('id').node;
        let value = path.get('init');
        if (isIdentifier(id) && id.name === 'result' && nodePathNotNull(value)) {
          let result = evaluate(value, {
            functionCall: function(a: number = 4) {
              return a;
            },
            knownValue: 2,
          });
          if (result.confident) {
            value.replaceWith(buildLiterals(result.value));
          }
        }
      },
    },
  };
  return { visitor };
}
