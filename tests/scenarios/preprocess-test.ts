import { appScenarios, baseAddon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { loadFromFixtureData } from './helpers';
import CommandWatcher from './helpers/command-watcher';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { join } from 'path';

const { module: Qmodule, test } = QUnit;

appScenarios
  .map('preprocess', project => {
    let preprocessAddon = baseAddon();

    merge(preprocessAddon.files, loadFromFixtureData('preprocess-addon'));
    preprocessAddon.linkDependency('broccoli-funnel', { baseDir: __dirname });
    preprocessAddon.linkDependency('broccoli-persistent-filter', { baseDir: __dirname });
    preprocessAddon.pkg.name = 'preprocess-addon';

    project.addDevDependency(preprocessAddon);
    merge(project.files, {
      app: {
        styles: {
          'app.css': `body { background: %%%; }`,
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async function () {
        app = await scenario.prepare();
      });

      test(`css is transformed: build mode`, async function (assert) {
        let result = await app.execute(`pnpm build`);
        assert.strictEqual(result.exitCode, 0, result.output);
        let text = readFileSync(join(app.dir, `dist/assets/app-template.css`), 'utf8');
        assert.strictEqual(text, 'body { background: red; }');
      });

      test(`css is transformed: dev mode`, async function (assert) {
        const server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
        try {
          const [, url] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);
          let response = await fetch(`${url}/assets/app-template.css`);
          let text = await response.text();
          assert.strictEqual(text, 'body { background: red; }');
        } finally {
          await server.shutdown();
        }
      });
    });
  });
