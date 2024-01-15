import type { PreparedApp } from 'scenario-tester';
import { appScenarios, renameApp } from './scenarios';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;

let splitScenarios = appScenarios.map('compat-splitAtRoutes', app => {
  renameApp(app, 'my-app');
  merge(app.files, {
    'ember-cli-build.js': `
      'use strict';

      const EmberApp = require('ember-cli/lib/broccoli/ember-app');
      const { maybeEmbroider } = require('@embroider/test-setup');

      module.exports = function (defaults) {
        let app = new EmberApp(defaults, {});
        return maybeEmbroider(app, {
          staticAddonTrees: true,
          staticAddonTestSupportTrees: true,
          staticHelpers: true,
          staticModifiers: true,
          staticComponents: true,
          splitAtRoutes: ['people'],
        });
      };
    `,
    app: {
      components: {
        'welcome.hbs': '',
        'all-people.js': 'export default class {}',
        'one-person.hbs': '{{capitalize @person.name}}',
        'unused.hbs': '',
      },
      helpers: {
        'capitalize.js': 'export default function(){}',
      },
      modifiers: {
        'auto-focus.js': 'export default function(){}',
      },
    },
  });
  app.linkDependency('@ember/string', { baseDir: __dirname });
});

splitScenarios
  .map('basic', app => {
    merge(app.files, {
      app: {
        templates: {
          'index.hbs': '<Welcome/>',
          'people.hbs': '<h1>People</h1>{{outlet}}',
          people: {
            'index.hbs': '<AllPeople/>',
            'show.hbs': '<OnePerson/>',
            'edit.hbs': '<input {{auto-focus}} />',
          },
        },
        controllers: {
          'index.js': '',
          'people.js': '',
          people: {
            'show.js': '',
          },
        },
        routes: {
          'index.js': '',
          'people.js': '',
          people: {
            'show.js': '',
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

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { STAGE2_ONLY: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir, 'reuse-build': true }));

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(readFileSync(join(app.dir, 'dist/.stage2-output'), 'utf8'), { qunit: assert });
      });

      test('has no components in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('all-people');
        expectFile('./assets/my-app.js').doesNotMatch('welcome');
        expectFile('./assets/my-app.js').doesNotMatch('unused');
      });

      test('has no helpers in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('capitalize');
      });

      test('has no modifiers in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('auto-focus');
      });

      test('has non-split controllers in main entrypoint', function () {
        expectAudit
          .module('./assets/my-app.js')
          .resolves('./-embroider-amd-modules.js')
          .toModule()
          .withContents(contents => {
            const [, objectName] = /"my-app\/controllers\/index": (amdMod\d+),/.exec(contents) ?? [];

            return contents.includes(`import * as ${objectName} from "my-app/controllers/index.js";`);
          }, 'controllers/index import/export should be present in the virtual -embroider-amd-modules.js file');
      });

      test('has non-split route templates in main entrypoint', function () {
        expectAudit
          .module('./assets/my-app.js')
          .resolves('./-embroider-amd-modules.js')
          .toModule()
          .withContents(contents => {
            const [, objectName] = /"my-app\/templates\/index": (amdMod\d+),/.exec(contents) ?? [];

            return contents.includes(`import * as ${objectName} from "my-app/templates/index.hbs";`);
          }, 'templates/index import/export should be present in the virtual -embroider-amd-modules.js file');
      });

      test('has non-split routes in main entrypoint', function () {
        expectAudit
          .module('./assets/my-app.js')
          .resolves('./-embroider-amd-modules.js')
          .toModule()
          .withContents(contents => {
            const [, objectName] = /"my-app\/routes\/index": (amdMod\d+),/.exec(contents) ?? [];

            return contents.includes(`import * as ${objectName} from "my-app\/routes/index.js";`);
          }, 'routes/index import/export should be present in the virtual -embroider-amd-modules.js file');
      });

      test('does not have split controllers in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('controllers/people');
        expectFile('./assets/my-app.js').doesNotMatch('controllers/people/show');
      });

      test('does not have split route templates in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('templates/people');
        expectFile('./assets/my-app.js').doesNotMatch('templates/people/index');
        expectFile('./assets/my-app.js').doesNotMatch('templates/people/show');
      });

      test('does not have split routes in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('routes/people');
        expectFile('./assets/my-app.js').doesNotMatch('routes/people/show');
      });

      test('dynamically imports the route entrypoint from the main entrypoint', function () {
        expectFile('./assets/my-app.js').matches('import("my-app/assets/_route_/people.js")');
      });

      test('has split controllers in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').matches('controllers/people');
        expectFile('./assets/_route_/people.js').matches('controllers/people/show');
      });

      test('has split route templates in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').matches('templates/people');
        expectFile('./assets/_route_/people.js').matches('templates/people/index');
        expectFile('./assets/_route_/people.js').matches('templates/people/show');
      });

      test('has split routes in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').matches('routes/people');
        expectFile('./assets/_route_/people.js').matches('routes/people/show');
      });

      test('has no components in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').doesNotMatch('all-people');
        expectFile('./assets/_route_/people.js').doesNotMatch('welcome');
        expectFile('./assets/_route_/people.js').doesNotMatch('unused');
      });

      test('has no helpers in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').doesNotMatch('capitalize');
      });

      test('has no helpers in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').doesNotMatch('auto-focus');
      });

      Qmodule('audit', function (/* hooks */) {
        test('has no issues', function () {
          expectAudit.hasNoFindings();
        });

        test('helper is consumed only from the template that uses it', function () {
          expectAudit.module('./helpers/capitalize.js').hasConsumers(['./components/one-person.hbs']);
        });

        test('component is consumed only from the template that uses it', function () {
          expectAudit.module('./components/one-person.js').hasConsumers(['./templates/people/show.hbs']);
        });

        test('modifier is consumed only from the template that uses it', function () {
          expectAudit.module('./modifiers/auto-focus.js').hasConsumers(['./templates/people/edit.hbs']);
        });

        test('does not include unused component', function () {
          expectAudit.module('./components/unused.hbs').doesNotExist();
        });
      });
    });
  });

