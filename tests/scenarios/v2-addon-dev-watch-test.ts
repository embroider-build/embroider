import path from 'path';
import { baseV2Addon } from './scenarios';
import { PreparedApp, Scenarios } from 'scenario-tester';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import QUnit from 'qunit';
import merge from 'lodash/merge';

const { module: Qmodule, test } = QUnit;

Scenarios.fromProject(() => baseV2Addon())
  .map('v2-addon-dev-watch', async addon => {
    addon.pkg.name = 'v2-addon';
    addon.pkg.files = ['dist'];
    addon.pkg.exports = {
      './*': './dist/*.js',
      './addon-main.js': './addon-main.js',
      './package.json': './package.json',
    };
    addon.pkg.scripts = {
      build: 'node ./node_modules/rollup/dist/bin/rollup -c ./rollup.config.mjs',
      start: 'node ./node_modules/rollup/dist/bin/rollup -c ./rollup.config.mjs --watch --no-watch.clearScreen',
    };

    merge(addon.files, {
      'babel.config.json': `
        {
          "presets": [
            ["@babel/preset-env"]
          ],
          "plugins": [
            "@embroider/addon-dev/template-colocation-plugin",
            ["@babel/plugin-proposal-decorators", { "legacy": true }],
            [ "@babel/plugin-proposal-class-properties" ]
          ]
        }
      `,
      'rollup.config.mjs': `
        import { babel } from '@rollup/plugin-babel';
        import { Addon } from '@embroider/addon-dev/rollup';

        const addon = new Addon({
          srcDir: 'src',
          destDir: 'dist',
        });

        export default {
          output: addon.output(),

          plugins: [
            addon.publicEntrypoints(['components/**/*.js']),
            addon.appReexports(['components/**/*.js']),
            addon.hbs(),
            addon.dependencies(),
            addon.publicAssets('custom-public'),

            babel({ babelHelpers: 'bundled' }),

            addon.clean(),
          ],
        };
      `,
      'custom-public': {
        'demo.css': `button { color: red; }`,
        'index.css': `button { color: green; }`,
      },
      src: {
        components: {
          'button.hbs': `
            <button {{on 'click' @onClick}}>
              flip
            </button>
          `,
          'out.hbs': `<out>{{yield}}</out>`,
          'demo.js': `
            import Component from '@glimmer/component';
            import { tracked } from '@glimmer/tracking';

            import FlipButton from './button';
            import Out from './out';

            export default class ExampleComponent extends Component {
              Button = FlipButton;
              Out = Out;

              @tracked active = false;

              flip = () => (this.active = !this.active);
            }
          `,
          'demo.hbs': `Hello there!
            <this.Out>{{this.active}}</this.Out>

            <this.Button @onClick={{this.flip}} />
            `,
        },
      },
    });

    addon.linkDependency('@embroider/addon-shim', { baseDir: __dirname });
    addon.linkDependency('@embroider/addon-dev', { baseDir: __dirname });
    addon.linkDependency('babel-plugin-ember-template-compilation', { baseDir: __dirname });
    addon.linkDevDependency('@babel/core', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-proposal-class-properties', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-proposal-decorators', { baseDir: __dirname });
    addon.linkDevDependency('@babel/preset-env', { baseDir: __dirname });
    addon.linkDevDependency('@rollup/plugin-babel', { baseDir: __dirname });
    addon.linkDevDependency('rollup', { baseDir: __dirname });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let addon: PreparedApp;
      let watcher: DevWatcher | undefined;

      hooks.before(async () => {
        addon = await scenario.prepare();

        // run the build *once* so we have a known stable state
        await addon.execute('pnpm build');
      });

      hooks.beforeEach(function (assert) {
        // None of these tests should take longer than even 1s, but
        // if something goes wrong, they could hang, and we don't want to hold up
        // all of C.I.
        assert.timeout(5_000);
      });

      hooks.afterEach(async () => {
        watcher?.stop();
      });

      Qmodule('Watching the addon via rollup -c -w', function () {
        test('the package.json is not updated since it would be the same', async function (assert) {
          watcher = new DevWatcher(addon);

          await watcher.start();

          let someFile = path.join(addon.dir, 'src/components/demo.hbs');
          let manifestPath = path.join(addon.dir, 'package.json');

          await isNotModified({
            filePath: manifestPath,
            assert,
            // Update a component
            fn: async () => {
              let someContent = await fs.readFile(someFile);

              // generally it's bad to introduce time dependencies to a test, but we need to wait long enough
              // to guess for how long it'll take for the file system to update our file.
              //
              // the `stat` is measured in `ms`, so it's still pretty fast
              await aBit(10);
              await fs.writeFile(someFile, someContent + `\n`);
            },
          });
        });

        test('the package.json *is* updated, since app-js changed', async function (assert) {
          watcher = new DevWatcher(addon);

          await watcher.start();

          let manifestPath = path.join(addon.dir, 'package.json');

          await becomesModified({
            filePath: manifestPath,
            assert,
            // Remove a component
            fn: async () => {
              // generally it's bad to introduce time dependencies to a test, but we need to wait long enough
              // to guess for how long it'll take for the file system to update our file.
              //
              // the `stat` is measured in `ms`, so it's still pretty fast
              await aBit(10);
              await fs.rm(path.join(addon.dir, 'src/components/demo.js'));
              await fs.rm(path.join(addon.dir, 'src/components/demo.hbs'));

              await watcher?.settled();
            },
          });
        });
      });

      test('the package.json *is* updated on a rebuild, since public assets changed', async function (assert) {
        let someFile = path.join(addon.dir, 'custom-public/demo.css');
        let manifestPath = path.join(addon.dir, 'package.json');

        await becomesModified({
          filePath: manifestPath,
          assert,
          // Delete a publicAsset
          fn: async () => {
            await fs.rm(someFile);
            // publicAssets are not watched, as they are not part of The Module Graph™
            await addon.execute('pnpm build');
          },
        });
      });
    });
  });

