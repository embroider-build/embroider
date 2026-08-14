import path from 'path';
import { Scenarios } from 'scenario-tester';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import { readFileSync } from 'fs';
import { v2AddonForSourceMapTesting } from './scenarios';
import { assertTemplateVariableMapsToSource } from './helpers/source-maps';

const { module: Qmodule, test } = QUnit;

Scenarios.fromProject(() => v2AddonForSourceMapTesting())
  .map('v2-addon-dev-sourcemap', () => {})
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let addon: PreparedApp;

      hooks.before(async () => {
        addon = await scenario.prepare();
        let result = await addon.execute('pnpm build');
        if (result.exitCode !== 0) {
          throw new Error(result.output);
        }
      });

      test('gjs template-scoped variable maps back to its original source', function (assert) {
        assertTemplateVariableMapsToSource(assert, {
          rawMap: readMap(addon.dir, 'dist/components/addon-gjs-demo.js.map'),
          originalFile: 'addon-gjs-demo.gjs',
          variable: 'addonGjsScopedValue',
          label: 'addon-gjs-demo.js.map',
        });
      });

      test('gts template-scoped variable maps back to its original source', function (assert) {
        assertTemplateVariableMapsToSource(assert, {
          rawMap: readMap(addon.dir, 'dist/components/addon-gts-demo.js.map'),
          originalFile: 'addon-gts-demo.gts',
          variable: 'addonGtsScopedValue',
          label: 'addon-gts-demo.js.map',
        });
      });
    });
  });

function readMap(addonDir: string, distMapFile: string): unknown {
  return JSON.parse(readFileSync(path.join(addonDir, distMapFile), 'utf8'));
}
