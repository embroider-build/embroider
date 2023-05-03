import { appScenarios, baseAddon } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { loadFromFixtureData } from './helpers';
import { join } from 'path';
import fs from 'fs';
const { module: Qmodule, test } = QUnit;

appScenarios
  .map('preprocess', project => {
    let preprocessAddon = baseAddon();

    merge(preprocessAddon.files, loadFromFixtureData('preprocess-addon'));
    preprocessAddon.linkDependency('broccoli-funnel', { baseDir: __dirname });
    preprocessAddon.linkDependency('broccoli-persistent-filter', { baseDir: __dirname });
    preprocessAddon.pkg.name = 'preprocess-addon';

    project.addDevDependency(preprocessAddon);
    merge(project.files, {
      app: {
        styles: {
          'app.css': `body { background: %%%; }`,
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function () {
      test(`pnpm test`, async function (assert) {
        let app: PreparedApp = await scenario.prepare();
        await app.execute('node ./node_modules/ember-cli/bin/ember b');

        const data = fs.readFileSync(join(app.dir, 'dist', 'assets', 'app-template.css'), 'utf8');
        assert.equal(data, 'body { background: red; }');
      });
    });
  });