splitScenarios
  .map('pods', app => {
    merge(app.files, {
      app: {
        pods: {
          index: {
            'template.hbs': '<Welcome/>',
            'controller.js': '',
            'route.js': '',
          },
          people: {
            'template.hbs': '<h1>People</h1>{{outlet}}',
            'controller.js': '',
            'route.js': '',
            index: {
              'template.hbs': '<AllPeople/>',
            },
            show: {
              'template.hbs': '<OnePerson/>',
              'controller.js': '',
              'route.js': '',
            },
            edit: {
              'template.hbs': '<input {{auto-focus}} />',
              'controller.js': '',
              'route.js': '',
            },
          },
        },
      },
      config: {
        'environment.js': `
            module.exports = function(environment) {
            let ENV = {
              modulePrefix: 'my-app',
              podModulePrefix: 'my-app/pods',
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
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let expectFile: ExpectFile;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { STAGE2_ONLY: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir, 'reuse-build': true }));

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(readFileSync(join(app.dir, 'dist/.stage2-output'), 'utf8'), { qunit: assert });
      });

      test('has no components in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('all-people');
        expectFile('./assets/my-app.js').doesNotMatch('welcome');
        expectFile('./assets/my-app.js').doesNotMatch('unused');
      });

      test('has no helpers in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('capitalize');
      });

      test('has no modifiers in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('auto-focus');
      });

      test('has non-split controllers in main entrypoint', function () {
        expectAudit
          .module('./assets/my-app.js')
          .resolves('./-embroider-amd-modules.js')
          .toModule()
          .withContents(contents => {
            const [, objectName] = /"my-app\/pods\/index\/controller": (amdMod\d+),/.exec(contents) ?? [];

            return contents.includes(`import * as ${objectName} from "my-app\/pods\/index\/controller.js";`);
          }, 'pods/index/controller import/export should be present in the virtual -embroider-amd-modules.js file');
      });

      test('has non-split route templates in main entrypoint', function () {
        expectAudit
          .module('./assets/my-app.js')
          .resolves('./-embroider-amd-modules.js')
          .toModule()
          .withContents(contents => {
            const [, objectName] = /"my-app\/pods\/index\/template": (amdMod\d+),/.exec(contents) ?? [];

            return contents.includes(`import * as ${objectName} from "my-app\/pods\/index\/template.hbs";`);
          }, 'pods/index/template import/export should be present in the virtual -embroider-amd-modules.js file');
      });

      test('has non-split routes in main entrypoint', function () {
        expectAudit
          .module('./assets/my-app.js')
          .resolves('./-embroider-amd-modules.js')
          .toModule()
          .withContents(contents => {
            const [, objectName] = /"my-app\/pods\/index\/route": (amdMod\d+),/.exec(contents) ?? [];

            return contents.includes(`import * as ${objectName} from "my-app\/pods/index/route.js";`);
          }, 'pods/index/route import/export should be present in the virtual -embroider-amd-modules.js file');
      });

      test('does not have split controllers in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('pods/people/controller');
        expectFile('./assets/my-app.js').doesNotMatch('pods/people/show/controller');
      });

      test('does not have split route templates in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('pods/people/template');
        expectFile('./assets/my-app.js').doesNotMatch('pods/people/index/template');
        expectFile('./assets/my-app.js').doesNotMatch('pods/people/show/template');
      });

      test('does not have split routes in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('pods/people/route');
        expectFile('./assets/my-app.js').doesNotMatch('pods/people/show/route');
      });

      test('dynamically imports the route entrypoint from the main entrypoint', function () {
        expectFile('./assets/my-app.js').matches('import("my-app/assets/_route_/people.js")');
      });

      test('has split controllers in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').matches('pods/people/controller');
        expectFile('./assets/_route_/people.js').matches('pods/people/show/controller');
      });

      test('has split route templates in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').matches('pods/people/template');
        expectFile('./assets/_route_/people.js').matches('pods/people/index/template');
        expectFile('./assets/_route_/people.js').matches('pods/people/show/template');
      });

      test('has split routes in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').matches('pods/people/route');
        expectFile('./assets/_route_/people.js').matches('pods/people/show/route');
      });

      test('has no components in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').doesNotMatch('all-people');
        expectFile('./assets/_route_/people.js').doesNotMatch('welcome');
        expectFile('./assets/_route_/people.js').doesNotMatch('unused');
      });

      test('has no helpers in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').doesNotMatch('capitalize');
      });

      test('has no modifiers in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').doesNotMatch('auto-focus');
      });

      Qmodule('audit', function (/* hooks */) {
        test('has no issues', function () {
          expectAudit.hasNoFindings();
        });

        test('helper is consumed only from the template that uses it', function () {
          expectAudit.module('./helpers/capitalize.js').hasConsumers(['./components/one-person.hbs']);
        });

        test('component is consumed only from the template that uses it', function () {
          expectAudit.module('./components/one-person.js').hasConsumers(['./pods/people/show/template.hbs']);
        });

        test('modifier is consumed only from the template that uses it', function () {
          expectAudit.module('./modifiers/auto-focus.js').hasConsumers(['./pods/people/edit/template.hbs']);
        });

        test('does not include unused component', function () {
          expectAudit.module('./components/unused.hbs').doesNotExist();
        });
      });
    });
  });

splitScenarios
  .map('pods-under-app/routes', app => {
    merge(app.files, {
      app: {
        routes: {
          index: {
            'template.hbs': '<Welcome/>',
            'controller.js': '',
            'route.js': '',
          },
          people: {
            'template.hbs': '<h1>People</h1>{{outlet}}',
            'controller.js': '',
            'route.js': '',
            index: {
              'template.hbs': '<AllPeople/>',
            },
            show: {
              'template.hbs': '<OnePerson/>',
              'controller.js': '',
              'route.js': '',
            },
            edit: {
              'template.hbs': '<input {{auto-focus}} />',
              'controller.js': '',
              'route.js': '',
            },
          },
        },
      },
      config: {
        'environment.js': `
            module.exports = function(environment) {
            let ENV = {
              modulePrefix: 'my-app',
              podModulePrefix: 'my-app/routes',
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
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let expectFile: ExpectFile;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { STAGE2_ONLY: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir, 'reuse-build': true }));

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(readFileSync(join(app.dir, 'dist/.stage2-output'), 'utf8'), { qunit: assert });
      });

      test('has no components in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('all-people');
        expectFile('./assets/my-app.js').doesNotMatch('welcome');
        expectFile('./assets/my-app.js').doesNotMatch('unused');
      });

      test('has no helpers in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('capitalize');
      });

      test('has no modifiers in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('auto-focus');
      });

      test('has non-split controllers in main entrypoint', function () {
        expectAudit
          .module('./assets/my-app.js')
          .resolves('./-embroider-amd-modules.js')
          .toModule()
          .withContents(contents => {
            const [, objectName] = /"my-app\/routes\/index\/controller": (amdMod\d+),/.exec(contents) ?? [];

            return contents.includes(`import * as ${objectName} from "my-app\/routes\/index\/controller.js";`);
          }, 'routes/index/controller import/export should be present in the virtual -embroider-amd-modules.js file');
      });

      test('has non-split route templates in main entrypoint', function () {
        expectAudit
          .module('./assets/my-app.js')
          .resolves('./-embroider-amd-modules.js')
          .toModule()
          .withContents(contents => {
            const [, objectName] = /"my-app\/routes\/index\/template": (amdMod\d+),/.exec(contents) ?? [];

            return contents.includes(`import * as ${objectName} from "my-app\/routes\/index\/template.hbs";`);
          }, 'routes/index/template import/export should be present in the virtual -embroider-amd-modules.js file');
      });

      test('has non-split routes in main entrypoint', function () {
        expectAudit
          .module('./assets/my-app.js')
          .resolves('./-embroider-amd-modules.js')
          .toModule()
          .withContents(contents => {
            const [, objectName] = /"my-app\/routes\/index\/route": (amdMod\d+),/.exec(contents) ?? [];

            return contents.includes(`import * as ${objectName} from "my-app\/routes/index/route.js";`);
          }, 'routes/index/route import/export should be present in the virtual -embroider-amd-modules.js file');
      });

      test('does not have split controllers in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('routes/people/controller');
        expectFile('./assets/my-app.js').doesNotMatch('routes/people/show/controller');
      });

      test('does not have split route templates in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('routes/people/template');
        expectFile('./assets/my-app.js').doesNotMatch('routes/people/index/template');
        expectFile('./assets/my-app.js').doesNotMatch('routes/people/show/template');
      });

      test('does not have split routes in main entrypoint', function () {
        expectFile('./assets/my-app.js').doesNotMatch('routes/people/route');
        expectFile('./assets/my-app.js').doesNotMatch('routes/people/show/route');
      });

      test('dynamically imports the route entrypoint from the main entrypoint', function () {
        expectFile('./assets/my-app.js').matches('import("my-app/assets/_route_/people.js")');
      });

      test('has split controllers in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').matches('routes/people/controller');
        expectFile('./assets/_route_/people.js').matches('routes/people/show/controller');
      });

      test('has split route templates in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').matches('routes/people/template');
        expectFile('./assets/_route_/people.js').matches('routes/people/index/template');
        expectFile('./assets/_route_/people.js').matches('routes/people/show/template');
      });

      test('has split routes in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').matches('routes/people/route');
        expectFile('./assets/_route_/people.js').matches('routes/people/show/route');
      });

      test('has no components in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').doesNotMatch('all-people');
        expectFile('./assets/_route_/people.js').doesNotMatch('welcome');
        expectFile('./assets/_route_/people.js').doesNotMatch('unused');
      });

      test('has no helpers in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').doesNotMatch('capitalize');
      });

      test('has no modifiers in route entrypoint', function () {
        expectFile('./assets/_route_/people.js').doesNotMatch('auto-focus');
      });

      Qmodule('audit', function (/* hooks */) {
        test('has no issues', function () {
          expectAudit.hasNoFindings();
        });

        test('helper is consumed only from the template that uses it', function () {
          expectAudit.module('./helpers/capitalize.js').hasConsumers(['./components/one-person.hbs']);
        });

        test('component is consumed only from the template that uses it', function () {
          expectAudit.module('./components/one-person.js').hasConsumers(['./routes/people/show/template.hbs']);
        });

        test('modifier is consumed only from the template that uses it', function () {
          expectAudit.module('./modifiers/auto-focus.js').hasConsumers(['./routes/people/edit/template.hbs']);
        });

        test('does not include unused component', function () {
          expectAudit.module('./components/unused.hbs').doesNotExist();
        });
      });
    });
  });
