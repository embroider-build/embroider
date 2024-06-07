import { appScenarios, dummyAppScenarios, baseAddon } from './scenarios';
import type { PreparedApp, Project } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { join } from 'path';
import { loadFromFixtureData } from './helpers';
import fs from 'fs-extra';
const { module: Qmodule, test } = QUnit;

function updateVersionChanger(app: PreparedApp, version: string) {
  let pkgJsonApp = fs.readJsonSync(join(app.dir, 'package.json'));
  let pkgJsonLib = fs.readJsonSync(join(app.dir, 'node_modules', 'version-changer', 'package.json'));

  pkgJsonApp.devDependencies['version-changer'] = version;
  pkgJsonLib.version = version;

  fs.writeJsonSync(join(app.dir, 'package.json'), pkgJsonApp);
  fs.writeJsonSync(join(app.dir, 'node_modules', 'version-changer', 'package.json'), pkgJsonLib);
}

function scenarioSetup(project: Project) {
  let macroSampleAddon = baseAddon();
  let funkySampleAddon = baseAddon();

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
  project.addDevDependency('version-changer', '4.0.0');
  project.linkDevDependency('webpack', { baseDir: __dirname });

  project.addDevDependency(macroSampleAddon);
  project.addDevDependency(funkySampleAddon);

  project.addDependency('cjs-example-lib', {
    files: {
      'named.js': `
      exports.hello = function() { return "hello worked" };
    `,
      'default.js': `
      module.exports = function() { return "default worked" };
    `,
    },
  });

  project.mergeFiles({
    tests: {
      unit: {
        'import-sync-test.js': `
          import { module, test } from 'qunit';
          import { importSync } from '@embroider/macros';

          module('Unit | Macro | importSync', function () {
            test('cjs interop for default export', async function (assert) {
              let mod = importSync("cjs-example-lib/default");
              assert.strictEqual(mod.default(), "default worked");
            });

            test('cjs interop for named export', async function (assert) {
              let mod = importSync("cjs-example-lib/named");
              assert.strictEqual(mod.hello(), "hello worked");
            });
          });
      `,
      },
    },
  });
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

      test(`pnpm test`, async function (assert) {
        let result = await app.execute(`pnpm test`, {
          env: {
            THROW_UNLESS_PARALLELIZABLE: '1',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`pnpm build production`, async function (assert) {
        let result = await app.execute(`pnpm build`, {
          env: {
            THROW_UNLESS_PARALLELIZABLE: '1',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });

appScenarios
  .map('macro-tests-classic', project => {
    scenarioSetup(project);
    merge(project.files, loadFromFixtureData('macro-test-classic'));
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`EMBROIDER_TEST_SETUP_FORCE=classic pnpm test`, async function (assert) {
        // throw_unless_parallelizable is enabled to ensure that @embroider/macros is parallelizable
        let result = await app.execute(`pnpm ember test`, {
          env: {
            THROW_UNLESS_PARALLELIZABLE: '1',
            EMBROIDER_TEST_SETUP_FORCE: 'classic',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });

appScenarios
  .only('canary')
  .map('macro-babel-cache-busting', project => {
    scenarioSetup(project);
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`@embroider/macros babel caching plugin works`, async function (assert) {
        let fourRun = await app.execute(`pnpm test`);
        assert.equal(fourRun.exitCode, 0, fourRun.output);

        // simulate a different version being installed
        updateVersionChanger(app, '3.0.0');

        let lodashThreeRun = await app.execute(`cross-env EXPECTED_VERSION=three pnpm test`);
        assert.equal(lodashThreeRun.exitCode, 0, lodashThreeRun.output);
      });
    });
  });

appScenarios
  .only('canary')
  .map('macro-babel-cache-busting-classic', project => {
    scenarioSetup(project);
    merge(project.files, loadFromFixtureData('macro-test-classic'));
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`EMBROIDER_TEST_SETUP_FORCE=classic @embroider/macros babel caching plugin works`, async function (assert) {
        updateVersionChanger(app, '4.0.1');

        let lodashFourRun = await app.execute(`cross-env EMBROIDER_TEST_SETUP_FORCE=classic pnpm ember test`);
        assert.equal(lodashFourRun.exitCode, 0, lodashFourRun.output);

        // simulate a different version being installed
        updateVersionChanger(app, '3.0.0');

        let lodashThreeRun = await app.execute(
          `cross-env EXPECTED_VERSION=three EMBROIDER_TEST_SETUP_FORCE=classic pnpm ember test`
        );
        assert.equal(lodashThreeRun.exitCode, 0, lodashThreeRun.output);
      });
    });
  });

function dummyAppScenarioSetup(project: Project) {
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
      // This if block is used only by macro-sample-addon-classic, which does not build with Embroider.
      // When building with Embroider, the responsibility for the config is moved to the app.
      // Therefore, macro-sample-addon scenario defines 'fromConfigModule' differently using fixtures.
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
          'window.LoadedFromClassicCustomAppBoot = true',
        ]
          .join('')
          .replace(/\{\{MODULE_PREFIX\}\}/g, prefix)
          .replace(/\{\{CONFIG_APP\}\}/g, configAppAsString);
      }
    },
  };`;

  merge(project.files, addonFiles);
}

dummyAppScenarios
  .map('macro-sample-addon', project => {
    dummyAppScenarioSetup(project);
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let addon: PreparedApp;

      hooks.before(async () => {
        addon = await scenario.prepare();
      });

      test(`pnpm test`, async function (assert) {
        let result = await addon.execute('pnpm test');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });

dummyAppScenarios
  .map('macro-sample-addon-classic', project => {
    dummyAppScenarioSetup(project);
    merge(project.files, loadFromFixtureData('macro-sample-addon-classic'));
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let addon: PreparedApp;

      hooks.before(async () => {
        addon = await scenario.prepare();
      });

      test(`pnpm test EMBROIDER_TEST_SETUP_FORCE=classic`, async function (assert) {
        let result = await addon.execute('cross-env EMBROIDER_TEST_SETUP_FORCE=classic pnpm ember test');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });

dummyAppScenarios
  .map('macro-sample-addon-useAddonAppBoot', project => {
    dummyAppScenarioSetup(project);
    project.mergeFiles({
      'ember-cli-build.js': `
        'use strict';
        const EmberAddon = require('ember-cli/lib/broccoli/ember-addon');
        const { maybeEmbroider } = require('@embroider/test-setup');
        module.exports = function(defaults) {
          let app = new EmberAddon(defaults, {});
          return maybeEmbroider(app, {
            useAddonAppBoot: true,
          });
        };
      `,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let addon: PreparedApp;

      hooks.before(async () => {
        addon = await scenario.prepare();
      });

      test(`pnpm test`, async function (assert) {
        let result = await addon.execute('pnpm test');
        assert.equal(result.exitCode, 1, 'tests exit with errors');
        assert.true(
          result.output.includes(`Your app uses at least one classic addon that provides content-for 'app-boot'.`),
          'the output contains the error message about migrating custom app-boot code'
        );
      });
    });
  });
