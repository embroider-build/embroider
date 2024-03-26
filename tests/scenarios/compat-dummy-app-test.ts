import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectRewrittenFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { Rebuilder } from '@embroider/test-support';
import type { PreparedApp } from 'scenario-tester';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import { writeFileSync } from 'fs';
import { join, resolve } from 'path';
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

      test('contains public assets from dummy app', async function () {
        // expectRewrittenFilesAt doesn't understand dummy apps, so even though
        // we initialized it on app.dir/tests/dummy, we can't just say
        // "robots.txt" here because it thinks that file belongs to the
        // containing addon. By writing out the rewritten paths ourselves we
        // sidestep that problem≥
        expectFile('../../node_modules/.embroider/rewritten-app/robots.txt').exists();
        expectFile('../../node_modules/.embroider/rewritten-app/package.json')
          .json()
          .get('ember-addon.assets')
          .includes('robots.txt');
      });
    });
  });
