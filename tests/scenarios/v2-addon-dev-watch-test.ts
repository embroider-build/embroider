import path from 'path';
import { baseV2Addon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import { Scenarios } from 'scenario-tester';
import fs from 'fs/promises';
import { pathExists } from 'fs-extra';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { DevWatcher, becomesModified, isNotModified } from './helpers';

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
            [ "@babel/plugin-transform-class-properties" ]
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
    addon.linkDevDependency('@babel/plugin-transform-class-properties', { baseDir: __dirname });
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

      hooks.beforeEach(async function (assert) {
        assert.notOk(watcher, 'a watcher failed to be cleaned up in a prior run');
        // None of these tests should take longer than even 1s, but
        // if something goes wrong, they could hang, and we don't want to hold up
        // all of C.I.
        assert.timeout(10_000);
      });

      hooks.afterEach(async () => {
        await watcher?.stop();
        watcher = undefined;
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
              await watcher?.nextBuild();
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
              await Promise.all([
                fs.rm(path.join(addon.dir, 'src/components/demo.js')),
                fs.rm(path.join(addon.dir, 'src/components/demo.hbs')),
              ]);
              await watcher?.nextBuild();
            },
          });
        });

        test('adding a new file triggers a re-build', async function (assert) {
          watcher = new DevWatcher(addon);

          await watcher.start();

          const src = path.join(addon.dir, 'src/components/foo.js');
          const dist = path.join(addon.dir, 'dist/components/foo.js');

          assert.false(await pathExists(src), 'src/components/foo.js does not exist');
          assert.false(await pathExists(dist), 'dist/components/foo.js does not exist');

          await fs.writeFile(
            src,
            `
            import Component from '@glimmer/component';
            export default class FooComponent extends Component {}
            `
          );

          assert.true(await pathExists(src), 'src/components/foo.js exists');

          await watcher.nextBuild();

          assert.true(
            (await fs.readFile(dist)).includes('FooComponent'),
            'dist/components/foo.js exists and has the right content'
          );
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

function aBit(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
