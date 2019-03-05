import 'qunit';
import { allBabelVersions, runDefault } from './helpers';
const { test } = QUnit;

allBabelVersions(function (transform) {
  QUnit.module(`moduleExists`, function() {

    test('finds module', function(assert) {
      let code = transform(`
      import { moduleExists } from '@embroider/macros';
      export default function() {
        return moduleExists('ember-cli/lib/broccoli/ember-app');
      }
      `);
      assert.equal(runDefault(code), true);
    });
  });
});

allBabelVersions(function (transform) {
  QUnit.module(`moduleExists classic`, function() {

    test('rewrites to runtime require.has', function(assert) {
      let code = transform(`
      import { moduleExists } from '@embroider/macros';
      export default function() {
        return moduleExists('ember-cli/lib/broccoli/ember-app');
      }
      `);
      let preamble = `
        let window = { require: { has(name){ return 'runtime check for ' + name; } } };
      `;
      assert.equal(runDefault(code, preamble), 'runtime check for ember-cli/lib/broccoli-ember-app');
    });
  });
}, { classicMode: true });
