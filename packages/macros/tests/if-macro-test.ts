import 'qunit';
import { allBabelVersions, runDefault } from './helpers';
const { test } = QUnit;

allBabelVersions(function (transform: (code: string) => string) {
  QUnit.module(`ifMacro`, function() {

    test('select consequent, drop alternate', function(assert) {
      let code = transform(`
      import { ifMacro } from '@embroider/macros';
      export default function() {
        return ifMacro(true, () => 'alpha', () => 'beta');
      }
      `);
      assert.equal(runDefault(code), 'alpha');
      assert.ok(!/beta/.test(code), 'beta should be dropped');
    });

    test('select consequent, drop alternate', function(assert) {
      let code = transform(`
      import { ifMacro } from '@embroider/macros';
      export default function() {
        return ifMacro(false, () => 'alpha', () => 'beta');
      }
      `);
      assert.equal(runDefault(code), 'beta');
      assert.ok(!/alpha/.test(code), 'alpha should be dropped');
    });

    test('select consequent, no alternate', function(assert) {
      let code = transform(`
      import { ifMacro } from '@embroider/macros';
      export default function() {
        return ifMacro(true, () => 'alpha');
      }
      `);
      assert.equal(runDefault(code), 'alpha');
    });

    test('drop consequent, no alternate', function(assert) {
      let code = transform(`
      import { ifMacro } from '@embroider/macros';
      export default function() {
        return ifMacro(false, () => 'alpha');
      }
      `);
      assert.equal(runDefault(code), undefined);
    });

    test('drops imports that are only used in the unused branch', function(assert) {
      let code = transform(`
      import { ifMacro } from '@embroider/macros';
      import a from 'module-a';
      import b from 'module-b';
      import c from 'module-c';
      export default function() {
        return ifMacro(true, () => a, () => b);
      }
      `);
      assert.ok(/module-a/.test(code), 'have module-a');
      assert.ok(!/module-b/.test(code), 'do not have module-b');
    });

    test('leaves unrelated unused imports alone', function(assert) {
      let code = transform(`
      import { ifMacro } from '@embroider/macros';
      import a from 'module-a';
      import b from 'module-b';
      import c from 'module-c';
      export default function() {
        return ifMacro(true, () => a, () => b);
      }
      `);
      assert.ok(/module-c/.test(code), 'unrelated unused imports are left alone');
    });

    test('leaves unrelated used imports alone', function(assert) {
      let code = transform(`
      import { ifMacro } from '@embroider/macros';
      import a from 'module-a';
      import b from 'module-b';
      import c from 'module-c';
      export default function() {
        c();
        return ifMacro(true, () => a, () => b);
      }
      `);
      assert.ok(/module-c/.test(code), 'unrelated unused imports are left alone');
    });

    test('composes with other macros', function(assert) {
      let code = transform(`
      import { ifMacro, modulePresent } from '@embroider/macros';
      export default function() {
        return ifMacro(modulePresent('qunit'), () => 'alpha', () => 'beta');
      }
      `);
      assert.equal(runDefault(code), 'alpha');
      assert.ok(!/beta/.test(code), 'beta should be dropped');
    });

  });
});
