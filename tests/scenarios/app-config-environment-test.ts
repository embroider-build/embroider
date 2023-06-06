import merge from 'lodash/merge';
import { appScenarios } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';

const { module: Qmodule, test } = QUnit;

appScenarios
  .only('release')
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
            modulePrefix: 'my-app',
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
          };

          // CUSTOM
          ENV.someCustomField = true;
          return ENV;
        };`,
      },
      tests: {
        unit: {
          'store-config-in-meta-test.js': `
            import { module, test } from 'qunit';
            import ENV from 'app-template/config/environment';

            module('Unit | storeConfigInMeta', function (hooks) {
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

      test(`yarn test ran with custom unit test`, async function (assert) {
        let result = await app.execute(`yarn test`);
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
