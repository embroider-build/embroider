import { throwOnWarnings } from '@embroider/core';
import { readFileSync } from 'fs';
import { merge } from 'lodash';
import QUnit from 'qunit';
import type { PreparedApp } from 'scenario-tester';
import fetch from 'node-fetch';

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
