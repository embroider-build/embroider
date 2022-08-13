import { appScenarios, baseAddon } from './scenarios';
import { PreparedApp, Project } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { setupFastboot, loadFromFixtureData } from './helpers';
import { dirname } from 'path';
const { module: Qmodule, test } = QUnit;

// Both ember-engines and its dependency ember-asset-loader have undeclared
// peerDependencies on ember-cli.
function emberEngines(): Project {
  let enginesPath = dirname(require.resolve('ember-engines/package.json'));
  let engines = Project.fromDir(enginesPath, { linkDeps: true });
  engines.pkg.peerDependencies = Object.assign(
    {
      'ember-cli': '*',
    },
    engines.pkg.peerDependencies
  );
  let assetLoader = Project.fromDir(dirname(require.resolve('ember-asset-loader', { paths: [enginesPath] })), {
    linkDeps: true,
  });
  assetLoader.pkg.peerDependencies = Object.assign(
    {
      'ember-cli': '*',
    },
    assetLoader.pkg.peerDependencies
  );
  engines.addDependency(assetLoader);
  return engines;
}

appScenarios
  .only('lts_3_28') // ember-engines doesn't have an ember 4.0 compatible release yet.
  .map('engines', project => {
    let eagerEngine = baseAddon();
    let lazyEngine = baseAddon();
    let macroSampleAddon = baseAddon();

    merge(eagerEngine.files, loadFromFixtureData('eager-engine'));
    merge(lazyEngine.files, loadFromFixtureData('lazy-engine'));
    merge(macroSampleAddon.files, loadFromFixtureData('macro-sample-addon'));

    eagerEngine.pkg['ember-addon'] = {
      configPath: 'tests/dummy/config',
      paths: ['lib/eager-engine-helper'],
    };

    macroSampleAddon.pkg.name = 'macro-sample-addon';
    eagerEngine.pkg.name = 'eager-engine';
    eagerEngine.pkg.peerDependencies = { 'ember-engines': '*' };
    lazyEngine.pkg.name = 'lazy-engine';
    lazyEngine.pkg.peerDependencies = { 'ember-engines': '*' };

    project.pkg['ember-addon'] = {
      paths: ['lib/lazy-in-repo-engine'],
    };

    eagerEngine.pkg['keywords'] = ['ember-engine', 'ember-addon'];
    lazyEngine.pkg['keywords'] = ['ember-engine', 'ember-addon'];

    lazyEngine.addDependency(macroSampleAddon);
    project.addDevDependency(eagerEngine);
    project.addDevDependency(lazyEngine);

    project.linkDependency('ember-truth-helpers', { baseDir: __dirname });
    project.linkDependency('@embroider/macros', { baseDir: __dirname });
    project.addDependency(emberEngines());
    eagerEngine.linkDependency('ember-truth-helpers', { baseDir: __dirname });
    eagerEngine.addDependency(emberEngines());
    lazyEngine.linkDependency('ember-truth-helpers', { baseDir: __dirname });
    lazyEngine.addDependency(emberEngines());
    macroSampleAddon.linkDependency('@embroider/macros', { baseDir: __dirname });

    let engineTestFiles = loadFromFixtureData('engines-host-app');
    merge(project.files, engineTestFiles);
  })
  .expand({
    'with-fastboot': project => {
      project.linkDependency('ember-cli-fastboot', { baseDir: __dirname });
      project.linkDependency('fastboot', { baseDir: __dirname });
    },
    'without-fastboot': () => {},
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

      if (/with-fastboot/.test(scenario.name)) {
        Qmodule(`fastboot`, function (hooks) {
          let visit: any;

          hooks.before(async () => {
            ({ visit } = await setupFastboot(app));
          });

          test('host-app', async function (assert) {
            let doc = (await visit('/')).window.document;
            assert.equal(
              doc.querySelector('[data-test-duplicated-helper]').textContent.trim(),
              'from-engines-host-app'
            );
          });

          test('lazy-engine', async function (assert) {
            let doc = (await visit('/use-lazy-engine')).window.document;
            assert.equal(doc.querySelector('[data-test-lazy-engine-main] > h1').textContent.trim(), 'Lazy engine');
            assert.equal(doc.querySelector('[data-test-duplicated-helper]').textContent.trim(), 'from-lazy-engine');
          });

          test('eager-engine', async function (assert) {
            let doc = (await visit('/use-eager-engine')).window.document;
            assert.equal(doc.querySelector('[data-test-eager-engine-main] > h1').textContent.trim(), 'Eager engine');
            assert.equal(
              doc.querySelector('[data-test-duplicated-helper]').textContent.trim(),
              'from-eager-engine-helper'
            );
          });
        });
      }
    });
  });
