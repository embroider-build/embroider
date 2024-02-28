import { appScenarios, baseAddon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { loadFromFixtureData } from './helpers';
import { expectFilesAt } from '@embroider/test-support/file-assertions/qunit';
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
        let result = await app.execute('npm run build');
        assert.equal(result.exitCode, 0, result.output);
        let expectFile = expectFilesAt(app.dir, { qunit: assert });
        // TODO find the css in the new output and check its content
        expectFile('./dist/assets/app-template.css').matches('body { background: red; }');
      });
    });
  });
