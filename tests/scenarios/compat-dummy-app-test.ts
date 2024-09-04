import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectRewrittenFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { Rebuilder } from '@embroider/test-support';
import type { PreparedApp } from 'scenario-tester';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import { readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;
import fetch from 'node-fetch';

import { dummyAppScenarios } from './scenarios';
import CommandWatcher from './helpers/command-watcher';

dummyAppScenarios
  .skip()
  .map('compat-dummy-app-tests', project => {
    merge(project.files, {
      addon: {
        components: {
          'example.hbs': `hello`,
        },
      },
      public: {
        'from-addon.txt': 'a public asset provided by the classic addon',
      },
      tests: {
        dummy: {
          public: {
            'robots.txt': 'go away bots',
          },
        },
      },
    });
    project.linkDevDependency('@embroider/core', { baseDir: __dirname });
    project.linkDevDependency('@embroider/compat', { baseDir: __dirname });
    project.linkDevDependency('@embroider/webpack', { baseDir: __dirname });
  })
  .forEachScenario(scenario => {
    Qmodule(`${scenario.name} - rebuild`, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let builder: Rebuilder;
      let expectFile: ExpectFile;

      hooks.before(async () => {
        app = await scenario.prepare();
        builder = await Rebuilder.create(app.dir, { EMBROIDER_PREBUILD: 'true' });
      });
      hooks.after(async () => {
        await builder?.shutdown();
      });

      hooks.beforeEach(assert => {
        expectFile = expectRewrittenFilesAt(resolve(app.dir, 'tests/dummy'), {
          qunit: assert,
        });
      });

      test('rebuilds addon code', async function () {
        expectFile('../../components/example.hbs').matches(/hello/);
        writeFileSync(join(app.dir, 'addon/components/example.hbs'), 'goodbye');
        await builder.build({ changedDirs: [app.dir] });
        expectFile('../../components/example.hbs').matches(/goodbye/);
      });
    });

    Qmodule(`${scenario.name} - public assets`, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test('production build contains public assets from both addon and dummy app after a build', async function (assert) {
        let result = await app.execute(`pnpm vite build`);
        assert.equal(result.exitCode, 0, result.output);
        let content = readFileSync(`${app.dir}/dist/robots.txt`).toString();
        assert.strictEqual(content, 'go away bots');
        content = readFileSync(`${app.dir}/dist/addon-template/from-addon.txt`).toString();
        assert.strictEqual(content, 'a public asset provided by the classic addon');
      });

      test('dev mode serves public assets from both addon and dummy app', async function (assert) {
        const server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
        try {
          const [, url] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);
          let response = await fetch(`${url}/robots.txt`);
          let text = await response.text();
          assert.strictEqual(text, 'go away bots');

          response = await fetch(`${url}/addon-template/from-addon.txt`);
          text = await response.text();
          assert.strictEqual(text, 'a public asset provided by the classic addon');
        } finally {
          await server.shutdown();
        }
      });
    });
  });
