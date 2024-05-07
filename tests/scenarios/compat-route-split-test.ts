import type { PreparedApp } from 'scenario-tester';
import { appScenarios, renameApp } from './scenarios';
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
      'router.js': `import EmberRouter from '@embroider/router';
      import config from 'my-app/config/environment';

      export default class Router extends EmberRouter {
        location = config.locationType;
        rootURL = config.rootURL;
      }

      Router.map(function () {
        this.route('people');
      });
      `,
    },
  });
  app.linkDependency('@ember/string', { baseDir: __dirname });
});

function checkContents(
  expectAudit: ReturnType<typeof setupAuditTest>,
  fn: (contents: string) => void,
  entrypointFile?: string
) {
  let resolved = expectAudit
    .module('./node_modules/.embroider/rewritten-app/index.html')
    .resolves('/@embroider/core/entrypoint');

  if (entrypointFile) {
    resolved = resolved.toModule().resolves(entrypointFile);
  }
  resolved.toModule().withContents(contents => {
    fn(contents);
    return true;
  });
}

function notInEntrypointFunction(expectAudit: ReturnType<typeof setupAuditTest>) {
  return function (text: string[] | string, entrypointFile?: string) {
    checkContents(
      expectAudit,
      contents => {
        if (Array.isArray(text)) {
          text.forEach(t => {
            if (contents.includes(t)) {
              throw new Error(`${t} should not be found in entrypoint`);
            }
          });
        } else {
          if (contents.includes(text)) {
            throw new Error(`${text} should not be found in entrypoint`);
          }
        }
        return true;
      },
      entrypointFile
    );
  };
}

