import { join } from 'path';
import { appScenarios, baseAddon } from './scenarios';
import { type PreparedApp, Project } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import globby from 'globby';
import { readFile } from 'fs-extra';

const { module: Qmodule, test } = QUnit;

const nativeESM = {
  prodText: `production - from native-esm`,
  devText: `dev - from native-esm`,
};
const nestedNativeESM = {
  prodText: `production - from nested-native-esm`,
  devText: `dev - from nested-native-esm`,
};

appScenarios
  // we are primarily interested in the resolving of export conditions
  // from nested libraries, we don't need to test per host-app version
  .only('release')
  .map('export-conditions', async project => {
    let addon = new Project('native-esm', '0.0.0', {
      files: {
        dist: {
          dev: { 'index.js': `export const location = '${nativeESM.devText}';` },
          prod: { 'index.js': `export const location = '${nativeESM.prodText}';` },
        },
      },
    });
    addon.pkg.type = 'module';
    addon.pkg.files = ['dist'];
    addon.pkg.exports = {
      '.': {
        development: {
          default: './dist/dev/index.js',
        },
        default: './dist/prod/index.js',
      },
    };
    let nestedAddon = new Project('nested-native-esm', '0.0.0', {
      files: {
        dist: {
          dev: { 'index.js': `export const location = '${nestedNativeESM.devText}';` },
          prod: { 'index.js': `export const location = '${nestedNativeESM.prodText}';` },
        },
      },
    });
    nestedAddon.pkg.type = 'module';
    nestedAddon.pkg.files = ['dist'];
    nestedAddon.pkg.exports = {
      '.': {
        development: {
          default: './dist/dev/index.js',
        },
        default: './dist/prod/index.js',
      },
    };

    let proxyV1Addon = baseAddon();
    proxyV1Addon.pkg.name = 'proxy-v1-addon';
    proxyV1Addon.mergeFiles({
      addon: {
        'index.js': `export { location } from 'nested-native-esm';`,
      },
    });

    proxyV1Addon.linkDependency('ember-auto-import', { baseDir: __dirname });
    proxyV1Addon.addDependency(nestedAddon);
    project.addDevDependency(addon);
    project.addDevDependency(proxyV1Addon);

    merge(project.files, {
      app: {
        routes: {
          'application.js': `
import Route from '@ember/routing/route';
import * as nativeESM from 'native-esm';
import * as proxyV1Addon from 'proxy-v1-addon';

console.log({ nativeESM, proxyV1Addon });

export default class Application extends Route {};
`,
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      let filePaths: string[];

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('pnpm build');
        assert.equal(result.exitCode, 0, result.output);

        let files = await globby('**/*.js', { cwd: join(app.dir, 'dist') });

        filePaths = files.map(file => join(app.dir, 'dist', file));
      });

      Qmodule('dist assets contain the prod strings, not the development', function () {
        test(`native-esm`, async function (assert) {
          let found = false;

          for (let file of filePaths) {
            let buffer = await readFile(file);
            let contents = buffer.toString();

            let hasProdText = contents.includes(nativeESM.prodText);

            assert.notOk(contents.includes(nativeESM.devText), `${file} does not contain '${nativeESM.devText}'`);

            if (hasProdText) found = true;
          }

          assert.ok(found, `Expected text '${nativeESM.prodText}' within ${app.dir}/dist`);
        });

        test(`nested-native-esm`, async function (assert) {
          let found = false;

          for (let file of filePaths) {
            let buffer = await readFile(file);
            let contents = buffer.toString();

            let hasProdText = contents.includes(nestedNativeESM.prodText);

            assert.notOk(
              contents.includes(nestedNativeESM.devText),
              `${file} does not contain '${nestedNativeESM.devText}'`
            );

            if (hasProdText) found = true;
          }

          assert.ok(found, `Expected text '${nestedNativeESM.prodText}' within ${app.dir}/dist`);
        });
      });
    });
  });
