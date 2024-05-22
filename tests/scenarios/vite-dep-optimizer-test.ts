import { appScenarios, baseAddon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import CommandWatcher from './helpers/command-watcher';
import { setupAuditTest, type Import } from '@embroider/test-support/audit-assertions';
import fetch from 'node-fetch';
import { writeFileSync, readdirSync, rmSync } from 'fs-extra';
import { join } from 'path';

const { module: Qmodule, test } = QUnit;

let app = appScenarios.map('vite-dep-optimizer', project => {
  let myServicesAddon = baseAddon();
  myServicesAddon.pkg.name = 'my-services-addon';
  myServicesAddon.mergeFiles({
    app: {
      services: {
        'service.js': `export { default } from 'my-services-addon/services/service'`,
      },
    },
    addon: {
      services: {
        'service.js': `
            import app from 'app-template/app.js';
            import Service from '@ember/service';
            export default class Serv extends Service {
              log() {
                console.log(app);
              }
            };
          `,
      },
    },
  });
  project.addDevDependency(myServicesAddon);
});

app.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    let appURL: string;

    hooks.before(async () => {
      app = await scenario.prepare();
    });

    function isOptimizedImport(imp: Import) {
      return /\.vite\/deps/.test(imp.source);
    }

    async function waitUntilOptimizedReady(expectAudit: ReturnType<typeof setupAuditTest>) {
      let retries = 0;
      while (true) {
        try {
          await expectAudit.rerun();
        } catch (e) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries += 1;
          if (retries > 30) {
            throw new Error(`unable to visit all urls ${e}`);
          }
          continue;
        }
        break;
      }
    }

    function allDepFilesAreUsed(
      expectAudit: ReturnType<typeof setupAuditTest>,
      assert: Assert,
      optimizedFiles: string[]
    ) {
      const used: string[] = [];
      Object.keys(expectAudit.modules).forEach(m => {
        if (m.includes('.vite/deps')) {
          const part = m.split('.vite/deps/')[1];
          const f = optimizedFiles.find(f => part.startsWith(f));
          if (f) {
            used.push(f);
          }
        }
        return false;
      });

      function difference(a: string[], b: string[]) {
        const bSet = new Set(b);
        return a.filter(item => !bSet.has(item));
      }

      assert.ok(
        used.length === optimizedFiles.length,
        `all optimized files should be used, unused: ${difference(optimizedFiles, used)}`
      );
    }

    Qmodule(`initial dep scan`, function (hooks) {
      let server: CommandWatcher;
      hooks.before(async () => {
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
      let optimizedFiles: string[] = [];
      test('created initial optimized deps', async function (assert) {
        await waitUntilOptimizedReady(expectAudit);
        optimizedFiles = readdirSync(join(app.dir, 'node_modules', '.vite', 'deps')).filter(f => f.endsWith('.js'));
        assert.ok(optimizedFiles.length === 144, `should have created optimized deps: ${optimizedFiles.length}`);
      });

      test('should use all optimized deps', function (assert) {
        allDepFilesAreUsed(expectAudit, assert, optimizedFiles);
      });

      test('all deps are optimized', function (assert) {
        const allow = [
          'vite/dist/client/env.mjs',
          '@babel+runtime',
          '.css',
          '@embroider/macros',
          'ember-source/ember/index.js',
        ];
        const notOptimized = Object.keys(expectAudit.modules).filter(m => {
          const isOptimized = m.includes('.vite/deps');
          if (!isOptimized) {
            if (m.startsWith('.')) return false;
            if (allow.some(a => m.includes(a))) return false;
            return true;
          }
          return false;
        });
        assert.ok(notOptimized.length === 0, `not all are optimized: ${notOptimized}`);
      });

      test('should use optimized files for deps', function (assert) {
        expectAudit
          .module('./index.html')
          .resolves(/\/@embroider\/core\/entrypoint/)
          .toModule()
          .withContents((_src, imports) => {
            let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
            assert.strictEqual(pageTitleImports.length, 2, 'found two uses of page-title addon');
            assert.ok(
              pageTitleImports.every(isOptimizedImport),
              `every page-title module is optimized but we saw ${pageTitleImports.map(i => i.source).join(', ')}`
            );
            return true;
          });
      });
    });

    Qmodule('should optimize newly added deps', function (hooks) {
      let server: CommandWatcher;
      hooks.before(async () => {
        server = CommandWatcher.launch('vite', ['--clearScreen', 'false', '--force'], { cwd: app.dir });
        [, appURL] = await server.waitFor(/Local:\s*(.*)/);
      });
      let expectAudit = setupAuditTest(hooks, () => ({
        appURL,
        startingFrom: ['tests/index.html', 'index.html'],
        fetch: fetch as unknown as typeof globalThis.fetch,
      }));
      hooks.beforeEach(async () => {
        await server.shutdown();
        server = CommandWatcher.launch('vite', ['--clearScreen', 'false', '--force'], { cwd: app.dir });
        [, appURL] = await server.waitFor(/Local:\s*(.*)/);
      });
      hooks.afterEach(async () => {
        await server.shutdown();
        rmSync(join(app.dir, 'app/dep-tests.js'), { force: true });
      });

      test(`should optimize newly added deps`, async function (assert) {
        writeFileSync(
          join(app.dir, 'app/dep-tests.js'),
          `
        import 'ember-page-title/helpers/page-title';
      `
        );
        await server.waitFor(/page reload/);
        await waitUntilOptimizedReady(expectAudit);

        expectAudit
          .module('./index.html')
          .resolves(/\/@embroider\/core\/entrypoint/)
          .toModule()
          .resolves(/dep-tests\.js/)
          .toModule()
          .withContents((_src, imports) => {
            let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
            assert.strictEqual(pageTitleImports.length, 1, `found two uses of page-title addon: ${imports}`);
            assert.ok(
              pageTitleImports.every(isOptimizedImport),
              `every page-title module is optimized but we saw ${pageTitleImports.map(i => i.source).join(', ')}`
            );
            return true;
          });
      });

      test('all optimized deps are used', async function (assert) {
        await waitUntilOptimizedReady(expectAudit);
        const optimizedFiles = readdirSync(join(app.dir, 'node_modules', '.vite', 'deps')).filter(f =>
          f.endsWith('.js')
        );
        allDepFilesAreUsed(expectAudit, assert, optimizedFiles);
      });

      test(`should optimize newly added deps via appjs match`, async function (assert) {
        writeFileSync(
          join(app.dir, 'app/dep-tests.js'),
          `
        import 'app-template/helpers/page-title';
      `
        );
        await server.waitFor(/page reload/);
        await waitUntilOptimizedReady(expectAudit);

        expectAudit
          .module('./index.html')
          .resolves(/\/@embroider\/core\/entrypoint/)
          .toModule()
          .resolves(/dep-tests\.js/)
          .toModule()
          .withContents((_src, imports) => {
            let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
            assert.strictEqual(pageTitleImports.length, 1, `found one use of page-title addon: ${imports}`);
            assert.ok(
              pageTitleImports.every(isOptimizedImport),
              `every page-title module is optimized but we saw ${pageTitleImports.map(i => i.source).join(', ')}`
            );
            return true;
          });
      });
      test(`should optimize newly added deps via relative appjs match`, async function (assert) {
        writeFileSync(
          join(app.dir, 'app/dep-tests.js'),
          `
        import './helpers/page-title';
      `
        );
        await server.waitFor(/page reload/);
        await waitUntilOptimizedReady(expectAudit);

        expectAudit
          .module('./index.html')
          .resolves(/\/@embroider\/core\/entrypoint/)
          .toModule()
          .resolves(/dep-tests\.js/)
          .toModule()
          .withContents((_src, imports) => {
            let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
            assert.strictEqual(pageTitleImports.length, 1, 'found two uses of page-title addon');
            assert.ok(
              pageTitleImports.every(isOptimizedImport),
              `every page-title module is optimized but we saw ${pageTitleImports.map(i => i.source).join(', ')}`
            );
            return true;
          });
      });

      test(`should give same optimized id`, async function (assert) {
        writeFileSync(
          join(app.dir, 'app/dep-tests.js'),
          `
        import './helpers/page-title';
        import 'app-template/helpers/page-title';
        import '#embroider_compat/helpers/page-title';
        import 'ember-page-title/_app_/helpers/page-title.js';
        // todo: import 'ember-page-title/_app_/helpers/page-title';
      `
        );
        await server.waitFor(/page reload/);
        await waitUntilOptimizedReady(expectAudit);

        expectAudit
          .module('./index.html')
          .resolves(/\/@embroider\/core\/entrypoint/)
          .toModule()
          .resolves(/dep-tests\.js/)
          .toModule()
          .withContents((_src, imports) => {
            let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
            assert.strictEqual(pageTitleImports.length, 4, 'found three uses of page-title addon');
            assert.ok(
              pageTitleImports.every(isOptimizedImport),
              `every page-title module is optimized but we saw ${pageTitleImports.map(i => i.source).join(', ')}`
            );
            const first = pageTitleImports[0];
            assert.ok(
              pageTitleImports.every(imp => imp.source === first.source),
              `every page-title module uses same id but we saw ${pageTitleImports.map(i => i.source).join(', ')}`
            );
            return true;
          });
      });
    });

    Qmodule(`should ignore configured ignored deps`, function (hooks) {
      let server: CommandWatcher;
      hooks.before(async () => {
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

      test('ember index is not optimized', async function (assert) {
        await waitUntilOptimizedReady(expectAudit);
        expectAudit
          .module('./index.html')
          .resolves(/\/@embroider\/core\/entrypoint/)
          .toModule()
          .resolves(/-embroider-implicit-modules\.js/)
          .toModule()
          .withContents((_src, imports) => {
            const emberIndexImp = imports.find(imp => imp.source.includes('ember-source/ember/index.js'))!;
            assert.ok(!isOptimizedImport(emberIndexImp));
            return true;
          });
      });
    });

    Qmodule('optimized v1 addons can use v1 resolving rules', function (hooks) {
      let server: CommandWatcher;
      hooks.before(async () => {
        server = CommandWatcher.launch('vite', ['--clearScreen', 'false', '--force'], { cwd: app.dir });
        [, appURL] = await server.waitFor(/Local:\s*(.*)/);
      });
      let expectAudit = setupAuditTest(hooks, () => ({
        appURL,
        startingFrom: ['tests/index.html', 'index.html'],
        fetch: fetch as unknown as typeof globalThis.fetch,
      }));
      hooks.beforeEach(async () => {
        await server.shutdown();
        server = CommandWatcher.launch('vite', ['--clearScreen', 'false', '--force'], { cwd: app.dir });
        [, appURL] = await server.waitFor(/Local:\s*(.*)/);
      });
      hooks.afterEach(async () => {
        await server.shutdown();
        rmSync(join(app.dir, 'app/dep-tests.js'), { force: true });
      });

      test(`addon should be able to import app files`, async function (assert) {
        writeFileSync(join(app.dir, 'app/dep-tests.js'), `import 'my-services-addon/services/service';`);
        await server.waitFor(/page reload/);
        await waitUntilOptimizedReady(expectAudit);

        expectAudit
          .module('./index.html')
          .resolves(/\/@embroider\/core\/entrypoint/)
          .toModule()
          .resolves(/dep-tests\.js/)
          .toModule()
          .withContents((_src, imports) => {
            let pageTitleImports = imports.filter(imp => /my-services-addon/.test(imp.source));
            assert.strictEqual(pageTitleImports.length, 1, 'found two uses of page-title addon');
            assert.ok(
              pageTitleImports.every(isOptimizedImport),
              `every page-title module is optimized but we saw ${pageTitleImports.map(i => i.source).join(', ')}`
            );
            return true;
          });
      });
    });
  });
});
