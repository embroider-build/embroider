import { appScenarios, baseAddon, baseV2Addon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import CommandWatcher from './helpers/command-watcher';
import { setupAuditTest, type Import } from '@embroider/test-support/audit-assertions';
import fetch from 'node-fetch';
import { writeFileSync, readdirSync, rmSync, existsSync } from 'fs-extra';
import { join } from 'path';
import execa from 'execa';
import os from 'os';

const { module: Qmodule, test } = QUnit;

const rebuildTimeout = os.platform() === 'win32' ? 300000 : 5000;

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
            import app from 'app-template/config/environment';

            console.log(app);
            const foo=1;
            export default foo;
          `,
      },
    },
  });
  project.addDevDependency(myServicesAddon);

  // Regression test for https://github.com/embroider-build/embroider/issues/2660:
  // The bug occurs when two v2 addons both use @embroider/macros and one consumes the other
  // (simulating separate-repo addons). @embroider/macros must be dep-optimized so there is
  // only a single runtime instance shared across all addons.
  //
  // addon-1: the consumed addon (simulating a separate-repo v2 addon with its own @embroider/macros)
  let macrosAddon1 = baseV2Addon();
  macrosAddon1.pkg.name = 'my-macros-addon-1';
  macrosAddon1.linkDependency('@embroider/macros', { baseDir: __dirname });
  macrosAddon1.mergeFiles({
    'is-testing.js': `
      import { isTesting } from '@embroider/macros';
      export function getIsTestingFromAddon1() { return isTesting(); }
    `,
  });

  // addon-2: the consuming addon that depends on addon-1 and also uses @embroider/macros itself.
  // It re-exports addon-1's function so that the test can import both without needing
  // addon-1 as a direct dependency of the app (strict node_modules resolution requires
  // every imported package to be declared in the importer's package.json).
  let macrosAddon2 = baseV2Addon();
  macrosAddon2.pkg.name = 'my-macros-addon-2';
  macrosAddon2.linkDependency('@embroider/macros', { baseDir: __dirname });
  macrosAddon2.addDependency(macrosAddon1);
  macrosAddon2.mergeFiles({
    'is-testing.js': `
      import { isTesting } from '@embroider/macros';
      export { getIsTestingFromAddon1 } from 'my-macros-addon-1/is-testing';
      export function getIsTestingFromAddon2() { return isTesting(); }
    `,
  });

  project.addDevDependency(macrosAddon2);
  project.linkDevDependency('@embroider/macros', { baseDir: __dirname });

  // This file creates the import chain that makes @embroider/macros discoverable by Vite's dep scanner.
  // Without importing from my-macros-addon-2, @embroider/macros wouldn't appear in the dep graph,
  // and the macros regression assertion in the 'created initial optimized deps' test wouldn't be able
  // to verify it's optimized.
  project.mergeFiles({
    tests: {
      unit: {
        'macros-addon-test.js': `
          import { getIsTestingFromAddon1, getIsTestingFromAddon2 } from 'my-macros-addon-2/is-testing';
          export { getIsTestingFromAddon1, getIsTestingFromAddon2 };
        `,
      },
    },
  });
});

async function rerunUntilReady(expectAudit: ReturnType<typeof setupAuditTest>) {
  for (let i = 0; i < 30; i++) {
    try {
      await expectAudit.rerun();
      return;
    } catch (e) {
      if (!e.message.includes('oops status code 504 - Outdated Optimize Dep for')) {
        throw e;
      }
    }
  }
  throw new Error('failed to rerun');
}

app.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    let appURL: string;
    let optimizedFiles = [];

    hooks.before(async () => {
      app = await scenario.prepare();
    });

    function isOptimizedImport(imp: Import) {
      return /\.vite\/deps/.test(imp.source);
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

    Qmodule('vite esbuild dep scan', function (hooks) {
      let server: CommandWatcher;
      hooks.before(async () => {
        server = CommandWatcher.launch('vite', ['--force', '--clearScreen', 'false'], { cwd: app.dir });
        [, appURL] = await server.waitFor(/Local:\s*(.*)/);
      });
      hooks.after(async () => {
        await server.shutdown();
      });
      test('initial dep scan', async function (assert) {
        // wait until deps are generated without accessing any API
        await execa('pnpm', ['vite', 'optimize', '--force'], {
          cwd: app.dir,
          env: {
            EMBROIDER_VITE_COMMAND: 'build',
          },
        });
        assert.ok(existsSync(join(app.dir, 'node_modules', '.vite')));
        const deps = readdirSync(join(app.dir, 'node_modules', '.vite'))[0];
        let currentOptimizedFiles = readdirSync(join(app.dir, 'node_modules', '.vite', deps)).filter(f =>
          f.endsWith('.js')
        );
        optimizedFiles.push(...currentOptimizedFiles);
      });
    });

    Qmodule(`vite dep tests`, function (hooks) {
      let server: CommandWatcher;
      hooks.before(async () => {
        server = CommandWatcher.launch('vite', ['--force', '--clearScreen', 'false'], { cwd: app.dir });
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
        optimizedFiles = readdirSync(join(app.dir, 'node_modules', '.vite', 'deps')).filter(f => f.endsWith('.js'));
        // must be the same as initial scan, otherwise it means we are missing some in the esbuild scan
        assert.ok(optimizedFiles.length > 0, `should have created optimized deps: ${optimizedFiles.length}`);
      });

      test('should use all optimized deps', function (assert) {
        allDepFilesAreUsed(expectAudit, assert, optimizedFiles);
      });

      test('all deps are optimized', function (assert) {
        const allow = ['vite/dist/client/env.mjs', '@babel+runtime', '.css', '@embroider/macros'];
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
        expectAudit.module(/.*\/-embroider-entrypoint.js/).withContents((_src, imports) => {
          let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
          assert.strictEqual(pageTitleImports.length, 2, 'found two uses of page-title addon');
          assert.ok(
            pageTitleImports.every(x => isOptimizedImport(x)),
            `every page-title module is optimized but we saw ${pageTitleImports.map(i => i.source).join(', ')}`
          );
          return true;
        });
      });
    });

    Qmodule('should optimize newly added deps', function (hooks) {
      let server: CommandWatcher;
      hooks.before(async () => {
        writeFileSync(join(app.dir, 'app/dep-tests.js'), ``);
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
        await expectAudit.rerun();
        writeFileSync(
          join(app.dir, 'app/dep-tests.js'),
          `
        import 'ember-page-title/helpers/page-title';
      `
        );
        await server.waitFor(/page reload/, rebuildTimeout);
        await rerunUntilReady(expectAudit);

        expectAudit.module(/dep-tests\.js/).withContents((_src, imports) => {
          let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
          assert.strictEqual(pageTitleImports.length, 1, `found one uses of page-title addon: ${imports}`);
          assert.ok(
            pageTitleImports.every(isOptimizedImport),
            `every page-title module is optimized but we saw ${pageTitleImports.map(i => i.source).join(', ')}`
          );
          return true;
        });
      });

      test('all optimized deps are used', async function (assert) {
        await expectAudit.rerun();
        const optimizedFiles = readdirSync(join(app.dir, 'node_modules', '.vite', 'deps')).filter(f =>
          f.endsWith('.js')
        );
        allDepFilesAreUsed(expectAudit, assert, optimizedFiles);
      });

      test(`should optimize newly added deps via appjs match`, async function (assert) {
        await expectAudit.rerun();
        writeFileSync(
          join(app.dir, 'app/dep-tests.js'),
          `
        import 'app-template/helpers/page-title';
      `
        );
        await server.waitFor(/page reload/, rebuildTimeout);
        await rerunUntilReady(expectAudit);

        expectAudit.module(/dep-tests\.js/).withContents((_src, imports) => {
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
        await expectAudit.rerun();
        writeFileSync(
          join(app.dir, 'app/dep-tests.js'),
          `
        import './helpers/page-title';
      `
        );
        await server.waitFor(/page reload/, rebuildTimeout);
        await rerunUntilReady(expectAudit);

        expectAudit.module(/dep-tests\.js/).withContents((_src, imports) => {
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
        await expectAudit.rerun();
        writeFileSync(
          join(app.dir, 'app/dep-tests.js'),
          `
        import './helpers/page-title';
        import 'app-template/helpers/page-title';
        import '@embroider/virtual/helpers/page-title';
        import 'ember-page-title/_app_/helpers/page-title.js';
        // todo: import 'ember-page-title/_app_/helpers/page-title';
      `
        );
        await server.waitFor(/page reload/, rebuildTimeout);
        await rerunUntilReady(expectAudit);

        expectAudit.module(/dep-tests\.js/).withContents((_src, imports) => {
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

      test(`addon should be able to import app files and not include it in the chunks`, async function (assert) {
        await expectAudit.rerun();
        writeFileSync(
          join(app.dir, 'app/dep-tests.js'),
          `
        import * as service from 'my-services-addon/services/service';
        console.log(service);
        `
        );
        await server.waitFor(/page reload/, rebuildTimeout);
        await rerunUntilReady(expectAudit);

        expectAudit
          .module(/dep-tests\.js/)
          .resolves(/my-services-addon/)
          .toModule()
          .resolves(/chunk-.*\.js/)
          .toModule()
          .withContents((_src, imports) => {
            const appImport = imports.find(i => i.source.match(/\/environment\.js/));
            assert.ok(appImport, 'should import app: ' + imports.map(i => i.source));
            return true;
          });
      });
    });
  });
});
