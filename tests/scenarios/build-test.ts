import { appScenarios } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { join } from 'path';
import { loadFromFixtureData } from './helpers';
import fs from 'fs-extra';
const { module: Qmodule, test } = QUnit;

appScenarios
  .map('html-attributes-tests', project => {
    merge(project.files, loadFromFixtureData('html-attributes-app'));
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`index.html contains custom attributes`, async function (assert) {
        let result = await app.execute(`cross-env THROW_UNLESS_PARALLELIZABLE=1 yarn build:production`);
        assert.equal(result.exitCode, 0, result.output);

        let fileContents = fs.readFileSync(join(app.dir, 'dist', 'index.html'));

        assert.ok(fileContents.includes('data-testid="custom-vendor-style-attr"'), 'custom attr for vendor style');
        assert.ok(fileContents.includes('data-testid="custom-app-style-attr"'), 'custom attr for app style');
        assert.ok(fileContents.includes('data-testid="custom-vendor-script-attr"'), 'custom attr for vendor script');
        assert.ok(fileContents.includes('data-testid="custom-app-script-attr"'), 'custom attr for app script');
      });
    });
  });
