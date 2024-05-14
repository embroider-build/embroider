import { appScenarios, baseAddon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import { Project } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { setupFastboot, loadFromFixtureData } from './helpers';
import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

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

let engineScenarios = appScenarios.map('engines', project => {
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
  project.linkDependency('@ember/legacy-built-in-components', { baseDir: __dirname });
  eagerEngine.linkDependency('ember-truth-helpers', { baseDir: __dirname });
  eagerEngine.addDependency(emberEngines());
  lazyEngine.linkDependency('ember-truth-helpers', { baseDir: __dirname });
  lazyEngine.addDependency(emberEngines());
  macroSampleAddon.linkDependency('@embroider/macros', { baseDir: __dirname });

  let engineTestFiles = loadFromFixtureData('engines-host-app');
  merge(project.files, engineTestFiles);
});

engineScenarios
  .skip('lts_3_28-engines') // this skip should be removed before https://github.com/embroider-build/embroider/pull/1435 is merged
  .skip('lts_4_4-engines') // this skip should be removed before https://github.com/embroider-build/embroider/pull/1435 is merged
  .skip('release-engines') // this skip should be removed before https://github.com/embroider-build/embroider/pull/1435 is merged
  .skip('canary-engines') // this shouldn't be run
  .map('without-fastboot', () => {})
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      let expectFile: ExpectFile;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('pnpm run build', { env: { EMBROIDER_PREBUILD: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(readFileSync(join(app.dir, 'dist/.stage2-output'), 'utf8'), { qunit: assert });
      });

      test(`pnpm test safe`, async function (assert) {
        let result = await app.execute("pnpm run test --filter='!@optimized'", {
          env: {
            EMBROIDER_TEST_SETUP_OPTIONS: 'safe',
            EMBROIDER_TEST_SETUP_FORCE: 'embroider',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`pnpm test optimized`, async function (assert) {
        let result = await app.execute('pnpm test --filter=!@safe', {
          env: {
            EMBROIDER_TEST_SETUP_OPTIONS: 'optimized',
            EMBROIDER_TEST_SETUP_FORCE: 'embroider',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });

      test('lazy engines appear in _embroiderEngineBundles_', function () {
        expectFile('assets/app-template.js').matches(/import\("\.\/_engine_\/lazy-engine\.js"\)/);
      });

      test('lazy engine css is imported', function () {
        expectFile('assets/_engine_/lazy-engine.js').matches(
          /i\("\.\.\/\.\.\/node_modules\/lazy-engine\/lazy-engine\.css"\)/
        );
      });

      test('eager engine css is merged with vendor.css', function () {
        expectFile('assets/vendor.css').matches(`.eager { background-color: blue; }`);
      });
    });
  });

engineScenarios
  .skip('lts_3_28-engines') // fails due to https://github.com/emberjs/ember.js/pull/20461
  .skip('lts_4_4-engines') // fails due to https://github.com/emberjs/ember.js/pull/20461
  .skip('release-engines') // fails due to https://github.com/emberjs/ember.js/pull/20461
  .skip('canary-engines') // this shouldn't be run
  .map('with-fastboot', app => {
    app.linkDependency('ember-cli-fastboot', { baseDir: __dirname });
    app.linkDependency('fastboot', { baseDir: __dirname });
    app.pkg.fastbootDependencies = ['crypto', 'node-fetch'];
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`pnpm test safe`, async function (assert) {
        let result = await app.execute('pnpm test --filter=!@optimized', {
          env: {
            EMBROIDER_TEST_SETUP_OPTIONS: 'safe',
            EMBROIDER_TEST_SETUP_FORCE: 'embroider',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`pnpm test optimized`, async function (assert) {
        let result = await app.execute('pnpm test --filter=!@safe', {
          env: {
            EMBROIDER_TEST_SETUP_OPTIONS: 'optimized',
            EMBROIDER_TEST_SETUP_FORCE: 'embroider',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });
      let visit: any;

      hooks.before(async () => {
        ({ visit } = await setupFastboot(app));
      });

      test('host-app', async function (assert) {
        let doc = (await visit('/')).window.document;
        assert.equal(doc.querySelector('[data-test-duplicated-helper]').textContent.trim(), 'from-engines-host-app');
      });

      test('lazy-engine', async function (assert) {
        let doc = (await visit('/use-lazy-engine')).window.document;
        assert.equal(doc.querySelector('[data-test-lazy-engine-main] > h1').textContent.trim(), 'Lazy engine');
        assert.equal(doc.querySelector('[data-test-duplicated-helper]').textContent.trim(), 'from-lazy-engine');
      });

      test('eager-engine', async function (assert) {
        let doc = (await visit('/use-eager-engine')).window.document;
        assert.equal(doc.querySelector('[data-test-eager-engine-main] > h1').textContent.trim(), 'Eager engine');
        assert.equal(doc.querySelector('[data-test-duplicated-helper]').textContent.trim(), 'from-eager-engine-helper');
      });
    });
  });
