import merge from 'lodash/merge';
import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';

const { module: Qmodule, test } = QUnit;

appScenarios
  .only('canary')
  .map('app-config-environment', project => {
    merge(project.files, {
      'ember-cli-build.js': `
        'use strict';

        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { maybeEmbroider } = require('@embroider/test-setup');

        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {
            tests: true,
            storeConfigInMeta: false,
          });
          return maybeEmbroider(app, {});
        };
      `,
      config: {
        'environment.js': `module.exports = function(environment) {
          // DEFAULT config/environment.js
          let ENV = {
            modulePrefix: 'app-template',
            environment,
            rootURL: '/',
            locationType: 'history',
            EmberENV: {
              EXTEND_PROTOTYPES: false,
              FEATURES: {},
            },
            APP: {},
          };

          if (environment === 'test') {
            ENV.locationType = 'none';
            ENV.APP.LOG_ACTIVE_GENERATION = false;
            ENV.APP.LOG_VIEW_LOOKUPS = false;
            ENV.APP.rootElement = '#ember-testing';
            ENV.APP.autoboot = false;

            // CUSTOM
            ENV.someCustomField = true;
          };

          return ENV;
        };`,
      },
      tests: {
        unit: {
          'store-config-in-meta-test.js': `
            import { module, test } from 'qunit';
            import ENV from 'app-template/config/environment';

            module('Unit | storeConfigInMeta set to false', function (hooks) {
              test('it has loaded the correct config values', async function (assert) {
                assert.equal(ENV.someCustomField, true);
              });
            });`,
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`ember test ran against dev build with custom unit test`, async function (assert) {
        // here we build the app with environment set to dev so that we can use
        // the build output directory as the input path to an `ember test` run
        // later. This difference in environment is important because it's the
        // only way for us to test ember-cli-build.js' `tests: true` behavior,
        // and is equivalent to visiting the app's /tests page
        let devBuildResult = await app.execute(`pnpm build`);
        assert.equal(devBuildResult.exitCode, 0, devBuildResult.output);
        let testRunResult = await app.execute(`pnpm test:ember --path dist`);
        assert.equal(testRunResult.exitCode, 0, testRunResult.output);
      });
    });
  });
