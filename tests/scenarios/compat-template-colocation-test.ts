import type { PreparedApp } from 'scenario-tester';
import { appScenarios, baseAddon, renameApp } from './scenarios';
import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectRewrittenFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import QUnit from 'qunit';
import CommandWatcher from './helpers/command-watcher';
import fetch from 'node-fetch';
const { module: Qmodule, test } = QUnit;

let scenarios = appScenarios.map('compat-template-colocation', app => {
  renameApp(app, 'my-app');
  merge(app.files, {
    config: {
      'targets.js': `module.exports = { browsers: ['last 1 Chrome versions'] }`,
    },
    app: {
      templates: {
        'index.hbs': `
            <HasColocatedTemplate />
            {{!-- TODO why is there a TS component here using an appScenario?? --}}
            {{!-- <HasColocatedTSTemplate /> --}}
            <TemplateOnlyComponent />
          `,
      },
      components: {
        'has-colocated-template.js': `
          import Component from '@glimmer/component';
          import ComponentOne from 'my-addon/components/component-one';
          import ComponentTwo from 'my-addon/components/component-two';
          export default class extends Component {}
          `,
        'has-colocated-template.hbs': `<div>{{this.title}}</div>`,
        'has-colocated-ts-template.ts': `
          import Component from '@glimmer/component';
          export default class extends Component {}
          `,
        'has-colocated-ts-template.hbs': `<div>{{this.title}}</div>`,
        'template-only-component.hbs': `<div>I am template only</div>`,
      },
    },
  });

  let addon = baseAddon();
  addon.pkg.name = 'my-addon';
  app.addDevDependency(addon);
  merge(addon.files, {
    app: {
      components: {
        'component-one.js': `export { default } from 'my-addon/components/component-one';`,
      },
    },
    addon: {
      components: {
        'component-one.js': `
          import Component from '@glimmer/component';
          export default class extends Component {}
        `,
        'component-one.hbs': `component one template`,
        'component-two.hbs': `component two templates`,
      },
    },
  });
});

function checkContents(
  expectAudit: ReturnType<typeof setupAuditTest>,
  fn: (contents: string) => void,
  entrypointFiles?: RegExp[]
) {
  let resolved = expectAudit
    .module('./index.html')
    .resolves('/app-boot.js')
    .toModule()
    .resolves(/\/app\.[jt]s.*/)
    .toModule()
    .resolves(/.*\/-embroider-entrypoint.js/);

  entrypointFiles?.forEach(entrypointFile => {
    resolved = resolved.toModule().resolves(entrypointFile);
  });

  resolved.toModule().withContents(contents => {
    fn(contents);
    return true;
  });
}

scenarios
  .map('staticComponent-false', app => {
    merge(app.files, {
      'ember-cli-build.js': `
        'use strict';
        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { prebuild } = require('@embroider/compat');

        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {});
          return prebuild(app, {
            staticComponents: false,
            staticAddonTrees: false,
          });
        };
      `,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let server: CommandWatcher;
      let appURL: string;
      let expectFile: ExpectFile;

      hooks.before(async () => {
        app = await scenario.prepare();
        server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
        [, appURL] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);
      });

      hooks.beforeEach(async assert => {
        expectFile = expectRewrittenFilesAt(app.dir, { qunit: assert });
      });

      hooks.after(async () => {
        await server?.shutdown();
      });

      let expectAudit = setupAuditTest(hooks, () => ({
        appURL,
        startingFrom: ['index.html'],
        fetch: fetch as unknown as typeof globalThis.fetch,
      }));

      test(`app's colocated template is associated with JS`, function (assert) {
        checkContents(
          expectAudit,
          contents => {
            assert.ok(
              /import TEMPLATE from ['"]\/components\/has-colocated-template.hbs.*['"];/.test(contents),
              'imported template'
            );
            assert.ok(/import \{ setComponentTemplate \}/.test(contents), 'found setComponentTemplate');
            assert.ok(
              /export default setComponentTemplate\(TEMPLATE, class extends Component \{\}/.test(contents),
              'default export is wrapped'
            );
          },
          [/has-colocated-template/]
        );
      });

      test(`app's template-only component JS is synthesized`, function (assert) {
        checkContents(
          expectAudit,
          contents => {
            assert.ok(
              /import TEMPLATE from ['"]\/components\/template-only-component.hbs.*['"];/.test(contents),
              'imported template'
            );
            assert.ok(/import \{ setComponentTemplate \}/.test(contents), 'found setComponentTemplate');
            assert.ok(/import templateOnly/.test(contents), 'found templateOnly');

            assert.ok(
              /export default setComponentTemplate\(TEMPLATE, templateOnly\(\)\)/.test(contents),
              'default export is wrapped'
            );
          },
          [/components\/template-only-component/]
        );
      });

      test(`app's colocated components are implicitly included correctly`, function (assert) {
        checkContents(expectAudit, contents => {
          const result = /import \* as (\w+) from "\/components\/has-colocated-template.js.*";/.exec(contents);

          if (!result) {
            console.log(contents);
            throw new Error('Missing import of has-colocated-template');
          }

          const [, amdModule] = result;

          assert.codeContains(
            contents,
            `d("my-app/components/has-colocated-template", function () {
              return ${amdModule};
            });`
          );
        });
      });

      test(`addon's colocated template is associated with JS`, function (assert) {
        checkContents(
          expectAudit,
          contents => {
            assert.ok(
              /import __COLOCATED_TEMPLATE__ from ['"]\.\/component-one.hbs['"];/.test(contents),
              'imported template'
            );
            assert.ok(/import \{ setComponentTemplate \}/.test(contents), 'found setComponentTemplate');
            assert.ok(
              /export default setComponentTemplate\(TEMPLATE, class extends Component \{\}/.test(contents),
              'default export is wrapped'
            );
          },
          [/components\/has-colocated-template/, /components\/component-one/]
        );
      });

      test(`addon's template-only component JS is synthesized`, function (assert) {
        checkContents(
          expectAudit,
          contents => {
            assert.ok(
              /import __COLOCATED_TEMPLATE__ from ['"]\.\/component-two.hbs['"];/.test(contents),
              'imported template'
            );
            assert.ok(/import \{ setComponentTemplate \}/.test(contents), 'found setComponentTemplate');
            assert.ok(/import templateOnlyComponent/.test(contents), 'found templateOnlyComponent');
            assert.ok(
              /export default setComponentTemplate\(TEMPLATE, templateOnlyComponent\(\)\)/.test(contents),
              'default export is wrapped'
            );
          },
          [/components\/has-colocated-template/, /components\/component-two/]
        );
      });

      test(`addon's colocated components are correct in implicit-modules`, function () {
        let assertFile = expectFile('./node_modules/my-addon/package.json').json();
        assertFile.get(['ember-addon', 'implicit-modules']).includes('./components/component-one');
        assertFile.get(['ember-addon', 'implicit-modules']).includes('./components/component-two');
        assertFile.get(['ember-addon', 'implicit-modules']).doesNotInclude('./components/component-one.hbs');
        assertFile.get(['ember-addon', 'implicit-modules']).doesNotInclude('./components/component-two.hbs');
      });
    });
  });

scenarios
  .map('staticComponents-true', () => {})
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let expectFile: ExpectFile;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { EMBROIDER_PREBUILD: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      hooks.beforeEach(assert => {
        expectFile = expectRewrittenFilesAt(app.dir, { qunit: assert });
      });

      let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir }));

      test(`app's colocated components are not implicitly included`, function (assert) {
        expectAudit
          .module('./tmp/rewritten-app/index.html')
          .resolves('/app-boot.js')
          .toModule()
          .resolves('./app')
          .toModule()
          .resolves('@embroider/core/entrypoint')
          .toModule()
          .withContents(content => {
            assert.notOk(/import \* as (\w+) from "\.\/components\/has-colocated-component.js"/.test(content));

            assert.notOk(/import \* as (\w+) from "\.\/components\/template-only-component.js"/.test(content));

            return true;
          });
      });

      test(`addon's colocated components are not in implicit-modules`, function () {
        let assertFile = expectFile('./node_modules/my-addon/package.json').json();
        assertFile.get(['ember-addon', 'implicit-modules']).equals(undefined);
      });
    });
  });

