import type { PreparedApp, Project } from 'scenario-tester';
import { appScenarios, baseAddon, dummyAppScenarios, renameApp } from './scenarios';
import { resolve, join } from 'path';
import { Transpiler } from '@embroider/test-support';
import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectRewrittenFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import QUnit from 'qunit';
import { readJsonSync, writeJsonSync } from 'fs-extra';

const { module: Qmodule, test } = QUnit;

let stage2Scenarios = appScenarios.map('compat-stage2-build', app => {
  renameApp(app, 'my-app');
});

stage2Scenarios
  .map('in-repo-addons-of-addons', app => {
    app.mergeFiles({
      app: {
        'lib.js': 'export {default} from "dep-a/check-resolution.js"',
      },
      tests: {
        unit: {
          'in-repo-addons-of-addons.js': `import { module, test } from 'qunit';

          import libJS from 'my-app/lib';
          import inRepo from 'my-app/service/in-repo';
          import secondaryService from 'my-app/services/secondary';
          import primaryService from 'my-app/services/primary';

          module('Unit | basics', function () {
            test('libJS resolution comes from the right place', async function (assert) {
              assert.strictEqual(libJS, 'in-repo-a|check-resolution-target.js');
            });

            test('inRepo resolution comes from the right place', async function (assert) {
              assert.strictEqual(inRepo, 'in-repo-c|service|in-repo.js');
            });

            test('secondaryService resolution comes from the right place', async function (assert) {
              assert.strictEqual(secondaryService, 'secondary-in-repo-addon|service|secondary.js');
            });

            test('primaryService resolution comes from the right place', async function (assert) {
              assert.strictEqual(primaryService, 'secondary-in-repo-addon|component|secondary.js');
            });
          })
          `,
        },
      },
    });

    let depA = addAddon(app, 'dep-a');
    let depB = addAddon(app, 'dep-b');
    let depC = addAddon(app, 'dep-c');

    addInRepoAddon(depC, 'in-repo-d', {
      app: { service: { 'in-repo.js': 'export default "in-repo-d|service|in-repo.js";' } },
    });
    addInRepoAddon(depA, 'in-repo-a', {
      app: { service: { 'in-repo.js': 'export default "in-repo-a|service|in-repo.js";' } },
      addon: {
        'check-resolution-target.js': 'export default "in-repo-a|check-resolution-target.js";',
      },
    });
    merge(depA.files, {
      addon: {
        'check-resolution.js': `
          export { default } from 'in-repo-a/check-resolution-target';
        `,
      },
    });
    addInRepoAddon(depB, 'in-repo-b', {
      app: { service: { 'in-repo.js': 'export default "in-repo-b|service|in-repo.js";' } },
    });
    addInRepoAddon(depB, 'in-repo-c', {
      app: { service: { 'in-repo.js': 'export default "in-repo-c|service|in-repo.js";' } },
    });

    // make an in-repo addon with a dependency on a secondary in-repo-addon
    addInRepoAddon(app, 'primary-in-repo-addon', {
      'package.json': JSON.stringify(
        {
          name: 'primary-in-repo-addon',
          keywords: ['ember-addon'],
          'ember-addon': {
            paths: ['../secondary-in-repo-addon'],
          },
        },
        null,
        2
      ),
      app: {
        services: {
          'primary.js': `export {default} from "secondary-in-repo-addon/components/secondary"`,
        },
      },
    });

    // critically, this in-repo addon gets removed from the app's actual
    // ember-addon.paths, so it's *only* consumed by primary-in-repo-addon.
    addInRepoAddon(app, 'secondary-in-repo-addon', {
      app: {
        services: {
          'secondary.js': 'export default "secondary-in-repo-addon|service|secondary.js";',
        },
      },
      addon: {
        components: {
          'secondary.js': 'export default "secondary-in-repo-addon|component|secondary.js";',
        },
      },
    });
    (app.pkg['ember-addon'] as any).paths = (app.pkg['ember-addon'] as any).paths.filter(
      (p: string) => p !== 'lib/secondary-in-repo-addon'
    );
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
        // There is a bug in node-fixturify-project that means project.linkDependency() will cause
        // strange resolutions of dependencies. It is a timing issue where the peer depenceny checker
        // runs before the linked dependency has been fully written to disk and ends up giving us the
        // wrong answers. We are trying to recreate the same behaviour as linking a dependency with
        // this addDependency function because we still need to test this behaviour.
        //
        // when https://github.com/stefanpenner/node-fixturify-project/issues/100 is fixed we should
        // be able to go back to using depA.linkDependency()
        function addDependency(fromPkg: string, toPkg: string, projectDirectory: string) {
          let filename = join(projectDirectory, 'node_modules', fromPkg, 'package.json');
          let json = readJsonSync(filename);
          json.dependencies = {
            ...json.dependencies,
            [toPkg]: '*',
          };

          writeJsonSync(filename, json);
        }

        addDependency('dep-a', 'dep-c', app.dir);
        addDependency('dep-b', 'dep-c', app.dir);
      });

      test(`pnpm test: development`, async function (assert) {
        let result = await app.execute(`pnpm test`);
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });

