import type { PreparedApp } from 'scenario-tester';
import { webpackAppScenarios } from './scenarios';
import QUnit from 'qunit';
import { readdirSync, readFileSync, existsSync } from 'fs-extra';
import { join } from 'path';

const { module: Qmodule, test } = QUnit;

// The modern @embroider/webpack mirrors @embroider/vite: the app keeps its real
// index.html / tests/index.html, the compat prebuild produces the .embroider
// working directory, and webpack does the bundling using @embroider/core's
// Resolver + virtual content. The webpack wiring (ember-cli-build.js,
// webpack.config.js, scripts, and the @embroider/webpack + webpack + webpack-cli
// devDependencies) now lives in the dedicated `app-template-webpack` template,
// so this scenario only layers on the test fixtures it asserts against.
// Expanded across the same Ember matrix as `vite-app-basics`
// (fullSupportMatrix), producing `<emberVersion>-webpack-app-basics`.
webpackAppScenarios
  .map('webpack-app-basics', project => {
    project.mergeFiles({
      app: {
        components: {
          'fancy.hbs': `<div class="fancy">hello from fancy</div>`,
        },
        templates: {
          'application.hbs': `<div data-test-app>app booted</div><Fancy />{{outlet}}`,
        },
      },
      tests: {
        acceptance: {
          'smoke-test.js': `
            import { module, test } from 'qunit';
            import { visit } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';

            module('Acceptance | smoke', function (hooks) {
              setupApplicationTest(hooks);

              test('the app boots and renders a component', async function (assert) {
                await visit('/');
                assert.dom('[data-test-app]').hasText('app booted');
                assert.dom('.fancy').hasText('hello from fancy');
              });
            });
          `,
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test('pnpm build (production)', async function (assert) {
        assert.timeout(10 * 60 * 1000);
        let result = await app.execute('pnpm build');
        assert.equal(result.exitCode, 0, result.output);

        let distDir = join(app.dir, 'dist');
        assert.ok(existsSync(join(distDir, 'index.html')), 'dist/index.html exists');
        let html = readFileSync(join(distDir, 'index.html'), 'utf8');

        assert.notOk(/\{\{content-for/.test(html), 'content-for placeholders were substituted');
        // the inline app boot module + vendor.js were turned into real built
        // assets (no more resolver-virtual js references in the html)
        assert.notOk(html.includes('/@embroider/virtual/vendor.js'), 'vendor.js was bundled/emitted');
        assert.ok(/assets\/.*\.js/.test(html), 'index.html references a built js asset');

        let distFiles = readdirSync(distDir);
        assert.ok(distFiles.includes('assets'), 'an assets directory was produced');
        // the synthesized app styles are emitted as a public asset, exactly
        // like @embroider/vite does (the <link> keeps pointing at it).
        assert.ok(existsSync(join(distDir, '@embroider', 'virtual', 'app.css')), 'app.css public asset was emitted');
      });

      test('pnpm test:ember (development build + ember test)', async function (assert) {
        assert.timeout(10 * 60 * 1000);
        let result = await app.execute('pnpm test:ember');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
