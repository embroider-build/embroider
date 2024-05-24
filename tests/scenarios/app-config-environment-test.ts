import merge from 'lodash/merge';
import CommandWatcher from './helpers/command-watcher';
import { appScenarios } from './scenarios';
import fetch from 'node-fetch';
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
            ...(process.env.FORCE_BUILD_TESTS ? {
              tests: true,
            } : undefined),
          });
          return maybeEmbroider(app, {});
        };
      `,
      config: {
        'environment.js': `
          module.exports = function(environment) {
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
              'legacy-config-format': 'production',
            };

            if (environment === 'development') {
              ENV['legacy-config-format'] = 'development';
            };

            if (environment === 'test') {
              ENV.locationType = 'none';
              ENV.APP.LOG_ACTIVE_GENERATION = false;
              ENV.APP.LOG_VIEW_LOOKUPS = false;
              ENV.APP.rootElement = '#ember-testing';
              ENV.APP.autoboot = false;

              ENV['legacy-config-format'] = 'test';
            };

            return ENV;
          };
        `,
      },
      app: {
        config: {
          'environment.js': `
          import { macroCondition, isDevelopingApp, isTesting } from '@embroider/macros';

          const ENV = {
            modulePrefix: 'app-template',
            rootURL: '/',
            locationType: 'history',
            EmberENV: {
              EXTEND_PROTOTYPES: false,
              FEATURES: {
                // Here you can enable experimental features on an ember canary build
                // e.g. EMBER_NATIVE_DECORATOR_SUPPORT: true
              },
            },

            APP: {
              // Here you can pass flags/options to your application instance
              // when it is created
            },

            // CUSTOM
            'new-config-format': 'production',
          };

          if (macroCondition(isDevelopingApp())) {
            // CUSTOM
            ENV['new-config-format'] = 'development';
          }

          if (macroCondition(isTesting())) {
            // Testem prefers this...
            ENV.locationType = 'none';

            // keep test console output quieter
            ENV.APP.LOG_ACTIVE_GENERATION = false;
            ENV.APP.LOG_VIEW_LOOKUPS = false;

            ENV.APP.rootElement = '#ember-testing';
            ENV.APP.autoboot = false;

            // CUSTOM
            ENV['new-config-format'] = 'test';
          }

          export default ENV;`,
        },
        controllers: {
          'application.js': `
          import Controller from '@ember/controller';
          import config from '../config/environment';

          export default class ApplicationController extends Controller {
            config = config;

            get configValue() {
              console.log(this.config);
              return this.config['new-config-format'];
            }
          }
          `,
        },
        templates: {
          'application.hbs': `
            <p>new-config-format: {{this.configValue}}</p>
          `,
        },
      },
      tests: {
        unit: {
          'config-test.js': `
            import { module, test } from 'qunit';
            import ENV from 'app-template/config/environment';

            module('Unit | it loads the config', function (hooks) {
              test('it has loaded the correct config values', async function (assert) {
                assert.equal(ENV['new-config-format'], 'test');
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

      test(`environement config v2 is imported and correct: test mode`, async function (assert) {
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

      test('environement config v2 is imported and correct: dev mode', async function (assert) {
        const server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
        try {
          const [, url] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);
          let response = await fetch(`${url}/`);
          let text = await response.text();
          assert.true(text.includes('development'));
        } finally {
          await server.shutdown();
        }
      });
    });
  });
