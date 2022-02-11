import path from 'path';
import { appScenarios, baseV2Addon } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import execa from 'execa';
import { pathExists } from 'fs-extra';

const { module: Qmodule, test } = QUnit;

/**
 * The type of addon this is testing with only works in
 * ember-source@3.25+
 */
appScenarios
  .skip('lts_3_16')
  .skip('lts_3_24')
  .map('v2 addon can have imports of template-only components', async project => {
    let addon = baseV2Addon();
    addon.pkg.name = 'v2-addon';
    addon.pkg.files = ['dist'];
    addon.pkg.exports = {
      './*': './dist/*',
      './addon-main.js': './addon-main.js',
    };

    merge(addon.files, {
      'babel.config.json': `
        {
          "presets": [
            ["@babel/preset-env", {
              "targets": ["last 1 firefox versions"]
            }]
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
            addon.publicEntrypoints([
              '**/*.js',
              'components/demo/out.hbs',
            ]),

            addon.appReexports([
              'components/**/*.js',
              'components/demo/out.hbs',
            ]),

            addon.hbs(),
            addon.dependencies(),

            babel({ babelHelpers: 'bundled' }),

            addon.clean(),
          ],
        };
      `,
      src: {
        components: {
          demo: {
            'button.hbs': `
              <button {{on 'click' @onClick}}>
                flip
              </button>
            `,
            'out.hbs': `
              <out>{{yield}}</out>
            `,
            'index.js': `
                import Component from '@glimmer/component';
                import { tracked } from '@glimmer/tracking';

                import FlipButton from './button';
                import BlahButton from './button.hbs';
                import Out from './out';

                export default class ExampleComponent extends Component {
                  Button = FlipButton;
                  Button2 = BlahButton;
                  Out = Out;

                  @tracked active = false;

                  flip = () => (this.active = !this.active);
                }
              `,
            'index.hbs': `
              Hello there!

              <this.Out>{{this.active}}</this.Out>

              <this.Button @onClick={{this.flip}} />
              <this.Button2 @onClick={{this.flip}} />
            `,
          },
        },
      },
    });

    addon.linkDependency('@embroider/addon-shim', { baseDir: __dirname });
    addon.linkDependency('@embroider/addon-dev', { baseDir: __dirname });
    addon.linkDevDependency('@babel/core', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-proposal-class-properties', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-proposal-decorators', { baseDir: __dirname });
    addon.linkDevDependency('@babel/preset-env', { baseDir: __dirname });
    addon.linkDevDependency('@rollup/plugin-babel', { baseDir: __dirname });
    addon.linkDevDependency('rollup', { baseDir: __dirname });

    project.addDevDependency(addon);

    merge(project.files, {
      tests: {
        'the-test.js': `
          import { click, render } from '@ember/test-helpers';
          import { hbs } from 'ember-cli-htmlbars';
          import { module, test } from 'qunit';
          import { setupRenderingTest } from 'ember-qunit';

          module('v2 addon tests', function (hooks) {
            setupRenderingTest(hooks);

            test('<Demo />', async function (assert) {
              await render(hbs\`<Demo />\`);

              assert.dom('out').containsText('false');

              await click('button');

              assert.dom('out').containsText('true');
            });

            test('<Demo::Out />', async function (assert) {
              await render(hbs\`<Demo::Out>hi</Demo::Out>\`);

              assert.dom('out').containsText('hi');
            });
          });
        `,
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      async function getAddonInfo() {
        let pkgPath = path.resolve(path.join(app.dir, 'node_modules/v2-addon/package.json'));
        let dir = path.dirname(pkgPath);

        return {
          dir,
          distDir: path.join(dir, 'dist'),
          build: async () => {
            let rollupBin = 'node_modules/rollup/dist/bin/rollup';

            await execa(path.join(dir, rollupBin), ['-c', './rollup.config.mjs'], {
              cwd: dir,
            });
          },
          reExports: async () => {
            let pkgInfo = await import(pkgPath);
            return pkgInfo['ember-addon']['app-js'] as Record<string, string>;
          },
        };
      }

      hooks.before(async () => {
        app = await scenario.prepare();

        let { build } = await getAddonInfo();

        await build();
      });

      Qmodule('The addon', function () {
        test('output directories exist', async function (assert) {
          let { distDir } = await getAddonInfo();

          assert.strictEqual(await pathExists(distDir), true, 'dist/');
          assert.strictEqual(await pathExists(path.join(distDir, '_app_')), true, 'dist/_app_');
        });

        test('package.json is modified appropriately', async function (assert) {
          let { reExports } = await getAddonInfo();

          assert.deepEqual(await reExports(), {
            './components/demo/index.js': './dist/_app_/components/demo/index.js',
            './components/demo/out.js': './dist/_app_/components/demo/out.js',
          });
        });

        test('the addon was built successfully', async function (assert) {
          let { reExports, dir } = await getAddonInfo();
          let files = Object.values(await reExports());

          assert.expect(files.length);

          for (let pathName of files) {
            assert.deepEqual(await pathExists(path.join(dir, pathName)), true, `pathExists: ${pathName}`);
          }
        });
      });

      Qmodule('Consuming app', function () {
        test(`yarn test`, async function (assert) {
          let result = await app.execute('yarn test');
          assert.equal(result.exitCode, 0, result.output);
        });
      });
    });
  });
