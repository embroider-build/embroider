import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import fetch from 'node-fetch';
import { writeFileSync } from 'fs-extra';
import { join } from 'path';
import { setupViteDevServer } from './helpers';
import { DEFAULT_TIMEOUT } from './helpers/command-watcher';

const { module: Qmodule, test } = QUnit;

// A stylesheet that is imported as a module, the way a vite-native app pulls in
// its styles. Vite owns this file, so it can hot-replace it without reloading.
const MODULE_STYLESHEET = 'app/hmr-styles.css';

// The classic ember stylesheet, which broccoli builds and which reaches the
// browser as a <link> to `@embroider/virtual/app.css`. Vite has no module for
// this file, so a full page reload is the only way its changes get there.
const CLASSIC_STYLESHEET = 'app/styles/app.css';

let app = appScenarios.map('vite-hmr', project => {
  merge(project.files, {
    app: {
      'hmr-styles.css': `.hmr-probe { color: rgb(1, 1, 1); }\n`,
    },
  });

  let appFiles = project.files.app as Record<string, string>;
  appFiles['app.js'] = `import './hmr-styles.css';\n${appFiles['app.js']}`;
});

app.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;

    hooks.before(async () => {
      app = await scenario.prepare();
    });

    function write(relativePath: string, content: string): void {
      writeFileSync(join(app.dir, ...relativePath.split('/')), content);
    }

    // Each case gets its own dev server, because one stylesheet edit can make
    // vite say more than one thing and only the first of those matters here:
    // the cases must not read each other's leftovers.
    function setupCase(hooks: NestedHooks) {
      let viteDev = setupViteDevServer(hooks, () => app);

      return {
        // Vite only reacts to a file once that file is in its module graph, and
        // the graph is only populated by requests. Ask for the app's entrypoint
        // so that it, and the stylesheet it imports, are being tracked.
        async primeModuleGraph(): Promise<void> {
          for (let url of ['/app/app.js', '/app/hmr-styles.css']) {
            let response = await fetch(`${viteDev.appURL}${url}`);
            if (!response.ok) {
              throw new Error(`expected ${url} to be servable, got ${response.status}`);
            }
          }
        },

        // The two outcomes are mutually exclusive from the browser's point of
        // view: whichever vite announces first is the one the user experiences,
        // because a page reload discards any hot update that follows it.
        async firstAnnouncement(): Promise<string> {
          let [line] = await viteDev.server.waitFor(/(?:page reload|hmr update) .*/, DEFAULT_TIMEOUT);
          return line;
        },
      };
    }

    Qmodule('a stylesheet vite owns', function (hooks) {
      let testCase = setupCase(hooks);

      test('is hot-updated rather than reloaded', async function (assert) {
        await testCase.primeModuleGraph();

        write(MODULE_STYLESHEET, `.hmr-probe { color: rgb(2, 2, 2); }\n`);

        let announcement = await testCase.firstAnnouncement();
        assert.ok(
          /hmr update .*hmr-styles\.css/.test(announcement),
          `expected vite to hot-update the stylesheet, got: ${announcement}`
        );
      });
    });

    Qmodule('a stylesheet vite does not own', function (hooks) {
      let testCase = setupCase(hooks);

      test('still reloads the page', async function (assert) {
        await testCase.primeModuleGraph();

        write(CLASSIC_STYLESHEET, `.classic-probe { color: rgb(3, 3, 3); }\n`);

        let announcement = await testCase.firstAnnouncement();
        assert.ok(/page reload/.test(announcement), `expected vite to reload the page, got: ${announcement}`);
      });
    });
  });
});
