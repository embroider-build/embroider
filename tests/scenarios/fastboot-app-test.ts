import { appScenarios, baseAddon, baseV2Addon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import { Project } from 'scenario-tester';
import type { FastbootTestHelpers } from './helpers';
import { setupFastboot, loadFromFixtureData } from './helpers';
import { readFile } from 'fs/promises';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import type { JSDOM } from 'jsdom';
import globby from 'globby';
import { join } from 'path';
const { module: Qmodule, test } = QUnit;

appScenarios
  .map('fastboot-app-test', project => {
    project.pkg.fastbootDependencies = ['crypto', 'node-fetch'];

    project.addDependency(
      new Project('@embroider/sample-lib', '0.0.0', {
        files: {
          'index.js': `export default function () {
        return 'From sample-lib';
      }`,
        },
      })
    );

    project.addDependency(
      new Project('@embroider/second-sample-lib', '0.0.0', {
        files: {
          'index.js': `export default function () {
        return 'From second-sample-lib';
      }`,
        },
      })
    );

    let v2Example = baseV2Addon();
    v2Example.pkg.name = 'v2-example';
    (v2Example.pkg as any)['ember-addon']['app-js']['./components/v2-example-component.js'] =
      './app/components/v2-example-component.js';
    merge(v2Example.files, {
      app: {
        components: {
          'v2-example-component.js': `export { default } from 'v2-example/components/v2-example-component';`,
        },
      },
      components: {
        'v2-example-component.js': `
          import Component from '@glimmer/component';
          import { hbs } from 'ember-cli-htmlbars';
          import { setComponentTemplate } from '@ember/component';
          import './v2-example-component.css';
          const TEMPLATE = hbs('<div data-test-v2-example>{{this.message}}</div>')
          export default class ExampleComponent extends Component {
            message = "it worked"
          }
          setComponentTemplate(TEMPLATE, ExampleComponent);
        `,
        'v2-example-component.css': `
          [data-test-v2-example], .eager-styles-marker {
            color: green;
          }
        `,
        'extra-styles.css': `
          [data-test-v2-example], .lazy-styles-marker {
            background-color: blue;
          }
        `,
      },
    });
    project.addDependency(v2Example);

    project.linkDependency('ember-cli-fastboot', { baseDir: __dirname });
    project.linkDependency('fastboot', { baseDir: __dirname });

    let fastbootAddon = baseAddon();

    fastbootAddon.pkg.name = 'fastboot-addon';
    merge(fastbootAddon.files, loadFromFixtureData('fastboot-addon'));
    project.addDependency(fastbootAddon);

    // this fixes: Cannot find module 'abortcontroller-polyfill/dist/cjs-ponyfill'
    project.removeDependency('ember-fetch');

    merge(project.files, loadFromFixtureData('fastboot-app'));
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      ['production', 'development'].forEach(env => {
        test(`pnpm test: ${env}`, async function (assert) {
          let result = await app.execute(`pnpm vite build --mode ${env}`, {
            env: {
              FORCE_BUILD_TESTS: 'true',
            },
          });
          assert.equal(result.exitCode, 0, result.output);
          result = await app.execute(`pnpm ember test --path dist`);
          assert.equal(result.exitCode, 0, result.output);
        });

        Qmodule(`fastboot: ${env}`, function (hooks) {
          let fb: FastbootTestHelpers;
          let doc: JSDOM['window']['document'];

          hooks.before(async () => {
            fb = await setupFastboot(app, env, {
              FORCE_BUILD_TESTS: 'true',
            });
            doc = (await fb.visit('/')).window.document;
          });

          test('content is rendered', async function (assert) {
            assert.equal(doc.querySelector('[data-test="hello"]')!.textContent, 'Hello from fastboot-app');
          });
          test('found server implementation of in-app module', async function (assert) {
            assert.equal(doc.querySelector('[data-test="example"]')!.textContent, 'This is the server implementation');
          });
          test('found server implementation of addon service', async function (assert) {
            assert.equal(doc.querySelector('[data-test="addon-example"]')!.textContent, 'Server AddonExampleService');
          });
          test('found fastboot-only service from the app', async function (assert) {
            assert.equal(
              doc.querySelector('[data-test="check-service"]')!.textContent!.trim(),
              `I'm a fastboot-only service in the app`
            );
          });
          test('found fastboot-only file from the addon', async function (assert) {
            assert.equal(doc.querySelector('[data-test="check-addon-file"]')!.textContent!.trim(), '42');
          });
          test('a component successfully lazy loaded some code', async function (assert) {
            assert.equal(doc.querySelector('[data-test="lazy-component"]')!.textContent!.trim(), 'From sample-lib');
          });
          test('eager CSS from a v2 addon is present', async function (assert) {
            // TODO: replace with an Audit when it's ready to take any given dist
            let styles = await globby('dist/**/*.css', { cwd: app.dir });
            let readResult = await Promise.all(
              styles.map(async styleFile => {
                let content = await readFile(join(app.dir, styleFile));
                return content.toString();
              })
            );
            assert.true(
              readResult.some(content => /eager-styles-marker/.test(content)),
              'found expected style'
            );
          });
          test('lazy CSS from a v2 addon is present', async function (assert) {
            // TODO: replace with an Audit when it's ready to take any given dist
            let styles = await globby('dist/**/*.css', { cwd: app.dir });
            let readResult = await Promise.all(
              styles.map(async styleFile => {
                let content = await readFile(join(app.dir, styleFile));
                return content.toString();
              })
            );
            assert.true(
              readResult.some(content => /lazy-styles-marker/.test(content)),
              'found expected style'
            );
          });
        });
      });
    });
  });
