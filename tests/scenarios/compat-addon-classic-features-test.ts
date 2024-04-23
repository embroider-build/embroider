import { merge } from 'lodash';
import QUnit from 'qunit';
import type { PreparedApp } from 'scenario-tester';
import fetch from 'node-fetch';

import { appScenarios } from './scenarios';
import CommandWatcher from './helpers/command-watcher';

const { module: Qmodule, test } = QUnit;

appScenarios
  .map('compat-addon-classic-features-virtual-scripts', project => {
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
    });
  })
  .forEachScenario(scenario => {
    Qmodule(`${scenario.name}`, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test('vendor.js script is served', async function (assert) {
        const server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
        try {
          const [, url] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);
          let response = await fetch(`${url}/assets/vendor.js`);
          assert.strictEqual(response.status, 200);
          // checking the response status 200 is not enough to assert vendor.js is served,
          // because when the URL is not recognized, the response contains the index.html
          // and has a 200 status (for index.html being returned correctly)
          let text = await response.text();
          assert.true(!text.includes('<!DOCTYPE html>'));
        } finally {
          await server.shutdown();
        }
      });
    });
  });