function inEntrypointFunction(expectAudit: ReturnType<typeof setupAuditTest>) {
  return function (text: string[] | string, entrypointFile?: string) {
    checkContents(
      expectAudit,
      contents => {
        if (Array.isArray(text)) {
          text.forEach(t => {
            if (!contents.includes(t)) {
              throw new Error(`${t} should be found in entrypoint`);
            }
          });
        } else {
          if (!contents.includes(text)) {
            console.log(contents);
            throw new Error(`${text} should be found in entrypoint`);
          }
        }
      },
      entrypointFile
    );
  };
}

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
          'index.js': `import Controller from '@ember/controller'; export default class Thingy extends Controller {}`,
          'people.js': `import Controller from '@ember/controller'; export default class Thingy extends Controller {}`,
          people: {
            'show.js': `import Controller from '@ember/controller'; export default class Thingy extends Controller {}`,
          },
        },
        routes: {
          'index.js': `import Route from '@ember/routing/route';export default class ThingyRoute extends Route {}`,
          'people.js': `import Route from '@ember/routing/route';export default class ThingyRoute extends Route {}`,
          people: {
            'show.js': `import Route from '@ember/routing/route';export default class ThingyRoute extends Route {}`,
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
      let notInEntrypoint = notInEntrypointFunction(expectAudit);
      let inEntrypoint = inEntrypointFunction(expectAudit);

      test('has no components in main entrypoint', function () {
        notInEntrypoint(['all-people', 'welcome', 'unused']);
      });

      test('has no helpers in main entrypoint', function () {
        notInEntrypoint('capitalize');
      });

      test('has no modifiers in main entrypoint', function () {
        notInEntrypoint('auto-focus');
      });

      test('has non-split controllers in main entrypoint', function () {
        inEntrypoint('controllers/index');
      });

      test('has non-split route templates in main entrypoint', function () {
        inEntrypoint('templates/index');
      });

      test('has non-split routes in main entrypoint', function () {
        inEntrypoint('routes/index');
      });

      test('does not have split controllers in main entrypoint', function () {
        notInEntrypoint(['controllers/people', 'controllers/people/show']);
      });

      test('does not have split route templates in main entrypoint', function () {
        notInEntrypoint(['templates/people', 'templates/people/index', 'templates/people/show']);
      });

      test('does not have split routes in main entrypoint', function () {
        notInEntrypoint(['routes/people', 'routes/people/show']);
      });

      test('dynamically imports the route entrypoint from the main entrypoint', function () {
        inEntrypoint('import("@embroider/core/route/people");');
      });

      test('has split controllers in route entrypoint', function () {
        inEntrypoint(['controllers/people', 'controllers/people/show'], '@embroider/core/route/people');
      });

      test('has split route templates in route entrypoint', function () {
        inEntrypoint(
          ['templates/people', 'templates/people/index', 'templates/people/show'],
          '@embroider/core/route/people'
        );
      });

      test('has split routes in route entrypoint', function () {
        inEntrypoint(['routes/people', 'routes/people/show'], '@embroider/core/route/people');
      });

      test('has no components in route entrypoint', function () {
        notInEntrypoint(['all-people', 'welcome', 'unused'], '@embroider/core/route/people');
      });

      test('has no helpers in route entrypoint', function () {
        notInEntrypoint('capitalize', '@embroider/core/route/people');
      });

      test('has no helpers in route entrypoint', function () {
        notInEntrypoint('auto-focus', '@embroider/core/route/people');
      });

      Qmodule('audit', function (hooks) {
        let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir, 'reuse-build': true }));

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

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { EMBROIDER_PREBUILD: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir }));
      let notInEntrypoint = notInEntrypointFunction(expectAudit);
      let inEntrypoint = inEntrypointFunction(expectAudit);

      test('has no components in main entrypoint', function () {
        notInEntrypoint(['all-people', 'welcome', 'unused']);
      });

      test('has no helpers in main entrypoint', function () {
        notInEntrypoint('capitalize');
      });

      test('has no modifiers in main entrypoint', function () {
        notInEntrypoint('auto-focus');
      });

      test('has non-split controllers in main entrypoint', function () {
        inEntrypoint('pods/index/controller');
      });

      test('has non-split route templates in main entrypoint', function () {
        inEntrypoint('pods/index/template');
      });

      test('has non-split routes in main entrypoint', function () {
        inEntrypoint('pods/index/route');
      });

      test('does not have split controllers in main entrypoint', function () {
        notInEntrypoint(['pods/people/controller', 'pods/people/show/controller']);
      });

      test('does not have split route templates in main entrypoint', function () {
        notInEntrypoint(['pods/people/template', 'pods/people/index/template', 'pods/people/show/template']);
      });

      test('does not have split routes in main entrypoint', function () {
        notInEntrypoint(['pods/people/route', 'pods/people/show/route']);
      });

      test('dynamically imports the route entrypoint from the main entrypoint', function () {
        inEntrypoint('import("@embroider/core/route/people")');
      });

      test('has split controllers in route entrypoint', function () {
        inEntrypoint(['pods/people/controller', 'pods/people/show/controller'], '@embroider/core/route/people');
      });

      test('has split route templates in route entrypoint', function () {
        inEntrypoint(
          ['pods/people/template', 'pods/people/index/template', 'pods/people/show/template'],
          '@embroider/core/route/people'
        );
      });

      test('has split routes in route entrypoint', function () {
        inEntrypoint(['pods/people/route', 'pods/people/show/route'], '@embroider/core/route/people');
      });

      test('has no components in route entrypoint', function () {
        notInEntrypoint(['all-people', 'welcome', 'unused'], '@embroider/core/route/people');
      });

      test('has no helpers in route entrypoint', function () {
        notInEntrypoint('capitalize', '@embroider/core/route/people');
      });

      test('has no modifiers in route entrypoint', function () {
        notInEntrypoint('auto-focus', '@embroider/core/route/people');
      });

      Qmodule('audit', function (hooks) {
        let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir, 'reuse-build': true }));

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

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { EMBROIDER_PREBUILD: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir }));
      let notInEntrypoint = notInEntrypointFunction(expectAudit);
      let inEntrypoint = inEntrypointFunction(expectAudit);

      test('has no components in main entrypoint', function () {
        notInEntrypoint(['all-people', 'welcome', 'unused']);
      });

      test('has no helpers in main entrypoint', function () {
        notInEntrypoint('capitalize');
      });

      test('has no modifiers in main entrypoint', function () {
        notInEntrypoint('auto-focus');
      });

      test('has non-split controllers in main entrypoint', function () {
        inEntrypoint('routes/index/controller');
      });

      test('has non-split route templates in main entrypoint', function () {
        inEntrypoint('routes/index/template');
      });

      test('has non-split routes in main entrypoint', function () {
        inEntrypoint('routes/index/route');
      });

      test('does not have split controllers in main entrypoint', function () {
        notInEntrypoint(['routes/people/controller', 'routes/people/show/controller']);
      });

      test('does not have split route templates in main entrypoint', function () {
        notInEntrypoint(['routes/people/template', 'routes/people/index/template', 'routes/people/show/template']);
      });

      test('does not have split routes in main entrypoint', function () {
        notInEntrypoint(['routes/people/route', 'routes/people/show/route']);
      });

      test('dynamically imports the route entrypoint from the main entrypoint', function () {
        inEntrypoint('import("@embroider/core/route/people")');
      });

      test('has split controllers in route entrypoint', function () {
        inEntrypoint(['routes/people/controller', 'routes/people/show/controller'], '@embroider/core/route/people');
      });

      test('has split route templates in route entrypoint', function () {
        inEntrypoint(
          ['routes/people/template', 'routes/people/index/template', 'routes/people/show/template'],
          '@embroider/core/route/people'
        );
      });

      test('has split routes in route entrypoint', function () {
        inEntrypoint(['routes/people/route', 'routes/people/show/route'], '@embroider/core/route/people');
      });

      test('has no components in route entrypoint', function () {
        notInEntrypoint(['all-people', 'welcome', 'unused'], '@embroider/core/route/people');
      });

      test('has no helpers in route entrypoint', function () {
        notInEntrypoint('capitalize', '@embroider/core/route/people');
      });

      test('has no modifiers in route entrypoint', function () {
        notInEntrypoint('auto-focus', '@embroider/core/route/people');
      });

      Qmodule('audit', function (hooks) {
        let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir, 'reuse-build': true }));

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
