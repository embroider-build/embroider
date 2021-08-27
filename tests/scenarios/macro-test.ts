import { appScenarios, appReleaseScenario, addonScenarios } from './scenarios';
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

function scenarioSetup(project: Project) {
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
}

appScenarios
  .map('macro-tests', project => {
    scenarioSetup(project);
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
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
    });
  });

appReleaseScenario
  .map('macro-babel-cache-busting', project => {
    scenarioSetup(project);
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
        updateLodashVersion(app, '4.0.0');
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

addonScenarios
  .map('macro-sample-addon', project => {
    let addonFiles = loadFromFixtureData('macro-sample-addon');
    project.name = 'macro-sample-addon';
    project.linkDependency('@embroider/macros', { baseDir: __dirname });
    project.linkDependency('@embroider/webpack', { baseDir: __dirname });
    project.linkDependency('@embroider/compat', { baseDir: __dirname });
    project.linkDependency('@embroider/core', { baseDir: __dirname });

    addonFiles['index.js'] = `
    module.exports = {
      name: require('./package').name,
      options: {
        '@embroider/macros': {
          setOwnConfig: {
            hello: 'world',
          },
        },
      },
      included(app) {
        app.options.autoRun = false;
        this._super.included.apply(this, arguments);
      },
      contentFor(type, config, contents) {
        if (type === 'config-module') {
          const originalContents = contents.join('');
          contents.splice(0, contents.length);
          contents.push(
            'let config = function() {' + originalContents + '}()',
            "config.default.APP.fromConfigModule = 'hello new world';",
            'return config;'
          );
          return;
        }

        if (type === 'app-boot') {
          let appSuffix = 'app';
          let prefix = config.modulePrefix;
          let configAppAsString = JSON.stringify(config.APP || {});
          return [
            'if (!runningTests) {',
            "  require('{{MODULE_PREFIX}}/" + appSuffix + "')['default'].create({{CONFIG_APP}});",
            '}',
            'window.LoadedFromCustomAppBoot = true',
          ]
            .join('')
            .replace(/\{\{MODULE_PREFIX\}\}/g, prefix)
            .replace(/\{\{CONFIG_APP\}\}/g, configAppAsString);
        }
      },
    };`;

    merge(project.files, addonFiles);
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let addon: PreparedApp;

      hooks.before(async () => {
        addon = await scenario.prepare();
      });

      test(`yarn test`, async function (assert) {
        let result = await addon.execute('yarn test');
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`yarn test EMBROIDER_TEST_SETUP_FORCE=classic`, async function (assert) {
        let result = await addon.execute('cross-env EMBROIDER_TEST_SETUP_FORCE=classic yarn test');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
