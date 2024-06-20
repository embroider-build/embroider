import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';

import { expectRemoteFile } from '@embroider/test-support/file-assertions/qunit';

const { module: Qmodule, test } = QUnit;

let app = appScenarios.map('vite-specific', () => {
  /**
   * We will create files as a part of the watch-mode tests,
   * because creating files should cause appropriate watch/update behavior
   */
});

import CommandWatcher from './helpers/command-watcher';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';

app.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    let server: CommandWatcher;
    let serverPort: string;

    hooks.before(async () => {
      app = await scenario.prepare();
      server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
      const [, port] = await server.waitFor(/Local:\s+http:\/\/127.0.0.1:(\d+)\//);

      serverPort = port;
    });

    let expectAudit = setupAuditTest(hooks, () => ({
      appURL: `http://localhost:${serverPort}/`,
      startingFrom: ['index.html'],
    }));

    hooks.after(async () => {
      console.log('shutting down');
      await server.shutdown();
      console.log('done shutting down');
    });

    test(`vite`, async function () {
      expectAudit
        .module('index.html')
        .resolves(/app-template\.js/)
        .toModule()
        .withContents((_src, imports) => {
          return imports.filter(imp => /page-title/.test(imp.source)).every(imp => /\.vite\/deps/.test(imp.source));
        });
    });
  });
});
