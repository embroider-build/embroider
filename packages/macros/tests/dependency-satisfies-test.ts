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

  });
});
