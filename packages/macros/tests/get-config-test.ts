import 'qunit';
import { allBabelVersions, runDefault } from './helpers';
import { GlobalConfig } from '..';
const { test } = QUnit;

allBabelVersions(function (transform: (code: string) => string, config: GlobalConfig) {
  QUnit.module(`getConfig`, function() {

    config.setConfig(__filename, '@embroider/macros', { beverage: 'coffee' });

    test(`returns correct value for own package's config`, function(assert) {
      let code = transform(`
      import { getConfig } from '@embroider/macros';
      export default function() {
        return getConfig('@embroider/macros');
      }
      `);
      assert.deepEqual(runDefault(code), { beverage: 'coffee' });
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
