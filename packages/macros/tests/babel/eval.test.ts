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
        expect(code).toMatch(/result = 42/);
      });

      test('instanceof is not statically known', () => {
        let code = transform(`const result = x instanceof y;`);
        expect(code).toMatch(/result = x instanceof y/);
      });

      test('binary operators can be statically known', () => {
        let code = transform(`const result = 1 + 2;`);
        expect(code).toMatch(/result = 3/);
      });

      test('binary operators with an unknown input are left alone', () => {
        let code = transform(`const result = 1 + someNumber();`);
        expect(code).toMatch(/result = 1 + someNumber();/);
      });

      test('unary operators can be statically known', () => {
        let code = transform(`const result = !0;`);
        expect(code).toMatch(/result = true/);
      });

      test('unary operators with an unknown input are left alone', () => {
        let code = transform(`const result = !someNumber();`);
        expect(code).toMatch(/result = !someNumber();/);
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
          let result = evaluate(value);
          if (result.confident) {
            value.replaceWith(buildLiterals(result.value));
          }
        }
      },
    },
  };
  return { visitor };
}
