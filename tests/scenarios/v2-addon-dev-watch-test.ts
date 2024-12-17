import path from 'path';
import { baseV2Addon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import { Scenarios } from 'scenario-tester';
import fs from 'fs/promises';
import { existsSync } from 'fs';
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
            addon.dependencies(),

            babel({ babelHelpers: 'bundled' }),

            addon.hbs(),

            addon.gjs(),

            addon.publicAssets('custom-public'),

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
          'test.gts': '<template></template>',
          'button.hbs': `
            <button {{on 'click' @onClick}}>
              flip
            </button>
          `,
          'other.hbs': '<div></div>',
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
        Qmodule('files are correctly synced', function (hooks) {
          let watcher: DevWatcher | null = null;
          let demoHbs = '';
          let demoJs = '';
          let distPath = '';
          let distPathDemoComp = '';
          let srcPathOther = '';
          let distPathOther = '';
          let distAppReExportPathOther = '';

          let origContent = '';
          let demoContent = '';
          let demoJsContent = '';

          hooks.before(async () => {
            demoHbs = path.join(addon.dir, 'src/components/demo.hbs');
            demoJs = path.join(addon.dir, 'src/components/demo.js');
            distPath = path.join(addon.dir, 'dist/components/test.js');
            distPathDemoComp = path.join(addon.dir, 'dist/components/demo.js');
            srcPathOther = path.join(addon.dir, 'src/components/other.hbs');
            distPathOther = path.join(addon.dir, 'dist/components/other.js');
            distAppReExportPathOther = path.join(addon.dir, 'dist/_app_/components/other.js');

            origContent = (await fs.readFile(srcPathOther)).toString();
            demoContent = (await fs.readFile(demoHbs)).toString();
            demoJsContent = (await fs.readFile(demoJs)).toString();
            watcher = new DevWatcher(addon);
            await watcher.start();
          });

          hooks.after(async () => {
            await watcher?.stop();
          });

          test('deleting a component from src should delete it from dist', async function (assert) {
            assert.strictEqual(
              existsSync(distAppReExportPathOther),
              true,
              `Expected ${distAppReExportPathOther} to exist`
            );

            await fs.rm(srcPathOther);
            // we expect 2 builds because appReexports plugin modifies package.json triggering a new build
            await watcher?.nextBuild(2);
            assert.strictEqual(
              existsSync(distAppReExportPathOther),
              false,
              `Expected ${distAppReExportPathOther} to be deleted`
            );
          });

          test('create a component in src should create it in dist', async function (assert) {
            await fs.writeFile(srcPathOther, origContent);
            // we expect 2 builds because appReexports plugin modifies package.json triggering a new build
            await watcher?.nextBuild(2);
            assert.strictEqual(
              existsSync(distAppReExportPathOther),
              true,
              `Expected ${distAppReExportPathOther} to exist`
            );
          });

          test('updating hbs modifies generated colocated js', async function (assert) {
            await becomesModified({
              filePath: distPathDemoComp,
              assert,
              fn: async () => {
                let someContent = await fs.readFile(demoHbs);
                await fs.writeFile(demoHbs, someContent + `\n`);
                await watcher?.nextBuild();
              },
            });
          });

          test('deleting hbs file updates dist component file', async function (assert) {
            await becomesModified({
              filePath: distPathDemoComp,
              assert,
              fn: async () => {
                await fs.rm(demoHbs);
                await watcher?.nextBuild();
              },
            });
          });

          test('creating hbs content should not update unrelated files', async function (assert) {
            await fs.writeFile(demoHbs, demoContent);
            await watcher?.nextBuild();

            await isNotModified({
              filePath: distPath,
              assert,
              fn: async () => {
                let someContent = await fs.readFile(demoHbs);
                await fs.writeFile(demoHbs, someContent + `\n\n`);
                await watcher?.nextBuild();
              },
            });
          });

          test('updating hbs content should not update resulting app re-exported component', async function (assert) {
            distPath = path.join(addon.dir, 'dist/_app_/components/test.js');
            await isNotModified({
              filePath: distPath,
              assert,
              fn: async () => {
                let someContent = await fs.readFile(demoHbs);
                await fs.writeFile(demoHbs, someContent + `\n`);
                await watcher?.nextBuild();
              },
            });
          });

          test('updating template only should update the dist output', async function (assert) {
            await becomesModified({
              filePath: distPathOther,
              assert,
              fn: async () => {
                let someContent = await fs.readFile(srcPathOther);
                await fs.writeFile(srcPathOther, someContent + `test\n`);
                await watcher?.nextBuild();
              },
            });
          });

          test('deleting demo.js should make demo a template only component', async function (assert) {
            await fs.rm(demoJs);
            await watcher?.nextBuild();
            let distPathDemoCompContent = await fs.readFile(distPathDemoComp);
            assert.true(distPathDemoCompContent.includes('templateOnly'));
          });

          test('creating demo.js should make demo a template colocated component', async function (assert) {
            void fs.writeFile(demoJs, demoJsContent);
            await watcher?.nextBuild();
            let distPathDemoCompContent = await fs.readFile(distPathDemoComp);
            assert.false(distPathDemoCompContent.includes('templateOnly'));
          });
        });

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
              await fs.rm(path.join(addon.dir, 'src/components/demo.js'));
              await watcher?.nextBuild();
              await fs.rm(path.join(addon.dir, 'src/components/demo.hbs'));
              // we expect 2 builds because appReexports plugin modifies package.json triggering a new build
              await watcher?.nextBuild(2);
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
