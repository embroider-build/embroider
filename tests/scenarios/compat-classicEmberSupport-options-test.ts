import { appScenarios } from './scenarios';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import QUnit from 'qunit';
import CommandWatcher from './helpers/command-watcher';
import { PreparedApp } from 'scenario-tester';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';

const { module: Qmodule, test } = QUnit;

appScenarios
  .map('[classicEmberSupport] watch: false', app => {
    merge(app.files, {
      'vite.config.mjs': `
        import { defineConfig } from "vite";
        import { extensions, classicEmberSupport, ember } from "@embroider/vite";
        import { babel } from "@rollup/plugin-babel";

        export default defineConfig({
          plugins: [
            classicEmberSupport({ watch: false }),
            ember(),
            babel({
              babelHelpers: "runtime",
              extensions,
            }),
          ],
        });
      `,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let server: CommandWatcher;
      let appURL: string;

      hooks.before(async () => {
        app = await scenario.prepare();
        server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
        [, appURL] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);
      });

      let expectAudit = setupAuditTest(hooks, () => ({
        appURL,
        startingFrom: ['index.html'],
        fetch: fetch as unknown as typeof globalThis.fetch,
      }));

      hooks.after(async () => {
        await server?.shutdown();
      });

      test('ember CLI builds (once)', async function (assert) {
        assert.deepEqual(server.didEmit(/building\.\.\./), { count: 1 }, 'builds once');
        assert.deepEqual(server.didEmit(/tmp\/compat-prebuild/), { count: 1 }, 'compat build is emitted');
        assert.deepEqual(server.didEmit(/cleaning up\.\.\./), { count: 1 }, 'cleans up once');

        // "Visit" the app
        expectAudit
          .module('./index.html')
          .resolves(/\/index.html.*/)
          .toModule();

        server.clearLogs();

        // Changing a file should not trigger a rebuild since watch is false
        await writeFile(join(app.dir, 'app/templates/application.hbs'), '<h1>Hello Vite!</h1>');
        await server.waitFor(/page reload/);

        assert.false(server.didEmit(/building\.\.\./), 'builds once');
        assert.false(server.didEmit(/tmp\/compat-prebuild/), 'compat build is emitted');
        assert.false(server.didEmit(/cleaning up\.\.\./), 'cleans up once');
      });
    });
  });

appScenarios
  .map('[classicEmberSupport] reusePrebuild: true', app => {
    merge(app.files, {
      'vite.config.mjs': `
        import { defineConfig } from "vite";
        import { extensions, classicEmberSupport, ember } from "@embroider/vite";
        import { babel } from "@rollup/plugin-babel";

        export default defineConfig({
          plugins: [
            classicEmberSupport({ reusePrebuild: true }),
            ember(),
            babel({
              babelHelpers: "runtime",
              extensions,
            }),
          ],
        });
      `,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let server: CommandWatcher;
      let boot: (...args: string[]) => Promise<void>;

      hooks.before(async () => {
        app = await scenario.prepare();

        boot = async (...args: string[]) => {
          server = CommandWatcher.launch('vite', ['--clearScreen', 'false', ...args], { cwd: app.dir });
          await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);
        };

        await boot();
      });

      hooks.after(async () => {
        await server?.shutdown();
      });

      test('it works', async function (assert) {
        assert.deepEqual(server.didEmit(/building\.\.\./), { count: 1 }, 'builds once');
        assert.deepEqual(server.didEmit(/tmp\/compat-prebuild/), { count: 1 }, 'compat build is emitted');
        assert.deepEqual(server.didEmit(/cleaning up\.\.\./), { count: 1 }, 'ember-cli process exits');

        server.shutdown();
        await boot();

        assert.deepEqual(server.didEmit(/Reusing addon prebuild in/), { count: 1 }, 'reused addon prebuild');
        assert.false(server.didEmit(/building\.\.\./), 'No build');
        assert.false(server.didEmit(/tmp\/compat-prebuild/), 'No compat-prebuild emit');
        assert.false(server.didEmit(/cleaning up\.\.\./), 'No ember-cli process to exit');

        server.shutdown();
        await boot('--force');

        assert.deepEqual(
          server.didEmit(/Re-running compatPrebuild due to --force/),
          { count: 1 },
          're-building due to --force'
        );
        assert.deepEqual(server.didEmit(/building\.\.\./), { count: 1 }, 'builds again, due to --force');
        assert.deepEqual(server.didEmit(/tmp\/compat-prebuild/), { count: 1 }, 'compat build is emitted');
        assert.deepEqual(server.didEmit(/cleaning up\.\.\./), { count: 1 }, 'ember-cli process exits');
      });
    });
  });
