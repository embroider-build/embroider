import path from 'path';
import { baseV2Addon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import { Scenarios } from 'scenario-tester';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { TsdownWatcher, waitUntil } from './helpers';

const { module: Qmodule, test } = QUnit;

// Mirrors `v2-addon-dev-watch-test.ts` but drives `tsdown --watch` (via
// TsdownWatcher / CommandWatcher) instead of the rollup-only DevWatcher.
//
// These tests edit files that already exist at startup and poll the resulting
// dist with `waitUntil` (tsdown's rebuild cadence differs from rollup's, and the
// reused `clean` plugin skips rewriting unchanged output, so counting rebuilds
// is unreliable).
//
// NOTE: the `@embroider/addon-dev/tsdown` builder discovers the public
// entrypoint set once, when the config is evaluated, so *adding or removing*
// public-entrypoint files while `tsdown --watch` is running is not reflected
// until the watcher is restarted (rollup's `publicEntrypoints` re-globs on every
// rebuild). These tests therefore only exercise edits to existing files.
Scenarios.fromProject(() => baseV2Addon())
  .map('v2-addon-dev-tsdown-watch', async addon => {
    addon.pkg.name = 'v2-addon';
    addon.pkg.files = ['dist'];
    addon.pkg.exports = {
      './*': './dist/*.js',
      './addon-main.js': './addon-main.js',
      './package.json': './package.json',
    };
    addon.pkg.scripts = {
      build: 'tsdown',
    };

    merge(addon.files, {
      'babel.config.json': `
        {
          "presets": [
            ["@babel/preset-env"]
          ],
          "plugins": [
            "@embroider/addon-dev/template-colocation-plugin",
            ["babel-plugin-ember-template-compilation", { "targetFormat": "hbs" }],
            ["@babel/plugin-proposal-decorators", { "legacy": true }],
            [ "@babel/plugin-transform-class-properties" ]
          ]
        }
      `,
      'tsdown.config.js': `
        import { babel } from '@rollup/plugin-babel';
        import { defineConfig } from 'tsdown';
        import { Addon } from '@embroider/addon-dev/rollup';
        import { tsdown } from '@embroider/addon-dev/tsdown';

        const addon = new Addon({
          srcDir: 'src',
          destDir: 'dist',
        });

        export default defineConfig(
          tsdown(addon, {
            publicEntrypoints: ['components/**/*.js'],
            appReexports: ['components/**/*.js'],
            declarations: false,
            plugins: [
              babel({ babelHelpers: 'bundled', extensions: ['.js', '.hbs', '.gjs'] }),
            ],
          })
        );
      `,
      src: {
        components: {
          'button.hbs': `
            <button {{on 'click' @onClick}}>
              flip
            </button>
          `,
          'other.hbs': '<div>original</div>',
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
    addon.linkDependency('babel-plugin-ember-template-compilation', {
      baseDir: __dirname,
    });
    addon.linkDevDependency('@babel/core', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-transform-class-properties', {
      baseDir: __dirname,
    });
    addon.linkDevDependency('@babel/plugin-proposal-decorators', {
      baseDir: __dirname,
    });
    addon.linkDevDependency('@babel/preset-env', { baseDir: __dirname });
    addon.linkDevDependency('@rollup/plugin-babel', { baseDir: __dirname });
    addon.linkDevDependency('content-tag', { baseDir: __dirname });
    addon.linkDevDependency('tsdown', { baseDir: __dirname });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let addon: PreparedApp;
      let watcher: TsdownWatcher | null = null;

      let demoHbs = '';
      let demoJs = '';
      let otherHbs = '';
      let distPathDemoComp = '';
      let distPathOther = '';

      function distContent(filePath: string): string {
        return readFileSync(filePath, { encoding: 'utf8' });
      }

      hooks.before(async () => {
        addon = await scenario.prepare();
        // run the build *once* so we have a known stable state
        await addon.execute('pnpm build');

        demoHbs = path.join(addon.dir, 'src/components/demo.hbs');
        demoJs = path.join(addon.dir, 'src/components/demo.js');
        otherHbs = path.join(addon.dir, 'src/components/other.hbs');
        distPathDemoComp = path.join(addon.dir, 'dist/components/demo.js');
        distPathOther = path.join(addon.dir, 'dist/components/other.js');

        watcher = await TsdownWatcher.start(addon.dir);
      });

      hooks.after(async () => {
        await watcher?.stop();
        watcher = null;
      });

      test('updating an hbs file updates the generated colocated js', async function (assert) {
        await fs.writeFile(demoHbs, 'Updated colocated marker {{this.active}}\n');
        await waitUntil(() => distContent(distPathDemoComp).includes('Updated colocated marker'));
        assert.ok(
          distContent(distPathDemoComp).includes('Updated colocated marker'),
          'colocated js reflects the new template'
        );
      });

      test('updating a template-only hbs updates the dist output', async function (assert) {
        await fs.writeFile(otherHbs, '<div>updated template only</div>');
        await waitUntil(() => distContent(distPathOther).includes('updated template only'));
        assert.ok(
          distContent(distPathOther).includes('updated template only'),
          'template-only dist output reflects the change'
        );
      });

      test('updating the js of a colocated component updates the dist output', async function (assert) {
        let updated = readFileSync(demoJs, { encoding: 'utf8' }).replace(
          'flip = () => (this.active = !this.active);',
          'flip = () => (this.active = !this.active);\n  uniqueMarker = 42;'
        );
        await fs.writeFile(demoJs, updated);
        await waitUntil(() => distContent(distPathDemoComp).includes('uniqueMarker'));
        assert.ok(distContent(distPathDemoComp).includes('uniqueMarker'), 'colocated js reflects the source change');
      });
    });
  });
