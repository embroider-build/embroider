import 'qunit';
import { allBabelVersions, runDefault } from './helpers';
const { test } = QUnit;

allBabelVersions(function (transform: (code: string) => string) {
  QUnit.module(`dependencySatisfies`, function() {

    test('is satisfied', function(assert) {
      let code = transform(`
      import { dependencySatisfies } from '@embroider/macros';
      export default function() {
        return dependencySatisfies('qunit', '^2.8.0');
      }
      `);
      assert.equal(runDefault(code), true);
    });

    test('is not satisfied', function(assert) {
      let code = transform(`
      import { dependencySatisfies } from '@embroider/macros';
      export default function() {
        return dependencySatisfies('qunit', '^10.0.0');
      }
      `);
      assert.equal(runDefault(code), false);
    });

    test('is not present', function(assert) {
      let code = transform(`
      import { dependencySatisfies } from '@embroider/macros';
      export default function() {
        return dependencySatisfies('not-a-real-dep', '^10.0.0');
      }
      `);
      assert.equal(runDefault(code), false);
    });

    test('import gets removed', function(assert) {
      let code = transform(`
      import { dependencySatisfies } from '@embroider/macros';
      export default function() {
        return dependencySatisfies('not-a-real-dep', '1');
      }
      `);
      assert.ok(!/dependencySatisfies/.test(code), `dependencySatisfies should not be in the output: ${code}`);
    });

    test('entire import statement gets removed', function(assert) {
      let code = transform(`
      import { dependencySatisfies } from '@embroider/macros';
      export default function() {
        return dependencySatisfies('not-a-real-dep', '*');
      }
      `);
      assert.ok(!/dependencySatisfies/.test(code), `dependencySatisfies should not be in the output: ${code}`);
      assert.ok(!/@embroider\/macros/.test(code), `entire import statement should not be in the output: ${code}`);
    });

    test('non call error', function(assert) {
      assert.throws(() => {
        transform(`
          import { dependencySatisfies } from '@embroider/macros';
          let x = dependencySatisfies;
        `);
      }, /You can only use dependencySatisfies as a function call/);
    });

    test('args length error', function(assert) {
      assert.throws(() => {
        transform(`
          import { dependencySatisfies } from '@embroider/macros';
          dependencySatisfies('foo', 'bar', 'baz');
        `);
      }, /dependencySatisfies takes exactly two arguments, you passed 3/);
    });

    test('non literal arg error', function(assert) {
      assert.throws(() => {
        transform(`
          import { dependencySatisfies } from '@embroider/macros';
          let name = 'qunit';
          dependencySatisfies(name, '*');
        `);
      }, /the first argument to dependencySatisfies must be a string literal/);
    });
  });
});
