import { wideAppScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
const { module: Qmodule, test } = QUnit;

// this test is being used as a "smoke test" to check the widest possible support matrix
wideAppScenarios
  .map('static-app-former-implicit-addons', project => {
    project.linkDevDependency('bootstrap', { baseDir: __dirname });
    project.linkDevDependency('@embroider/macros', { baseDir: __dirname });
    project.linkDevDependency('ember-modifier', { baseDir: __dirname });
    project.linkDevDependency('@ember/string', { baseDir: __dirname, resolveName: '@ember/string-4' });

    merge(project.files, {
      app: {
        components: {
          'box.js': `
            import Component from '@glimmer/component';
            import { camelize } from '@ember/string';

            export default class FancyBox extends Component {
              get camelizedTitle() {
                return camelize(this.args.title);
              }
            }
          `,
          'box.hbs': `{{this.camelizedTitle}}`,
        },
      },
      tests: {
        integration: {
          components: {
            'box-test.js': `
              import { module, test } from 'qunit';
              import { setupRenderingTest } from 'app-template/tests/helpers';
              import { render } from '@ember/test-helpers';
              import { hbs } from 'ember-cli-htmlbars';

              module('Rendering | <Box />', function (hooks) {
                setupRenderingTest(hooks);

                test('it renders', async function (assert) {
                  await render(hbs('<Box @title="i-want-to-be-camel-case" />'));
                  assert.dom().containsText('iWantToBeCamelCase');
                });
              });`,
          },
        },
      },
      'ember-cli-build.js': `
        'use strict';

        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { MacrosConfig } = require('@embroider/macros/src/node');

        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {
          });

          MacrosConfig.for(app).setOwnConfig(__filename, {
            isClassic: Boolean(process.env.CLASSIC),
          });

          if (process.env.CLASSIC) {
            return app.toTree();
          }

          const { compatBuild, recommendedOptions } = require('@embroider/compat');

          const Webpack = require('@embroider/webpack').Webpack;
          return compatBuild(app, Webpack, {
            ...recommendedOptions.optimized,
            skipBabel: [
              { package: 'qunit' },
              { package: 'macro-decorators' },
            ],
          });
        };
      `,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      ['production', 'development'].forEach(env => {
        test(`pnpm test: ${env}`, async function (assert) {
          let result = await app.execute(`cross-env EMBER_ENV=${env} pnpm test`);
          assert.equal(result.exitCode, 0, result.output);
        });
      });
    });
  });