stage2Scenarios
  .map('addon-ordering-is-preserved', app => {
    // these test attempt to describe the addon ordering behavior from ember-cli that was
    // introduced via: https://github.com/ember-cli/ember-cli/commit/098a9b304b551fe235bd42399ce6975af2a1bc48

    let depB = addAddon(app, 'dep-b');
    let depA = addAddon(app, 'dep-a');

    merge(depB.files, {
      app: {
        service: {
          'addon.js': 'export default "dep-b|service|addon.js";',
          'dep-wins-over-dev.js': 'export default "dep-b|service|dep-wins-over-dev.js";',
          'in-repo-over-deps.js': 'export default "dep-b|service|in-repo-over-deps.js";',
        },
      },
    });
    merge(depA.files, { app: { service: { 'addon.js': 'export default "dep-a|service|addon.js";' } } });

    addInRepoAddon(app, 'in-repo-a', {
      app: {
        service: {
          'in-repo.js': 'export default "in-repo-a|service|in-repo.js";',
          'in-repo-over-deps.js': 'export default "in-repo-a|service|in-repo-over-deps.js";',
        },
      },
    });
    addInRepoAddon(app, 'in-repo-b', {
      app: { service: { 'in-repo.js': 'export default "in-repo-b|service|in-repo.js";' } },
    });

    let devA = addDevAddon(app, 'dev-a');
    let devB = addDevAddon(app, 'dev-b');
    let devC = addDevAddon(app, 'dev-c');
    let devD = addDevAddon(app, 'dev-d');
    let devE = addDevAddon(app, 'dev-e');
    let devF = addDevAddon(app, 'dev-f');

    (devB.pkg['ember-addon'] as any).after = 'dev-e';
    (devF.pkg['ember-addon'] as any).before = 'dev-d';

    merge(devA.files, {
      app: {
        service: {
          'dev-addon.js': 'export default "dev-a|service|dev-addon.js";',
          'dep-wins-over-dev.js': 'export default "dev-a|service|dep-wins-over-dev.js";',
        },
      },
    });
    merge(devB.files, { app: { service: { 'test-after.js': 'export default "dev-b|service|test-after.js";' } } });
    merge(devC.files, { app: { service: { 'dev-addon.js': 'export default "dev-c|service|dev-addon.js";' } } });
    merge(devD.files, { app: { service: { 'test-before.js': 'export default "dev-d|service|test-before.js";' } } });
    merge(devE.files, { app: { service: { 'test-after.js': 'export default "dev-e|service|test-after.js";' } } });
    merge(devF.files, { app: { service: { 'test-before.js': 'export default "dev-f|service|test-before.js";' } } });

    merge(app.files, {
      services: {
        'store.js': `export { default } from 'ember-data/store';`,
      },
      tests: {
        unit: {
          'sorted-addons-win.js': `import { module, test } from 'qunit';

          import inRepoB from 'my-app/service/in-repo';
          import addonService from 'my-app/service/addon';
          import devAddon from 'my-app/service/dev-addon';
          import depWinsOverDev from 'my-app/service/dep-wins-over-dev';
          import inRepoOverDeps from 'my-app/service/in-repo-over-deps';
          import testBefore from 'my-app/service/test-before';
          import testAfter from 'my-app/service/test-after';

          module('Unit | basics', function () {
            test('in-repo-b comes from the right place', async function (assert) {
              assert.strictEqual(inRepoB, 'in-repo-b|service|in-repo.js');
            });

            test('addon-service comes from the right place', async function (assert) {
              assert.strictEqual(addonService, 'dep-b|service|addon.js');
            });

            test('dev-addon-service comes from the right place', async function (assert) {
              assert.strictEqual(devAddon, 'dev-c|service|dev-addon.js');
            });

            test('depWinsOverDev comes from the right place', async function (assert) {
              assert.strictEqual(depWinsOverDev, 'dep-b|service|dep-wins-over-dev.js');
            });

            test('inRepoOverDeps comes from the right place', async function (assert) {
              assert.strictEqual(inRepoOverDeps, 'in-repo-a|service|in-repo-over-deps.js');
            });

            test('testBefore comes from the right place', async function (assert) {
              assert.strictEqual(testBefore, 'dev-d|service|test-before.js');
            });

            test('testAfter comes from the right place', async function (assert) {
              assert.strictEqual(testAfter, 'dev-b|service|test-after.js');
            });
          })
          `,
        },
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

      test(`pnpm test: development`, async function (assert) {
        let result = await app.execute(`pnpm test`);
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });

  stage2Scenarios
  .map('gts-files-in-addons-are-pre-processed-with-template-compilation', app => {
    let depA = addAddon(app, 'dep-a');
    depA.linkDependency('ember-template-imports', { baseDir: __dirname });
    depA.linkDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-latest' });

    merge(depA.files, {
      'index.js': `
        'use strict';
        module.exports = {
          name: require('./package').name,
          options: {
            'ember-cli-babel': { enableTypeScriptTransform: true },
          },
        };`,
      addon: {
        components: {
          'other.gts': `
          import Component from '@glimmer/component';

          export default class extends Component {
            abc: string;
            <template>
              other
            </template>
          };
          `,
          'gts-component.gts': `
          import Component from '@glimmer/component';
          import OtherComponent from './other';

          export default class extends Component {
            abc: string;
            <template>
              this is gts
              with <OtherComponent />
            </template>
          };
          `,
        },
      },
      app: {
        components: {
          'gts-component.js': 'export { default } from "dep-a/components/gts-component"',
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { STAGE2_ONLY: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir, 'reuse-build': true }));

      test('no audit issues', function () {
        expectAudit.hasNoFindings();
      });

      test('gts is processed with template-compilation', function () {
        let expectModule = expectAudit.module('./assets/my-app.js');
        // this is to make sure that the babel plugin template compilation runs and thus
        // make imports that are only used in templates bound and not removed by typescript
        expectModule
          .resolves('my-app/components/gts-component.js')
          .toModule()
          .resolves('dep-a/components/gts-component')
          .toModule()
          .codeContains(`import OtherComponent from './other';`);
      });
    });
  });


dummyAppScenarios
  .skip()
  .map('compat-stage2-addon-dummy-app', app => {
    renameApp(app, 'my-addon');
    app.linkDependency('@embroider/core', { baseDir: __dirname });
    app.linkDependency('@embroider/compat', { baseDir: __dirname });
    app.linkDependency('@embroider/webpack', { baseDir: __dirname });

    merge(app.files, {
      addon: {
        components: {
          'hello-world.js': `
              import { isDevelopingThisPackage } from '@embroider/macros';
              console.log(isDevelopingThisPackage());`,
        },
      },
      tests: {
        dummy: {
          app: {
            components: {
              'inside-dummy-app.js': `
                  import { isDevelopingThisPackage } from '@embroider/macros';
                  console.log(isDevelopingThisPackage());`,
            },
          },
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let expectFile: ExpectFile;
      let build: Transpiler;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { EMBROIDER_PREBUILD: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      hooks.beforeEach(assert => {
        expectFile = expectRewrittenFilesAt(resolve(app.dir, 'tests/dummy'), { qunit: assert });
        build = new Transpiler(resolve(app.dir, 'tests/dummy'));
      });

      test('dummy app sees that its being developed', function () {
        let assertFile = expectFile('../../tmp/rewritten-app/app/components/inside-dummy-app.js').transform(
          build.transpile
        );
        assertFile.matches(/console\.log\(true\)/);
      });

      test('addon within dummy app sees that its being developed', function () {
        let assertFile = expectFile('../../components/hello-world.js').transform(build.transpile);
        assertFile.matches(/console\.log\(true\)/);
      });
    });
  });

function addAddon(app: Project, name: string) {
  let addon = baseAddon();
  addon.pkg.name = name;
  app.addDependency(addon);
  return addon;
}

function addDevAddon(app: Project, name: string) {
  let addon = baseAddon();
  addon.pkg.name = name;
  app.addDevDependency(addon);
  return addon;
}

function addInRepoAddon(app: Project, name: string, additionalFiles?: {}) {
  if (!app.pkg['ember-addon']) {
    app.pkg['ember-addon'] = {};
  }

  let pkg = app.pkg as any;

  if (!pkg['ember-addon'].paths) {
    pkg['ember-addon'].paths = [];
  }

  pkg['ember-addon'].paths.push(`lib/${name}`);

  merge(app.files, {
    lib: {
      [name]: {
        'package.json': JSON.stringify(
          {
            name,
            version: '0.0.0',
            keywords: ['ember-addon'],
          },
          null,
          2
        ),
        'index.js': `module.exports = {
          name: require('./package').name,
        };`,
        ...additionalFiles,
      },
    },
  });
}
