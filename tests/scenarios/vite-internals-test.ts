import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import fetch from 'node-fetch';
import CommandWatcher from './helpers/command-watcher';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';

const { module: Qmodule, test } = QUnit;

appScenarios
  .only('canary')
  .map('vite-internals', () => {})
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
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

      test(`dep optimization of a v2 addon`, async function (assert) {
        expectAudit
          .module('./index.html')
          .resolves('/@embroider/core/entrypoint')
          .toModule()
          .withContents((_src, imports) => {
            let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
            assert.ok(pageTitleImports.length > 0, 'should have at least one import from page-title');
            for (let pageTitleImport of pageTitleImports) {
              assert.ok(
                /\.vite\/deps/.test(pageTitleImport.source),
                `expected ${pageTitleImport.source} to be in vite deps`
              );
            }
            return true;
          });
      });
    });
  });
