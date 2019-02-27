import 'qunit';
import { allBabelVersions, runDefault } from './helpers';
import { MacrosConfig } from '..';
const { test } = QUnit;

allBabelVersions(function (transform: (code: string) => string, config: MacrosConfig) {
  QUnit.module(`getConfig`, function() {

    config.setOwnConfig(__filename, { beverage: 'coffee' });
    config.setConfig(__filename, '@babel/core', [1, 2, 3]);

    test(`returns correct value for own package's config`, function(assert) {
      let code = transform(`
      import { getOwnConfig } from '@embroider/macros';
      export default function() {
        return getOwnConfig();
      }
      `);
      assert.deepEqual(runDefault(code), { beverage: 'coffee' });
    });

    test(`returns correct value for another package's config`, function(assert) {
      let code = transform(`
      import { getConfig } from '@embroider/macros';
      export default function() {
        return getConfig('@babel/core');
      }
      `);
      assert.deepEqual(runDefault(code), [1,2,3]);
    });

    test(`returns undefined when there's no config but the package exists`, function(assert) {
      let code = transform(`
      import { getConfig } from '@embroider/macros';
      export default function() {
        return getConfig('qunit');
      }
      `);
      assert.equal(runDefault(code), undefined);
    });

    test(`returns undefined when there's no such package`, function(assert) {
      let code = transform(`
      import { getConfig } from '@embroider/macros';
      export default function() {
        return getConfig('not-a-thing');
      }
      `);
      assert.equal(runDefault(code), undefined);
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
