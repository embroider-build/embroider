import { appScenarios } from './scenarios';
import { PreparedApp, Project } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { setupFastboot, loadFromFixtureData } from './helpers';
import { dirname } from 'path';
const { module: Qmodule, test } = QUnit;

appScenarios
  .map('engines', project => {
    let eagerEngine = Project.fromDir(dirname(require.resolve('../addon-template/package.json')), { linkDeps: true });
    let lazyEngine = Project.fromDir(dirname(require.resolve('../addon-template/package.json')), { linkDeps: true });
    let macroSampleAddon = Project.fromDir(dirname(require.resolve('../addon-template/package.json')), {
      linkDeps: true,
    });

    merge(eagerEngine.files, loadFromFixtureData('eager-engine'));
    merge(lazyEngine.files, loadFromFixtureData('lazy-engine'));
    merge(macroSampleAddon.files, loadFromFixtureData('macro-sample-addon'));

    eagerEngine.pkg['ember-addon'] = {
      configPath: 'tests/dummy/config',
      paths: ['lib/eager-engine-helper'],
    };

    macroSampleAddon.pkg.name = 'macro-sample-addon';
    eagerEngine.pkg.name = 'eager-engine';
    eagerEngine.pkg.peerDependencies = { 'ember-engines': '0.8.5' };
    lazyEngine.pkg.name = 'lazy-engine';
    lazyEngine.pkg.peerDependencies = { 'ember-engines': '0.8.5' };

    project.pkg['ember-addon'] = {
      paths: ['lib/lazy-in-repo-engine'],
    };

    eagerEngine.pkg['keywords'] = ['ember-engine', 'ember-addon'];
    lazyEngine.pkg['keywords'] = ['ember-engine', 'ember-addon'];

    lazyEngine.addDependency(macroSampleAddon);
    project.addDevDependency(eagerEngine);
    project.addDevDependency(lazyEngine);

    project.linkDependency('ember-cli-fastboot', { baseDir: __dirname });
    project.linkDependency('fastboot', { baseDir: __dirname });
    project.linkDependency('ember-truth-helpers', { baseDir: __dirname });
    project.linkDependency('ember-engines', { baseDir: __dirname });
    eagerEngine.linkDependency('ember-truth-helpers', { baseDir: __dirname });
    eagerEngine.linkDependency('ember-engines', { baseDir: __dirname });
    lazyEngine.linkDependency('ember-truth-helpers', { baseDir: __dirname });
    lazyEngine.linkDependency('ember-engines', { baseDir: __dirname });
    macroSampleAddon.linkDependency('@embroider/macros', { baseDir: __dirname });

    let engineTestFiles = loadFromFixtureData('engines-test');
    merge(project.files, engineTestFiles);
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

          hooks.before(async () => {
            ({ visit } = await setupFastboot(app, env));
          });

          test('host-app', async function (assert) {
            let doc = await visit('/');
            assert.equal(
              doc.querySelector('[data-test-duplicated-helper]').textContent.trim(),
              'from-engines-host-app'
            );
          });

          test('lazy-engine', async function (assert) {
            let doc = await visit('/use-lazy-engine');
            assert.equal(doc.querySelector('[data-test-lazy-engine-main] > h1').textContent.trim(), 'Lazy engine');
            assert.equal(doc.querySelector('[data-test-duplicated-helper]').textContent.trim(), 'from-lazy-engine');
          });

          test('eager-engine', async function (assert) {
            let doc = await visit('/use-eager-engine');
            assert.equal(doc.querySelector('[data-test-eager-engine-main] > h1').textContent.trim(), 'Eager engine');
            assert.equal(
              doc.querySelector('[data-test-duplicated-helper]').textContent.trim(),
              'from-eager-engine-helper'
            );
          });
        });
      });
    });
  });
