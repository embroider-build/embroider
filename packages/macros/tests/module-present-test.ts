import 'qunit';
import { transform as transform6, TransformOptions as Options6 } from 'babel-core';
import { transform as transform7, TransformOptions as Options7 } from '@babel/core';
import { babelPluginConfig } from '..';
import { join } from 'path';

const { test } = QUnit;

function createTests(transform: (code: string) => string, babelVersion: number) {
  QUnit.module(`modulePresent (babel ${babelVersion})`, function() {

    test('module is present', function(assert) {
      let code = transform(`
      import { modulePresent } from '@embroider/macros';
      export default function() {
        return modulePresent('qunit');
      }
      `);
      assert.equal(runDefault(code), true);
    });

    test('module is missing', function(assert) {
      let code = transform(`
      import { modulePresent } from '@embroider/macros';
      export default function() {
        return modulePresent('not-a-real-dep');
      }
      `);
      assert.equal(runDefault(code), false);
    });

    test('multiple uses in one module', function(assert) {
      let code = transform(`
      import { modulePresent } from '@embroider/macros';
      export default function() {
        return [modulePresent('qunit'), modulePresent('not-a-real-dep')];
      }
      `);
      assert.deepEqual(runDefault(code), [true, false]);
    });

    test('import gets removed', function(assert) {
      let code = transform(`
      import { modulePresent, other } from '@embroider/macros';
      export default function() {
        return modulePresent('not-a-real-dep');
      }
      export function x() {
        return other;
      }
      `);
      assert.ok(!/modulePresent/.test(code), `modulePresent should not be in the output: ${code}`);
      assert.ok(/@embroider\/macros/.test(code), `other import should still be present: ${code}`);
    });

    test('entire import statement gets removed', function(assert) {
      let code = transform(`
      import { modulePresent } from '@embroider/macros';
      export default function() {
        return modulePresent('not-a-real-dep');
      }
      `);
      assert.ok(!/modulePresent/.test(code), `modulePresent should not be in the output: ${code}`);
      assert.ok(!/@embroider\/macros/.test(code), `entire import statement should not be in the output: ${code}`);
    });

    test('non call error', function(assert) {
      assert.throws(() => {
        transform(`
          import { modulePresent } from '@embroider/macros';
          let x = modulePresent;
        `);
      }, /You can only use modulePresent as a function call/);
    });

    test('args length error', function(assert) {
      assert.throws(() => {
        transform(`
          import { modulePresent } from '@embroider/macros';
          modulePresent('foo', 'bar');
        `);
      }, /modulePresent takes exactly one argument, you passed 2/);
    });

    test('non literal arg error', function(assert) {
      assert.throws(() => {
        transform(`
          import { modulePresent } from '@embroider/macros';
          let name = 'qunit';
          modulePresent(name);
        `);
      }, /the argument to modulePresent must be a string literal/);
    });
  });
}

const options7: Options7 = {
  filename: join(__dirname, 'sample.js'),
  presets: [],
  plugins: [babelPluginConfig()]
};

const options6: Options6 = {
  filename: join(__dirname, 'sample.js'),
  presets: [],
  plugins: [babelPluginConfig()]
};

createTests(function(code: string){ return transform6(code, options6).code!; }, 6);
createTests(function(code: string){ return transform7(code, options7)!.code!; }, 7);

function runDefault(code: string): any {
  let cjsCode = transform7(code, {
    plugins: ['@babel/plugin-transform-modules-commonjs']
  })!.code!;
  let exports = {};
  eval(cjsCode);
  return (exports as any).default();
}
