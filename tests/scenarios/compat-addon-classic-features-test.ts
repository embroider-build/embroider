import { throwOnWarnings } from '@embroider/core';
import { lstatSync, readFileSync } from 'fs';
import { merge } from 'lodash';
import QUnit from 'qunit';
import type { PreparedApp } from 'scenario-tester';
import fetch from 'node-fetch';
import globby from 'globby';
import { join } from 'path';

import { appScenarios, baseAddon } from './scenarios';
import CommandWatcher from './helpers/command-watcher';

const { module: Qmodule, test } = QUnit;

appScenarios
  .map('compat-addon-classic-features-content-for', project => {
    let myAddon = baseAddon();
    myAddon.pkg.name = 'my-addon';
    merge(myAddon.files, {
      'index.js': `
        module.exports = {
          name: require('./package.json').name,
          contentFor: function (type) {
            switch (type) {
              case 'body':
                return '<p>Content for body</p>';
              case 'custom':
                return '<p>Content for custom</p>';
              default:
                return '';
            }
          }
        }
      `,
    });
    project.addDependency(myAddon);

    merge(project.files, {
      'ember-cli-build.js': `
        'use strict';

        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { maybeEmbroider } = require('@embroider/test-setup');
        
        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {
            ...(process.env.FORCE_BUILD_TESTS ? {
              tests: true,
            } : undefined),
          });
        
          return maybeEmbroider(app, {
            availableContentForTypes: ['custom'],
            skipBabel: [
              {
                package: 'qunit',
              },
            ],
          });
        };
      `,
      app: {
        'index.html': `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>AppTemplate</title>
              <meta name="description" content="">
              <meta name="viewport" content="width=device-width, initial-scale=1">
          
              {{content-for "head"}}
          
              <link integrity="" rel="stylesheet" href="{{rootURL}}assets/vendor.css">
              <link integrity="" rel="stylesheet" href="{{rootURL}}assets/app-template.css">
          
              {{content-for "head-footer"}}
            </head>
            <body>
              {{content-for "body"}}
              {{content-for "custom"}}
          
              <script src="{{rootURL}}assets/vendor.js"></script>
              <script src="{{rootURL}}assets/app-template.js"></script>
          
              {{content-for "body-footer"}}
            </body>
          </html>
        `,
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test('content-for are replaced: build mode', async function (assert) {
        let result = await app.execute(`pnpm build`, {
          env: {
            // Force building tests so we can check the content of /tests/index.html
            // and assert it can be different from index.html
            FORCE_BUILD_TESTS: 'true',
          },
        });
        assert.equal(result.exitCode, 0, result.output);

        let content = readFileSync(`${app.dir}/dist/index.html`).toString();
        assert.true(content.includes('<p>Content for body</p>'));
        assert.true(content.includes('<p>Content for custom</p>'));

        content = readFileSync(`${app.dir}/dist/tests/index.html`).toString();
        assert.true(content.includes('<p>Content for body</p>'));
        assert.true(!content.includes('<p>Content for custom</p>'));
      });

      test('content-for are replaced: dev mode', async function (assert) {
        const server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
        try {
          const [, url] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);
          let response = await fetch(`${url}/`);
          let text = await response.text();
          assert.true(text.includes('<p>Content for body</p>'));
          assert.true(text.includes('<p>Content for custom</p>'));
        } finally {
          await server.shutdown();
        }
      });
    });
  });

appScenarios
  .map('compat-addon-classic-features-virtual-scripts', () => {})
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test('virtual scripts are emitted in the build', async function (assert) {
        let result = await app.execute('pnpm build');
        assert.equal(result.exitCode, 0, result.output);

        assert.true(lstatSync(`${app.dir}/dist/@embroider/core/vendor.js`).isFile());
        assert.true(lstatSync(`${app.dir}/dist/@embroider/core/test-support.js`).isFile());
      });

      test('virtual scripts contents are served in dev mode', async function (assert) {
        const server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
        try {
          const [, url] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);

          let response = await fetch(`${url}/@embroider/core/vendor.js`);
          assert.strictEqual(response.status, 200);
          // checking the response status 200 is not enough to assert vendor.js is served,
          // because when the URL is not recognized, the response contains the index.html
          // and has a 200 status (for index.html being returned correctly)
          let text = await response.text();
          assert.true(!text.includes('<!DOCTYPE html>'));

          response = await fetch(`${url}/@embroider/core/test-support.js`);
          assert.strictEqual(response.status, 200);
          // checking the response status 200 is not enough to assert test-support.js is served,
          // because when the URL is not recognized, the response contains the index.html
          // and has a 200 status (for index.html being returned correctly)
          text = await response.text();
          assert.true(!text.includes('<!DOCTYPE html>'));
        } finally {
          await server.shutdown();
        }
      });
    });
  });

appScenarios
  .map('compat-addon-classic-features-virtual-styles', project => {
    let myAddon = baseAddon();
    myAddon.pkg.name = 'my-addon';
    merge(myAddon.files, {
      addon: {
        styles: {
          'addon.css': `
            .my-addon-p { color: blue; }
          `,
        },
      },
    });
    project.addDependency(myAddon);
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test('virtual styles are included in the CSS of the production build', async function (assert) {
        let result = await app.execute('pnpm build');
        assert.equal(result.exitCode, 0, result.output);

        let [mainStyles] = await globby('dist/assets/main-*.css', { cwd: app.dir });
        let content = readFileSync(join(app.dir, mainStyles)).toString();
        assert.true(content.includes('.my-addon-p{color:#00f}'));
      });

      test('virtual styles are included in the CSS of the test build', async function (assert) {
        let result = await app.execute('pnpm test');
        assert.equal(result.exitCode, 0, result.output);

        let [mainStyles] = await globby('dist/assets/app-template-*.css', { cwd: app.dir });
        let content = readFileSync(join(app.dir, mainStyles)).toString();
        assert.true(content.includes('.my-addon-p{color:#00f}'));

        let [testStyles] = await globby('dist/assets/tests-*.css', { cwd: app.dir });
        content = readFileSync(join(app.dir, testStyles)).toString();
        assert.true(content.includes('#qunit-tests'));
      });

      test('virtual styles are served in dev mode', async function (assert) {
        const server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
        try {
          const [, url] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);

          let response = await fetch(`${url}/@embroider/core/vendor.css?direct`);
          let text = await response.text();
          assert.true(text.includes('.my-addon-p { color: blue; }'));

          response = await fetch(`${url}/@embroider/core/test-support.css?direct`);
          text = await response.text();
          assert.true(text.includes('#qunit-tests'));
        } finally {
          await server.shutdown();
        }
      });
    });
  });