appScenarios
  .map('compat-template-colocation-pods', app => {
    renameApp(app, 'my-app');
    merge(app.files, {
      'ember-cli-build.js': `
        'use strict';
        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { prebuild } = require('@embroider/compat');
        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {});
          return prebuild(app, {
            staticComponents: false,
          });
        };
      `,

      config: {
        'environment.js': `module.exports = function(environment) {
          let ENV = {
            modulePrefix: 'my-app',
            podModulePrefix: '',
            environment,
            rootURL: '/',
            locationType: 'history',
            EmberENV: {
              FEATURES: {
              },
              EXTEND_PROTOTYPES: {
                Date: false
              }
            },
            APP: {}
          };
          return ENV;
        };`,
      },
      app: {
        templates: {
          'index.hbs': `
              <PodComponent />
              <TemplateOnly />
            `,
        },
        components: {
          'pod-component': {
            'component.js': `
            import Component from '@glimmer/component';
            export default class extends Component {}
            `,
            'template.hbs': `<div>{{this.title}}</div>`,
          },
          'template-only': {
            'template.hbs': `<div>I am template only</div>`,
          },
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
        let result = await app.execute('ember build', { env: { EMBROIDER_PREBUILD: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir }));

      test(`app's pod components and templates are implicitly included correctly`, function (assert) {
        expectAudit
          .module('./tmp/rewritten-app/index.html')
          .resolves('/app-boot.js')
          .toModule()
          .resolves('./app')
          .toModule()
          .resolves('@embroider/core/entrypoint')
          .toModule()
          .withContents(content => {
            let result = /import \* as (\w+) from "\.\/components\/pod-component\/component.js"/.exec(content);

            if (!result) {
              throw new Error('Could not find pod component');
            }

            const [, podComponentAmd] = result;

            assert.codeContains(
              content,
              `d("my-app/components/pod-component/component", function () {
              return ${podComponentAmd};
            });`
            );

            result = /import \* as (\w+) from "\.\/components\/pod-component\/template.hbs"/.exec(content);

            if (!result) {
              throw new Error('Could not find pod component template');
            }

            const [, podComponentTemplateAmd] = result;

            assert.codeContains(
              content,
              `d("my-app/components/pod-component/template", function () {
              return ${podComponentTemplateAmd};
            });`
            );

            result = /import \* as (\w+) from "\.\/components\/template-only\/template.hbs"/.exec(content);

            if (!result) {
              throw new Error('Could not find template only component');
            }

            const [, templateOnlyAmd] = result;

            assert.codeContains(
              content,
              `d("my-app/components/template-only/template", function () {
                return ${templateOnlyAmd};
              });`
            );

            return true;
          });
      });
    });
  });
