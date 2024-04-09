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

app.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    let server: CommandWatcher;
    let serverPort: string;

    async function waitFor(...args: Parameters<CommandWatcher['waitFor']>): Promise<any> {
      return server.waitFor(...args);
    }

    hooks.beforeEach(async () => {
      app = await scenario.prepare();
      server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
      const [, port] = await waitFor(/Local:\s+http:\/\/127.0.0.1:(\d+)\//);

      serverPort = port;
    });

    hooks.afterEach(async () => {
      console.log('shutting down');
      await server.shutdown();
      console.log('done shutting down');
    });

    function getRemoteFile(assert: Assert, path: string) {
      return expectRemoteFile(`http://localhost:${serverPort}`, { qunit: assert })(path);
    }

    test(`vite`, async function (assert) {
      await getRemoteFile(assert, '/assets/app-template.js').doesNotMatch(
        /import \* as .* from.*rewritten_packages.*ember-page-title/
      );

      // TODO write the correct one
      await getRemoteFile(assert, '/assets/app-template.js').matches(
        /import \* as .* from.*.vite\/deps\/app-template_services_page-title/
      );
    });
  });
});
