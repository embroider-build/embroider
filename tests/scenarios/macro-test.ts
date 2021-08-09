import { appScenarios } from './scenarios';
import { PreparedApp, Project } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { dirname, join } from 'path';
import { loadFromFixtureData } from './helpers';
import fs from 'fs-extra';
const { module: Qmodule, test } = QUnit;

function updateLodashVersion(app: PreparedApp, version: string) {
  let pkgJson = fs.readJsonSync(join(app.dir, 'package.json'));
  let pkgJsonLodash = fs.readJsonSync(join(app.dir, 'node_modules', 'lodash', 'package.json'));

  pkgJson.devDependencies.lodash = version;
  pkgJsonLodash.version = version;

  fs.writeJsonSync(join(app.dir, 'package.json'), pkgJson);
  fs.writeJsonSync(join(app.dir, 'node_modules', 'lodash', 'package.json'), pkgJsonLodash);
}

appScenarios
  .map('macro-tests', project => {
    let macroSampleAddon = Project.fromDir(dirname(require.resolve('../addon-template/package.json')), {
      linkDeps: true,
    });
    let funkySampleAddon = Project.fromDir(dirname(require.resolve('../addon-template/package.json')), {
      linkDeps: true,
    });

    macroSampleAddon.pkg.name = 'macro-sample-addon';
    funkySampleAddon.pkg.name = '@embroider/funky-sample-addon';

    merge(macroSampleAddon.files, loadFromFixtureData('macro-sample-addon'));
    merge(funkySampleAddon.files, loadFromFixtureData('funky-sample-addon'));
    merge(project.files, loadFromFixtureData('macro-test'));

    funkySampleAddon.linkDependency('broccoli-merge-trees', { baseDir: __dirname });
    funkySampleAddon.linkDependency('broccoli-funnel', { baseDir: __dirname });
    funkySampleAddon.linkDependency('@embroider/macros', { baseDir: __dirname });
    macroSampleAddon.linkDependency('@embroider/macros', { baseDir: __dirname });
    project.linkDevDependency('@embroider/macros', { baseDir: __dirname });
    project.linkDevDependency('lodash', { baseDir: __dirname });

    project.addDevDependency(macroSampleAddon);
    project.addDevDependency(funkySampleAddon);
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
        updateLodashVersion(app, '4.0.0');
      });

      test(`yarn test`, async function (assert) {
        let result = await app.execute(`cross-env THROW_UNLESS_PARALLELIZABLE=1 yarn test`);
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`yarn build production`, async function (assert) {
        let result = await app.execute(`cross-env THROW_UNLESS_PARALLELIZABLE=1 yarn build:production`);
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`CLASSIC=true yarn test`, async function (assert) {
        // throw_unless_parallelizable is enabled to ensure that @embroider/macros is parallelizable
        let result = await app.execute(`cross-env THROW_UNLESS_PARALLELIZABLE=1 CLASSIC=true yarn test`);
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`@embroider/macros babel caching plugin works`, async function (assert) {
        let lodashFourRun = await app.execute(`yarn test`);
        assert.equal(lodashFourRun.exitCode, 0, lodashFourRun.output);

        // simulate a different version being installed
        updateLodashVersion(app, '3.0.0');

        let lodashThreeRun = await app.execute(`cross-env LODASH_VERSION=three yarn test`);
        assert.equal(lodashThreeRun.exitCode, 0, lodashThreeRun.output);
      });

      test(`CLASSIC=true @embroider/macros babel caching plugin works`, async function (assert) {
        updateLodashVersion(app, '4.0.1');

        let lodashFourRun = await app.execute(`cross-env CLASSIC=true yarn test`);
        assert.equal(lodashFourRun.exitCode, 0, lodashFourRun.output);

        // simulate a different version being installed
        updateLodashVersion(app, '3.0.0');

        let lodashThreeRun = await app.execute(`cross-env LODASH_VERSION=three CLASSIC=true yarn test`);
        assert.equal(lodashThreeRun.exitCode, 0, lodashThreeRun.output);
      });
    });
  });
