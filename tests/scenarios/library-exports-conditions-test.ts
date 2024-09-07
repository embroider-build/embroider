import { join } from 'path';
import { appScenarios } from './scenarios';
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

appScenarios
  // we are primarily interested in the resolving of export conditions
  // from nested libraries, we don't need to test per host-app version
  .only('canary')
  .map('export-conditions', async project => {
    let addon = new Project('native-esm', '0.0.0', {
      files: {
        dist: {
          dev: { 'index.js': `export const location = '${nativeESM.devText}';` },
          prod: { 'index.js': `export const location = '${nativeESM.prodText}';` },
        },
      },
    });
    addon.pkg.files = ['dist'];
    addon.pkg.exports = {
      '.': {
        development: {
          default: './dist/dev/index.js',
        },
        default: './dist/prod/index.js',
      },
    };

    project.addDevDependency(addon);

    merge(project.files, {
      app: {
        routes: {
          'application.js': `
import Route from '@ember/routing/route';
import * as nativeESM from 'native-esm';

console.log({ nativeESM });
export default class Application extends Route {};
`,
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('pnpm build');
        assert.equal(result.exitCode, 0, result.output);
      });

      Qmodule('Consuming app', function () {
        test(`dist assets contain the prod strings, not the development`, async function (assert) {
          let files = await globby('**/*.js', { cwd: join(app.dir, 'dist') });
          let found = false;

          for (let file of files) {
            let fullPath = join(app.dir, 'dist', file);
            let buffer = await readFile(fullPath);
            let contents = buffer.toString();

            let hasProdText = contents.includes(nativeESM.prodText);

            assert.notOk(contents.includes(nativeESM.devText), `${fullPath} does not contain '${nativeESM.devText}'`);

            if (hasProdText) found = true;
          }

          assert.ok(found, `Found text '${nativeESM.prodText}' within ${app.dir}/dist`);
        });
      });
    });
  });
