import 'qunit';
import { allBabelVersions, runDefault } from './helpers';
import { MacrosConfig } from '../src';
const { test } = QUnit;

allBabelVersions(function (transform: (code: string) => string, config: MacrosConfig) {
  QUnit.module(`macroIf`, function() {

    config.setConfig(__filename, 'qunit', { items: [ { approved: true, other: null, size: 2.3 } ]});

    test('select consequent, drop alternate', function(assert) {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      export default function() {
        return macroIf(true, () => 'alpha', () => 'beta');
      }
      `);
      assert.equal(runDefault(code), 'alpha');
      assert.ok(!/beta/.test(code), 'beta should be dropped');
      assert.ok(!/macroIf/.test(code), 'macroIf should be dropped');
      assert.ok(!/@embroider\/macros/.test(code), '@embroider/macros should be dropped');
    });

    test('select consequent, drop alternate', function(assert) {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      export default function() {
        return macroIf(false, () => 'alpha', () => 'beta');
      }
      `);
      assert.equal(runDefault(code), 'beta');
      assert.ok(!/alpha/.test(code), 'alpha should be dropped');
      assert.ok(!/macroIf/.test(code), 'macroIf should be dropped');
      assert.ok(!/@embroider\/macros/.test(code), '@embroider/macros should be dropped');
    });

    test('works with block forms', function(assert) {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      export default function() {
        return macroIf(false, () => { return 'alpha'; }, () => { return 'beta'; });
      }
      `);
      assert.equal(runDefault(code), 'beta');
      assert.ok(!/alpha/.test(code), 'alpha should be dropped');
    });

    test('block lifting', function(assert) {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      export default function() {
        let value = macroIf(true, () => {
          let value = 1;
          return value + 1;
        });
        return value;
      }
      `);
      assert.equal(runDefault(code), 2);
    });

    test('preserves this when using single-expression arrows', function(assert) {
      let code = transform(`
      import { macroIf } from '@embroider/macros';

      class Example {
        constructor() {
          this.name = 'Quint';
        }
        method() {
          return macroIf(true, () => this.name, () => 'Other');
        }
      }

      export default function() {
        return new Example().method();
      }
      `);
      assert.equal(runDefault(code), 'Quint');
    });

    test('preserves this when using block arrows', function(assert) {
      let code = transform(`
      import { macroIf } from '@embroider/macros';

      class Example {
        constructor() {
          this.name = 'Quint';
        }
        method() {
          return macroIf(true, () => { return this.name;}, () => { return 'Other'; });
        }
      }

      export default function() {
        return new Example().method();
      }
      `);
      assert.equal(runDefault(code), 'Quint');
    });

    test('select consequent, no alternate', function(assert) {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      export default function() {
        return macroIf(true, () => 'alpha');
      }
      `);
      assert.equal(runDefault(code), 'alpha');
      assert.ok(!/macroIf/.test(code), 'macroIf should be dropped');
      assert.ok(!/@embroider\/macros/.test(code), '@embroider/macros should be dropped');
    });

    test('drop consequent, no alternate', function(assert) {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      export default function() {
        return macroIf(false, () => 'alpha');
      }
      `);
      assert.equal(runDefault(code), undefined);
    });

    test('drops imports that are only used in the unused branch', function(assert) {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      import a from 'module-a';
      import b from 'module-b';
      import c from 'module-c';
      export default function() {
        return macroIf(true, () => a, () => b);
      }
      `);
      assert.ok(/module-a/.test(code), 'have module-a');
      assert.ok(!/module-b/.test(code), 'do not have module-b');
    });

    test('non-static predicate refuses to build', function(assert) {
      assert.throws(() => {
        transform(`
        import { macroIf } from '@embroider/macros';
        import other from 'other';
        export default function() {
          return macroIf(other, () => a, () => b);
        }
        `);
      },/the first argument to macroIf must be statically known/);
    });

    test('leaves unrelated unused imports alone', function(assert) {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      import a from 'module-a';
      import b from 'module-b';
      import c from 'module-c';
      export default function() {
        return macroIf(true, () => a, () => b);
      }
      `);
      assert.ok(/module-c/.test(code), 'unrelated unused imports are left alone');
    });

    test('leaves unrelated used imports alone', function(assert) {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      import a from 'module-a';
      import b from 'module-b';
      import c from 'module-c';
      export default function() {
        c();
        return macroIf(true, () => a, () => b);
      }
      `);
      assert.ok(/module-c/.test(code), 'unrelated unused imports are left alone');
    });

    test('composes with other macros', function(assert) {
      let code = transform(`
      import { macroIf, dependencySatisfies } from '@embroider/macros';
      export default function() {
        return macroIf(dependencySatisfies('qunit', '*'), () => 'alpha', () => 'beta');
      }
      `);
      assert.equal(runDefault(code), 'alpha');
      assert.ok(!/beta/.test(code), 'beta should be dropped');
    });

    test('can see booleans inside getConfig', function(assert) {
      let code = transform(`
      import { macroIf, getConfig } from '@embroider/macros';
      export default function() {
        // this deliberately chains three kinds of property access syntax: by
        // identifier, by numeric index, and by string literal.
        return macroIf(getConfig('qunit').items[0]["approved"], () => 'alpha', () => 'beta');
      }
      `);
      assert.equal(runDefault(code), 'alpha');
      assert.ok(!/beta/.test(code), 'beta should be dropped');
    });

    test(`direct export of macroIf`, function(assert) {
      let code = transform(`
      import { dependencySatisfies, macroIf } from '@embroider/macros';

      function a() {
        return 'a';
      }

      function b() {
        return 'b';
      }

      export default macroIf(
        false,
        () => a,
        () => b,
      );
      `);
      assert.equal(runDefault(code), 'b');

    });
  });
});
