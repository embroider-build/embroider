import { appScenarios, baseAddon } from './scenarios';
import { PreparedApp, Project } from 'scenario-tester';
import { setupFastboot, loadFromFixtureData } from './helpers';
import QUnit from 'qunit';
import merge from 'lodash/merge';
const { module: Qmodule, test } = QUnit;

appScenarios
  .map('fastboot-app-test', project => {
    let sampleLib = new Project('@embroider/sample-lib', '0.0.0');
    merge(sampleLib.files, {
      'index.js': `export default function () {
        return 'From sample-lib';
      }`,
    });

    project.addDependency(sampleLib);
    project.linkDependency('ember-cli-fastboot', { baseDir: __dirname });
    project.linkDependency('fastboot', { baseDir: __dirname });
    project.linkDependency('@embroider/util', { baseDir: __dirname });

    let fastbootAddon = baseAddon();

    fastbootAddon.pkg.name = 'fastboot-addon';
    merge(fastbootAddon.files, loadFromFixtureData('fastboot-addon'));
    project.addDependency(fastbootAddon);

    // this fixes: Cannot find module 'abortcontroller-polyfill/dist/cjs-ponyfill'
    project.removeDependency('ember-fetch');

    merge(project.files, loadFromFixtureData('fastboot-app'));
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      ['production', 'development'].forEach(env => {
        test(`yarn test: ${env}`, async function (assert) {
          let result = await app.execute('yarn test');
          assert.equal(result.exitCode, 0, result.output);
        });

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
          test('ensureSafeComponent works', async function (assert) {
            assert.equal(doc.querySelector('[data-safe-component]').textContent, 'Safe Component here!!');
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
