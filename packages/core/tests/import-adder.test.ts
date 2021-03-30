import { allBabelVersions, runDefault } from '@embroider/test-support';
import { ImportAdder } from '../src/babel-import-adder';
import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

function importAdderTests(transform: (code: string) => string) {
  const dependencies = {
    m: {
      thing(arg: string) {
        return `you said: ${arg}.`;
      },
      default(arg: string) {
        return `default said: ${arg}.`;
      },
      __esModule: true,
    },
    n: {
      thing(arg: string) {
        return `n said: ${arg}.`;
      },
      __esModule: true,
    },
  };

  test('can generate an import', () => {
    let code = transform(`
      export default function() {
        return myTarget('foo');
      }
      `);
    expect(runDefault(code, { dependencies })).toEqual('you said: foo.');
    expect(code).toMatch(/import \{ thing \} from ['"]m['"]/);
  });

  test('can generate a default import', () => {
    let code = transform(`
      export default function() {
        return myDefaultTarget('foo');
      }
      `);
    expect(runDefault(code, { dependencies })).toEqual('default said: foo.');
    expect(code).toMatch(/import myDefaultTarget from ['"]m['"]/);
  });

  test('can use an optional name hint', () => {
    let code = transform(`
      export default function() {
        return myHintTarget('foo');
      }
      `);
    expect(runDefault(code, { dependencies })).toEqual('default said: foo.');
    expect(code).toMatch(/import HINT from ['"]m['"]/);
  });

  test('avoids an existing local binding', () => {
    let code = transform(`
      export default function() {
        let thing = 'hello';
        return myTarget(thing);
      }
      `);
    expect(runDefault(code, { dependencies })).toEqual('you said: hello.');
    expect(code).toMatch(/import \{ thing as thing0 \} from ['"]m['"]/);
  });

  test('uses an existing import', () => {
    let code = transform(`
      import { thing } from 'm';
      export default function() {
        return myTarget('foo');
      }
      `);
    expect(runDefault(code, { dependencies })).toEqual('you said: foo.');
    expect(code.match(/import/g)?.length).toEqual(1);
  });

  test('adds to an existing import', () => {
    let code = transform(`
      import { other } from 'm';
      export default function() {
        return myTarget('foo');
      }
      `);
    expect(runDefault(code, { dependencies })).toEqual('you said: foo.');
    expect(code.match(/import/g)?.length).toEqual(1);
    expect(code).toMatch(/import \{ other, thing \} from ['"]m['"]/);
  });

  test('subsequent imports avoid previously created bindings', () => {
    let code = transform(`
      export default function() {
        return myTarget("a") + " | " + second("b");
      }
      `);
    expect(runDefault(code, { dependencies })).toEqual('you said: a. | n said: b.');
    expect(code).toMatch(/import \{ thing \} from ['"]m['"]/);
    expect(code).toMatch(/import \{ thing as thing0 \} from ['"]n['"]/);
  });

  test('multiple uses share an import', () => {
    let code = transform(`
      export default function() {
        return myTarget("a") + " | " + myTarget("b");
      }
      `);
    expect(runDefault(code, { dependencies })).toEqual('you said: a. | you said: b.');
    expect(code).toMatch(/import \{ thing \} from ['"]m['"]/);
    expect(code.match(/import/g)?.length).toEqual(1);
  });

  test('multiple uses in different scopes share a specifier', () => {
    let code = transform(`
      function a() {
        return myTarget('a');
      }
      function b() {
        return myTarget('b');
      }
      export default function() {
        return a() + " | " + b();
      }
      `);
    expect(runDefault(code, { dependencies })).toEqual('you said: a. | you said: b.');
    expect(code).toMatch(/import \{ thing \} from ['"]m['"]/);
    expect(code.match(/import/g)?.length).toEqual(1);
  });

  test('resolves conflicts between different local scope collisions', () => {
    let code = transform(`
      export default function() {
        let first = myTarget("a");
        let second = (function(thing) {
          return myTarget(thing);
        })("b");
        return first + " | " + second;
      }
      `);
    expect(runDefault(code, { dependencies })).toEqual('you said: a. | you said: b.');
    expect(code).toMatch(/import \{ thing, thing as thing0 \} from ['"]m['"]/);
    expect(code.match(/import/g)?.length).toEqual(1);
  });
}

interface State {
  adder: ImportAdder;
}

function testTransform(babel: { types: typeof t }): unknown {
  return {
    visitor: {
      Program: {
        enter(path: NodePath<t.Program>, state: State) {
          state.adder = new ImportAdder(babel.types, path);
        },
      },
      CallExpression(path: NodePath<t.CallExpression>, state: State) {
        let callee = path.get('callee');
        if (callee.isIdentifier() && callee.node.name === 'myTarget') {
          callee.replaceWith(state.adder.import(callee, 'm', 'thing'));
        } else if (callee.isIdentifier() && callee.node.name === 'second') {
          callee.replaceWith(state.adder.import(callee, 'n', 'thing'));
        } else if (callee.isIdentifier() && callee.node.name === 'myDefaultTarget') {
          callee.replaceWith(state.adder.import(callee, 'm', 'default'));
        } else if (callee.isIdentifier() && callee.node.name === 'myHintTarget') {
          callee.replaceWith(state.adder.import(callee, 'm', 'default', 'HINT'));
        }
      },
    },
  };
}

describe('import-adder', () => {
  allBabelVersions({
    babelConfig() {
      return {
        plugins: [testTransform],
      };
    },
    createTests: importAdderTests,
  });
});
