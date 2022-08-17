import { ExpectFile, expectFilesAt, Rebuilder } from '@embroider/test-support';
import { PreparedApp } from 'scenario-tester';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;

import { dummyAppScenarios } from './scenarios';

dummyAppScenarios
  .map('compat-dummy-app-tests', project => {
    merge(project.files, {
      addon: {
        components: {
          'example.hbs': `hello`,
        },
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
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let builder: Rebuilder;
      let expectFile: ExpectFile;

      hooks.before(async () => {
        app = await scenario.prepare();
        builder = await Rebuilder.create(app.dir, { STAGE2_ONLY: 'true' });
      });
      hooks.after(async () => {
        await builder?.shutdown();
      });

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(readFileSync(join(builder.outputPath, '.stage2-output'), 'utf8'), { qunit: assert });
      });

      test('rebuilds addon code', async function () {
        expectFile('../../components/example.hbs').matches(/hello/);
        writeFileSync(join(app.dir, 'addon/components/example.hbs'), 'goodbye');
        await builder.build({ changedDirs: [app.dir] });
        expectFile('../../components/example.hbs').matches(/goodbye/);
      });

      test('contains public assets from dummy app', async function () {
        expectFile('robots.txt').exists();
        expectFile('package.json').json().get('ember-addon.assets').includes('robots.txt');
      });
    });
  });
