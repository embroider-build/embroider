import { appScenarios } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
const { module: Qmodule, test } = QUnit;

appScenarios
  .skip('lts_3_16')
  .skip('lts_3_24')
  .map('static-strict-app', project => {
    project.linkDevDependency('ember-template-imports', { baseDir: __dirname });
    project.linkDevDependency('ember-cli-htmlbars', { baseDir: __dirname, resolveName: 'ember-cli-htmlbars-6' });

    merge(project.files, {
      app: {
        components: {
          'stict-mode.gjs': `
            // https://github.com/embroider-build/embroider/issues/1249
            import { array, component } from '@ember/helper';

            const join = (segments) => segments.join('.');

            const SidebarItem = <template>
              <li id={{join (array @prefix @id)}}>{{@title}}</li>
            </template>

            const SidebarCategory = <template>
              <li>{{@title}}</li>
              {{yield (component SidebarItem prefix=@id)}}
            </template>

            <template>
              <ul>
                <SidebarCategory @title="test" @id="test" as |Item|>
                  <Item @title="a" @id="a" />
                  <Item @title="b" @id="b" />
                </SidebarCategory>
              </ul>
            </template>
          `,
        },
      },
      config: {
        /**
         * This override is mostly to omit IE11
         */
        'targets.js': `
          'use strict';

          module.exports = { browsers: 'last 1 Firefox versions' };
        `,
      },
      tests: {
        rendering: {
          'strict-mode-test.gjs': `
            import { module, test } from 'qunit';
            import { setupRenderingTest } from 'ember-qunit';

            import TheComponent from 'app-template/components/strict-mode';

            module('Rendering | strict-mode (gjs)', function(hooks) {
              setupRenderingTest(hooks);

              test('it works', async function(assert) {
                // <template> not needed for the test pass.
                // render(TheComponent) would work,
                // but we want to test the gjs transform as well.
                await render(
                  <template>
                    <TheComponent />
                  </template>
                );
              });

              assert.dom('ul').exists();
              assert.dom('li').exists({ count: 3 });
            });
          `,
          'normal-test-using-strict-mode.js': `
            import { module, test } from 'qunit';
            import { setupRenderingTest } from 'ember-qunit';

            module('Rendering | strict-mode (js)', function(hooks) {
              setupRenderingTest(hooks);

              test('it works', async function(assert) {
                await render(hbs\`<StrictMode />\`);

                assert.dom('ul').exists();
                assert.dom('li').exists({ count: 3 });
              });

              assert.dom('ul').exists();
              assert.dom('li').exists({ count: 3 });
            });
          `,
        },
      },
      'ember-cli-build.js': `
        'use strict';

        const EmberApp = require('ember-cli/lib/broccoli/ember-app');

        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {
            // options here
          });

          const Webpack = require('@embroider/webpack').Webpack;
          return require('@embroider/compat').compatBuild(app, Webpack, {
            workspaceDir: process.env.WORKSPACE_DIR,
            staticAddonTestSupportTrees: true,
            staticAddonTrees: true,
            staticComponents: true,
            staticHelpers: true,
            staticModifiers: true,
            packageRules: [
            ],
            skipBabel: [
              { package: 'qunit' },
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
        test(`yarn test: ${env}`, async function (assert) {
          let result = await app.execute(`cross-env EMBER_ENV=${env} yarn test`);
          assert.equal(result.exitCode, 0, result.output);
        });
      });
    });
  });