class DevWatcher {
  #addon: PreparedApp;
  #singletonAbort?: AbortController;
  #waitForBuildPromise?: Promise<unknown>;
  #lastBuild?: string;

  constructor(addon: PreparedApp) {
    this.#addon = addon;
  }

  start = () => {
    if (this.#singletonAbort) this.#singletonAbort.abort();

    this.#singletonAbort = new AbortController();

    /**
     * NOTE: when running rollup in a non-TTY environemnt, the "watching for changes" message does not print.
     */
    let rollupProcess = spawn('pnpm', ['start'], {
      cwd: this.#addon.dir,
      signal: this.#singletonAbort.signal,
      stdio: ['pipe', 'pipe', 'pipe'],
      // Have to disable color so our regex / string matching works easier
      // Have to include process.env, so the spawned environment has access to `pnpm`
      env: { ...process.env, NO_COLOR: '1' },
    });

    let settle: (...args: unknown[]) => void;
    let error: (...args: unknown[]) => void;
    this.#waitForBuildPromise = new Promise((resolve, reject) => {
      settle = resolve;
      error = reject;
    });

    if (!rollupProcess.stdout) {
      throw new Error(`Failed to start process, pnpm start`);
    }
    if (!rollupProcess.stderr) {
      throw new Error(`Failed to start process, pnpm start`);
    }

    let handleData = (data: Buffer) => {
      let string = data.toString();
      let lines = string.split('\n');

      let build = lines.find(line => line.trim().match(/^created dist in (.+)$/));
      let problem = lines.find(line => line.includes('Error:'));
      let isAbort = lines.find(line => line.includes('AbortError:'));

      if (isAbort) {
        // Test may have ended, we want to kill the watcher,
        // but not error, because throwing an error causes the test to fail.
        return settle();
      }

      if (problem) {
        console.error('\n!!!\n', problem, '\n!!!\n');
        error(problem);
        return;
      }

      if (build) {
        this.#lastBuild = build[1];

        settle?.();

        this.#waitForBuildPromise = new Promise((resolve, reject) => {
          settle = resolve;
          error = reject;
        });
      }
    };

    // NOTE: rollup outputs to stderr only, not stdout
    rollupProcess.stderr.on('data', (...args) => handleData(...args));
    rollupProcess.on('error', handleData);
    rollupProcess.on('close', () => settle?.());
    rollupProcess.on('exit', () => settle?.());

    return this.#waitForBuildPromise;
  };

  stop = () => this.#singletonAbort?.abort();
  settled = () => this.#waitForBuildPromise;
  get lastBuild() {
    return this.#lastBuild;
  }
}
async function becomesModified({
  filePath,
  assert,
  fn,
}: {
  filePath: string;
  assert: Assert;
  fn: () => Promise<void>;
}) {
  let oldStat = (await fs.stat(filePath)).mtimeMs;

  await fn();

  let newStat = (await fs.stat(filePath)).mtimeMs;

  assert.notStrictEqual(
    oldStat,
    newStat,
    `Expected ${filePath} to be modified. Latest: ${newStat}, previously: ${oldStat}`
  );
}

async function isNotModified({ filePath, assert, fn }: { filePath: string; assert: Assert; fn: () => Promise<void> }) {
  let oldStat = (await fs.stat(filePath)).mtimeMs;

  await fn();

  let newStat = (await fs.stat(filePath)).mtimeMs;

  assert.strictEqual(
    oldStat,
    newStat,
    `Expected ${filePath} to be unchanged. Latest: ${newStat}, and pre-fn: ${oldStat}`
  );
}

function aBit(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
