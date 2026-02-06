import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import CommandWatcher from './helpers/command-watcher';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';
import fetch from 'node-fetch';

const { module: Qmodule, test } = QUnit;

let app = appScenarios.map('vite-specific', () => {});

app.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    let server: CommandWatcher;
    let appURL: string;

    hooks.before(async () => {
      app = await scenario.prepare();
      server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
      [, appURL] = await server.waitFor(/Local:\s*(.*)/);
    });

    let expectAudit = setupAuditTest(hooks, () => ({
      appURL,
      startingFrom: ['index.html'],
      fetch: fetch as unknown as typeof globalThis.fetch,
    }));

    hooks.after(async () => {
      await server.shutdown();
    });

    test(`vite`, async function (assert) {
      expectAudit
        .module('./index.html')
        .resolves(/app-template\.js/)
        .toModule()
        .withContents((_src, imports) => {
          let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
          assert.strictEqual(pageTitleImports.length, 2, 'found two uses of page-title addon');
          assert.ok(
            pageTitleImports.every(imp => /\.vite\/deps/.test(imp.source)),
            `every page-title module comes from .vite/deps but we saw ${pageTitleImports.map(i => i.source).join(', ')}`
          );
          return true;
        });
    });
  });
});
