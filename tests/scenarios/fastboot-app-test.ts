import { appScenarios } from './scenarios';
import { PreparedApp, Project } from 'scenario-tester';
import { setupFastboot } from './helpers';
import QUnit from 'qunit';
import merge from 'lodash/merge';
const { module: Qmodule, test } = QUnit;

appScenarios
  .map('dynamic-import', project => {
    let sampleLib = new Project('@embroider/sample-lib', '0.0.0');
    merge(sampleLib.files, {
      'index.js': `export default function () {
        return 'From sample-lib';
      }`,
    });

    project.addDependency(sampleLib);
    project.linkDependency('ember-cli-fastboot', { baseDir: __dirname });
    project.linkDependency('fastboot', { baseDir: __dirname });
    project.linkDependency('fastboot-addon', { baseDir: __dirname });

    // this fixes: Cannot find module 'abortcontroller-polyfill/dist/cjs-ponyfill'
    project.removeDependency('ember-fetch');

    merge(project.files, {
      app: {
        components: {
          'check-service.hbs': `
            <div data-test="check-service">
              {{#if this.message}}
              {{this.message}}
              {{else}}
              No service present
              {{/if}}
            </div>
            <div data-test="check-addon-file">
              {{#if this.addonFileValue}}
              {{this.addonFileValue}}
              {{else}}
              No addon file value
              {{/if}}
            </div>
          `,
          'check-service.js': `
            import Component from '@glimmer/component';
            import { getOwner } from '@ember/application';

            export default class CheckServiceComponent extends Component {
              constructor(...args) {
                super(...args);
                let service = getOwner(this).lookup('service:apps-fastboot-only');
                if (service) {
                  this.message = service.message;
                }
                /* global requirejs, require */
                if (requirejs.entries['from-fastboot-addon-sample']) {
                  this.addonFileValue = require('from-fastboot-addon-sample').default;
                }
              }
            }
          `,
          'example.hbs': `
            <div data-test="example">{{this.message}}</div>
          `,
          'example.js': `
            import Component from '@glimmer/component';
            import { message } from '../lib/switchable';
            export default class extends Component {
              message = message;
            }
          `,
          'lazy-component.hbs': `
            <div data-test="lazy-component">{{this.message}}</div>
          `,
          'lazy-component.js': `
            import Component from '@glimmer/component';
            import { inject } from '@ember/service';
            import { tracked } from '@glimmer/tracking';

            export default class LazyComponent extends Component {
              @inject fastboot;
              @tracked message = 'loading...';

              constructor(...args) {
                super(...args);
                if (this.fastboot.isFastBoot) {
                  this.fastboot.deferRendering(this.loadLibrary());
                } else {
                  this.loadLibrary();
                }
              }

              async loadLibrary() {
                let library = (await import('@embroider/sample-lib')).default;
                this.message = library();
                window.lazyComponentDone = true;
              }
            }
          `,
        },
        lib: {
          'switchable.js': `
            export const message = 'This is the browser implementation';
          `,
        },
        routes: {
          'index.js': `
            import Route from '@ember/routing/route';
            import { inject as service } from '@ember/service';

            export default class IndexRoute extends Route {
              @service
              fastboot;

              beforeModel() {
                // This is only to to make sure we can correctly access the request's host, which fails if FastBoot's 'hostWhitelist'
                // is not correctly set up. This is the case when the changes added to /dist/package.json by FastBoot are not correctly
                // merged by Embroider. So this serves as a reproduction of https://github.com/embroider-build/embroider/issues/160
                return this.fastboot.isFastBoot ? this.fastboot.request.host : null;
              }
            }
          `,
        },
        templates: {
          'index.hbs': `
            <div data-test="hello">Hello from fastboot-app</div>
            <Example />
            <AddonExample />
            <CheckService />
            <LazyComponent />
          `,
        },
      },
      fastboot: {
        lib: {
          'switchable.js': `
            export const message = 'This is the server implementation';
          `,
        },
        services: {
          'apps-fastboot-only.js': `
            import Service from '@ember/service';

            export default class AppsFastbootOnlyService extends Service {
              message = "I'm a fastboot-only service in the app";
            }
          `,
        },
      },
      tests: {
        acceptance: {
          'basic-test.js': `
            import { module, test } from 'qunit';
            import { visit, waitUntil } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';

            module('Acceptance | runtime basics', function (hooks) {
              setupApplicationTest(hooks);

              hooks.beforeEach(async function () {
                await visit('/');
                await waitUntil(() => window.lazyComponentDone);
              });

              test('content is rendered', function (assert) {
                assert.dom('[data-test="hello"]').containsText('Hello from fastboot-app');
              });

              test('found browser implementation of in-app module', function (assert) {
                assert.dom('[data-test="example"]').containsText('This is the browser implementation');
              });

              test('found browser implementation of addon service', function (assert) {
                assert.dom('[data-test="addon-example"]').containsText('Browser AddonExampleService');
              });

              test('found no fastboot-only service from the app', function (assert) {
                assert.dom('[data-test="check-service"]').containsText('No service present');
              });

              test('found no fastboot-only file from the addon', function (assert) {
                assert.dom('[data-test="check-addon-file"]').containsText('No addon file value');
              });

              test('a component lazily loaded some code', async function (assert) {
                assert.dom('[data-test="lazy-component"]').containsText('From sample-lib');
              });
            });
          `,
        },
      },
      'ember-cli-build.js': `
        'use strict';

        const EmberApp = require('ember-cli/lib/broccoli/ember-app');

        module.exports = function(defaults) {
          let app = new EmberApp(defaults, {});

          const Webpack = require('@embroider/webpack').Webpack;
          return require('@embroider/compat').compatBuild(app, Webpack, {
            skipBabel: [{
              package: 'qunit'
            }],
          });
        };
      `,
      config: {
        'environment.js': `
          'use strict';

          module.exports = function (environment) {
            let ENV = {
              modulePrefix: 'app-template',
              environment,
              rootURL: '/',
              locationType: 'auto',
              EmberENV: {
                FEATURES: {
                  // Here you can enable experimental features on an ember canary build
                  // e.g. EMBER_NATIVE_DECORATOR_SUPPORT: true
                },
                EXTEND_PROTOTYPES: {
                  // Prevent Ember Data from overriding Date.parse.
                  Date: false,
                },
              },
              fastboot: {
                hostWhitelist: ['localhost:4200'],
              },
              APP: {
                // Here you can pass flags/options to your application instance
                // when it is created
              },
            };

            if (environment === 'development') {
              // ENV.APP.LOG_RESOLVER = true;
              // ENV.APP.LOG_ACTIVE_GENERATION = true;
              // ENV.APP.LOG_TRANSITIONS = true;
              // ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
              // ENV.APP.LOG_VIEW_LOOKUPS = true;
            }

            if (environment === 'test') {
              // Testem prefers this...
              ENV.locationType = 'none';

              // keep test console output quieter
              ENV.APP.LOG_ACTIVE_GENERATION = false;
              ENV.APP.LOG_VIEW_LOOKUPS = false;

              ENV.APP.rootElement = '#ember-testing';
              ENV.APP.autoboot = false;
            }

            if (environment === 'production') {
              // here you can enable a production-specific feature
            }

            return ENV;
          };
        `,
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`yarn test`, async function (assert) {
        let result = await app.execute('yarn test');
        assert.equal(result.exitCode, 0, result.output);
      });

      ['production', 'development'].forEach(env => {
        Qmodule(`fastboot: ${env}`, function (hooks) {
          let visit: any;
          let doc: any;

          hooks.before(async () => {
            ({ visit } = await setupFastboot(app, env));
            doc = (await visit('/')).window.document;
          });

          test('content is rendered', async function (assert) {
            assert.equal(doc.querySelector('[data-test="hello"]').textContent, 'Hello from fastboot-app');
          });
          test('found server implementation of in-app module', async function (assert) {
            assert.equal(doc.querySelector('[data-test="example"]').textContent, 'This is the server implementation');
          });
          test('found server implementation of addon service', async function (assert) {
            assert.equal(doc.querySelector('[data-test="addon-example"]').textContent, 'Server AddonExampleService');
          });
          test('found fastboot-only service from the app', async function (assert) {
            assert.equal(
              doc.querySelector('[data-test="check-service"]').textContent.trim(),
              `I'm a fastboot-only service in the app`
            );
          });
          test('found fastboot-only file from the addon', async function (assert) {
            assert.equal(doc.querySelector('[data-test="check-addon-file"]').textContent.trim(), '42');
          });
          test('a component successfully lazy loaded some code', async function (assert) {
            assert.equal(doc.querySelector('[data-test="lazy-component"]').textContent.trim(), 'From sample-lib');
          });
        });
      });
    });
  });
