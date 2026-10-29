import { PreparedApp, Project, Scenarios } from 'scenario-tester';
import { outputFileSync, outputJSONSync } from 'fs-extra';
import { join } from 'path';
import QUnit from 'qunit';
import {
  coreOptions,
  loadEmbroiderConfig,
  registerLegacyEmbroiderConfig,
  serializeLegacyEmbroiderConfig,
  clearEmbroiderConfigCache,
  locateEmbroiderWorkingDir,
} from '@embroider/core';
import { validateConfig as validateCoreConfig } from '@embroider/core/config';
import { validateConfig as validateCompatConfig } from '@embroider/compat/config';

const { module: Qmodule, test } = QUnit;

Scenarios.fromProject(() => new Project('config-file-app'))
  .map('config-file', project => {
    project.linkDependency('@embroider/core', { baseDir: __dirname });
    project.linkDependency('@embroider/compat', { baseDir: __dirname });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let dir: string;

      function givenFiles(files: Record<string, string>) {
        for (let [filename, contents] of Object.entries(files)) {
          outputFileSync(join(dir, filename), contents, 'utf8');
        }
      }

      hooks.beforeEach(async () => {
        dir = (await scenario.prepare()).dir;
      });

      hooks.afterEach(() => {
        clearEmbroiderConfigCache();
      });

      test('no config file means defaults', function (assert) {
        let loaded = loadEmbroiderConfig(dir);
        assert.strictEqual(loaded.source, 'none');
        assert.deepEqual(loaded.options, {});
        assert.true(coreOptions(dir).staticInvokables);
        assert.deepEqual(coreOptions(dir).splitAtRoutes, []);
      });

      test('loads an ESM config file', function (assert) {
        givenFiles({
          'embroider.conf.mjs': `
            import { defineConfig } from '@embroider/core/config';
            export default defineConfig({ splitAtRoutes: [/^admin/, 'people'], staticAppPaths: ['lib'] });
          `,
        });
        let loaded = loadEmbroiderConfig(dir);
        assert.strictEqual(loaded.source, 'file');
        assert.strictEqual(loaded.filename, join(dir, 'embroider.conf.mjs'));
        let options = coreOptions(dir);
        assert.deepEqual(options.splitAtRoutes, [/^admin/, 'people']);
        assert.deepEqual(options.staticAppPaths, ['lib']);
        assert.true(options.staticInvokables, 'defaults are applied');
      });

      test('loads a CJS config file and can reload it', function (assert) {
        givenFiles({ 'embroider.conf.js': `module.exports = { staticInvokables: false };` });
        assert.false(coreOptions(dir).staticInvokables);

        givenFiles({ 'embroider.conf.js': `module.exports = { staticInvokables: true };` });
        assert.false(coreOptions(dir).staticInvokables, 'cached');

        clearEmbroiderConfigCache(dir);
        assert.true(coreOptions(dir).staticInvokables, 'reloaded');
      });

      test('compat defineConfig is importable from a config file', function (assert) {
        givenFiles({
          'embroider.conf.mjs': `
            import { defineConfig } from '@embroider/compat/config';
            export default defineConfig({ allowUnsafeDynamicComponents: true });
          `,
        });
        assert.deepEqual(loadEmbroiderConfig(dir).options, { allowUnsafeDynamicComponents: true });
      });

      // only node versions with native type stripping can do this
      const typescriptTest = (process.features as { typescript?: unknown }).typescript ? test : QUnit.skip;

      typescriptTest('a typescript config file is evaluated by node', async function (assert) {
        givenFiles({
          'embroider.conf.mts': `
            import { defineConfig } from '@embroider/core/config';
            const routes: string[] = ['admin'];
            export default defineConfig({ splitAtRoutes: routes });
          `,
          'check.cjs': `
            const { coreOptions } = require('@embroider/core');
            console.log(JSON.stringify(coreOptions(__dirname).splitAtRoutes));
          `,
        });
        let result = await new PreparedApp(dir).execute('node ./check.cjs');
        assert.strictEqual(result.exitCode, 0, result.output);
        assert.strictEqual(result.stdout.trim(), '["admin"]');
      });

      test('loads a .cjs config file', function (assert) {
        givenFiles({ 'embroider.conf.cjs': `module.exports = { staticAppPaths: ['cjs'] };` });
        assert.deepEqual(coreOptions(dir).staticAppPaths, ['cjs']);
      });

      test('core validateConfig rejects badly shaped core options', function (assert) {
        givenFiles({ 'embroider.conf.mjs': `export default { splitAtRoutes: 'admin', staticInvokables: 'yes' };` });
        assert.throws(
          () => validateCoreConfig(dir),
          /'staticInvokables' must be a boolean[\s\S]*'splitAtRoutes' must be an array/
        );
      });

      test('compat validateConfig covers both compat and core options', function (assert) {
        givenFiles({ 'embroider.conf.cjs': `module.exports = { allowUnsafeDynamicComponents: 1 };` });
        assert.throws(() => validateCompatConfig(dir), /'allowUnsafeDynamicComponents' must be a boolean/);

        clearEmbroiderConfigCache(dir);
        // cjs, because ESM can't be reloaded in-process
        givenFiles({ 'embroider.conf.cjs': `module.exports = { staticAppPaths: [1] };` });
        assert.throws(() => validateCompatConfig(dir), /'staticAppPaths' must be an array of strings/);
      });

      test('compat validateConfig applies both layers of defaults', function (assert) {
        let options = validateCompatConfig(dir);
        assert.true(options.staticInvokables, 'core default');
        assert.false(options.allowUnsafeDynamicComponents, 'compat default');
      });

      test('validateConfig does not populate the cache', function (assert) {
        // this is what the vite plugin does before the prebuild has run
        validateCoreConfig(dir);
        validateCompatConfig(dir);
        // then the prebuild writes the deprecated options into resolver.json
        outputJSONSync(join(locateEmbroiderWorkingDir(dir), 'resolver.json'), {
          legacyEmbroiderConfig: { staticInvokables: false },
        });
        assert.false(coreOptions(dir).staticInvokables, 'the legacy options are seen');
      });

      test('more than one config file is an error', function (assert) {
        givenFiles({
          'embroider.conf.mjs': `export default {};`,
          'embroider.conf.js': `module.exports = {};`,
        });
        assert.throws(() => loadEmbroiderConfig(dir), /more than one embroider config file/);
      });

      test('config file must default export an object', function (assert) {
        givenFiles({ 'embroider.conf.mjs': `export const x = 1;` });
        assert.throws(() => loadEmbroiderConfig(dir), /must have a default export that is an object/);
      });

      test('config is found from a classic dummy app root', function (assert) {
        givenFiles({
          'embroider.conf.mjs': `export default { staticAppPaths: ['dummy-lib'] };`,
          'tests/dummy/config/environment.js': '',
        });
        assert.deepEqual(coreOptions(join(dir, 'tests', 'dummy')).staticAppPaths, ['dummy-lib']);
      });

      test('ember-cli-build options and a config file is an error', function (assert) {
        givenFiles({ 'embroider.conf.mjs': `export default {};` });
        assert.throws(
          () => registerLegacyEmbroiderConfig(dir, { staticInvokables: false }),
          /embroider options in ember-cli-build.js and also in/
        );
      });

      test('ember-cli-build options are deprecated but work, in-process and via resolver.json', function (assert) {
        let warnings: string[] = [];
        let origWarn = console.warn;
        console.warn = (msg: string) => warnings.push(msg);
        try {
          registerLegacyEmbroiderConfig(dir, {
            staticInvokables: false,
            splitAtRoutes: [/^admin/i, 'people'],
            compatAdapters: new Map(),
          });
        } finally {
          console.warn = origWarn;
        }
        assert.strictEqual(warnings.length, 1);
        assert.ok(/DEPRECATION/.test(warnings[0]));

        let loaded = loadEmbroiderConfig(dir);
        assert.strictEqual(loaded.source, 'ember-cli-build');
        assert.ok(loaded.options.compatAdapters instanceof Map, 'in-process consumers see the full options');

        // simulate what the prebuild writes, then read it from a "different process"
        let serialized = serializeLegacyEmbroiderConfig(dir);
        assert.strictEqual(serialized?.compatAdapters, undefined, 'only runtime options are serialized');
        outputJSONSync(join(locateEmbroiderWorkingDir(dir), 'resolver.json'), {
          legacyEmbroiderConfig: JSON.parse(JSON.stringify(serialized)),
        });
        clearEmbroiderConfigCache(dir);

        let reloaded = loadEmbroiderConfig(dir);
        assert.strictEqual(reloaded.source, 'ember-cli-build');
        assert.false(coreOptions(dir).staticInvokables);
        assert.deepEqual(coreOptions(dir).splitAtRoutes, [/^admin/i, 'people']);
      });

      test('a config file wins over stale legacy options in resolver.json', function (assert) {
        outputJSONSync(join(locateEmbroiderWorkingDir(dir), 'resolver.json'), {
          legacyEmbroiderConfig: { staticInvokables: false },
        });
        givenFiles({ 'embroider.conf.mjs': `export default { staticInvokables: true };` });
        assert.strictEqual(loadEmbroiderConfig(dir).source, 'file');
        assert.true(coreOptions(dir).staticInvokables);
      });
    });
  });
