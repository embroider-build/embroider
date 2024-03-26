import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import CommandWatcher from './helpers/command-watcher';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';
import fetch from 'node-fetch';
import { writeFileSync, readdirSync } from 'fs-extra';
import { join } from 'path';

const { module: Qmodule, test } = QUnit;

let app = appScenarios.map('vite-dep-optimizer', () => {});

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
      startingFrom: ['tests/index.html', 'index.html'],
      fetch: fetch as unknown as typeof globalThis.fetch,
    }));

    hooks.after(async () => {
      await server.shutdown();
    });

    Qmodule(`initial dep scan`, function () {
      let optimizedFiles: string[] = [];
      test('created initial optimized deps', function (assert) {
        optimizedFiles = readdirSync(join(app.dir, 'node_modules', '.vite', 'deps')).filter(f => f.endsWith('.js'));
        assert.ok(optimizedFiles.length === 298, `should have created optimized deps: ${optimizedFiles.length}`);
      });
      test('should use optimized files for deps', function (assert) {
        console.log(optimizedFiles);
        const used: string[] = [];
        Object.keys(expectAudit.modules).forEach((m) => {
          if (m.includes('.vite/deps')) {
            const part = m.split('.vite/deps/')[1];
            console.log(part, !!optimizedFiles.find(f => part.startsWith(f)));
            const f = optimizedFiles.find(f => part.startsWith(f))
            if (f) {
              used.push(f);
            }
          }
          return false;
        })

        function difference(a: string[], b: string[]) {
          const bSet = new Set(b);
          return a.filter(item => !bSet.has(item));
        }

        assert.ok(used.length === optimizedFiles.length, `all optimized files should be used, unused: ${difference(optimizedFiles, used)}`);
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

    Qmodule('should optimize newly added deps', async function () {

      async function waitUntilOptimizedReady() {
        let retries = 0;
        while (true) {
          try {
            await expectAudit.rerun();
          } catch (e) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            retries += 1;
            if (retries > 10) {
              throw new Error(`unable to visit all urls ${e}`)
            }
            continue
          }
          break;
        }
      }

      test(`should optimize newly added deps`, async function (assert) {
        writeFileSync(join(app.dir, 'app/dep-tests.js'), `
        import 'ember-page-title/helpers/page-title';
      `)
        await server.waitFor(/page reload/);
        await waitUntilOptimizedReady();

        expectAudit
          .module('./index.html')
          .resolves(/app-template\.js/)
          .toModule()
          .resolves(/dep-tests\.js/)
          .toModule()
          .withContents((_src, imports) => {
            let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
            assert.strictEqual(pageTitleImports.length, 1, 'found two uses of page-title addon');
            assert.ok(
              pageTitleImports.every(imp => /\.vite\/deps/.test(imp.source)),
              `every page-title module comes from .vite/deps but we saw ${pageTitleImports.map(i => i.source).join(', ')}`
            );
            return true;
          });
      });
      test(`should optimize newly added deps via appjs match`, async function (assert) {
        writeFileSync(join(app.dir, 'app/dep-tests.js'), `
        import 'app-template/helpers/page-title';
      `)
        await server.waitFor(/page reload/);
        await waitUntilOptimizedReady();

        expectAudit
          .module('./index.html')
          .resolves(/app-template\.js/)
          .toModule()
          .resolves(/dep-tests\.js/)
          .toModule()
          .withContents((_src, imports) => {
            let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
            assert.strictEqual(pageTitleImports.length, 1, 'found two uses of page-title addon');
            assert.ok(
              pageTitleImports.every(imp => /\.vite\/deps/.test(imp.source)),
              `every page-title module comes from .vite/deps but we saw ${pageTitleImports.map(i => i.source).join(', ')}`
            );
            return true;
          });
      });
      test(`should optimize newly added deps via relative appjs match`, async function (assert) {
        writeFileSync(join(app.dir, 'app/dep-tests.js'), `
        import './helpers/page-title';
      `)
        await server.waitFor(/page reload/);
        await waitUntilOptimizedReady();

        expectAudit
          .module('./index.html')
          .resolves(/app-template\.js/)
          .toModule()
          .resolves(/dep-tests\.js/)
          .toModule()
          .withContents((_src, imports) => {
            let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
            assert.strictEqual(pageTitleImports.length, 1, 'found two uses of page-title addon');
            assert.ok(
              pageTitleImports.every(imp => /\.vite\/deps/.test(imp.source)),
              `every page-title module comes from .vite/deps but we saw ${pageTitleImports.map(i => i.source).join(', ')}`
            );
            return true;
          });
      });
    })
  });
});
