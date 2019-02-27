import 'qunit';
import { allBabelVersions, runDefault } from './helpers';
import { MacrosConfig } from '../src';
const { test } = QUnit;

allBabelVersions(function (transform: (code: string) => string, config: MacrosConfig) {
  QUnit.module(`ifMacro`, function() {

    config.setConfig(__filename, 'qunit', { items: [ { approved: true, other: null, size: 2.3 } ]});

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

    test('can see booleans inside getConfig', function(assert) {
      let code = transform(`
      import { ifMacro, getConfig } from '@embroider/macros';
      export default function() {
        // this deliberately chains three kinds of property access syntax: by
        // identifier, by numeric index, and by string literal.
        return ifMacro(getConfig('qunit').items[0]["approved"], () => 'alpha', () => 'beta');
      }
      `);
      assert.equal(runDefault(code), 'alpha');
      assert.ok(!/beta/.test(code), 'beta should be dropped');
    });

  });
});
