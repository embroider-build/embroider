import { Project, BuildResult, ExpectFile, expectFilesAt } from '@embroider/test-support';
import { BuildParams } from '@embroider/test-support/build';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import { Audit, AuditResults } from '../src/audit';

describe('splitAtRoutes', function () {
  jest.setTimeout(120000);
  throwOnWarnings();

  describe('basics', function () {
    let expectFile: ExpectFile;
    let build: BuildResult;

    beforeAll(async function () {
      let buildOptions: Partial<BuildParams> = {
        stage: 2,
        type: 'app',
        emberAppOptions: {
          tests: false,
          babel: {
            plugins: [],
          },
        },
        embroiderOptions: {
          staticAddonTrees: true,
          staticAddonTestSupportTrees: true,
          staticHelpers: true,
          staticComponents: true,
          splitAtRoutes: ['people'],
        },
      };
      let app = Project.emberNew('my-app');
      merge(app.files, {
        app: {
          templates: {
            'index.hbs': '<Welcome/>',
            'people.hbs': '<h1>People</h1>{{outlet}}',
            people: {
              'index.hbs': '<AllPeople/>',
              'show.hbs': '<OnePerson/>',
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
          components: {
            'welcome.hbs': '',
            'all-people.js': 'export default class {}',
            'one-person.hbs': '{{capitalize @person.name}}',
            'unused.hbs': '',
          },
          helpers: {
            'capitalize.js': 'export default function(){}',
          },
        },
      });
      build = await BuildResult.build(app, buildOptions);
      expectFile = expectFilesAt(build.outputPath);
    });

    afterAll(async function () {
      await build.cleanup();
    });

    it('has no components in main entrypoint', function () {
      expectFile('./assets/my-app.js').doesNotMatch('all-people');
      expectFile('./assets/my-app.js').doesNotMatch('welcome');
      expectFile('./assets/my-app.js').doesNotMatch('unused');
    });

    it('has no helpers in main entrypoint', function () {
      expectFile('./assets/my-app.js').doesNotMatch('capitalize');
    });

    it('has non-split controllers in main entrypoint', function () {
      expectFile('./assets/my-app.js').matches('controllers/index');
    });

    it('has non-split route templates in main entrypoint', function () {
      expectFile('./assets/my-app.js').matches('templates/index');
    });

    it('has non-split routes in main entrypoint', function () {
      expectFile('./assets/my-app.js').matches('routes/index');
    });

    it('does not have split controllers in main entrypoint', function () {
      expectFile('./assets/my-app.js').doesNotMatch('controllers/people');
      expectFile('./assets/my-app.js').doesNotMatch('controllers/people/show');
    });

    it('does not have split route templates in main entrypoint', function () {
      expectFile('./assets/my-app.js').doesNotMatch('templates/people');
      expectFile('./assets/my-app.js').doesNotMatch('templates/people/index');
      expectFile('./assets/my-app.js').doesNotMatch('templates/people/show');
    });

    it('does not have split routes in main entrypoint', function () {
      expectFile('./assets/my-app.js').doesNotMatch('routes/people');
      expectFile('./assets/my-app.js').doesNotMatch('routes/people/show');
    });

    it('dynamically imports the route entrypoint from the main entrypoint', function () {
      expectFile('./assets/my-app.js').matches('import("./_route_/people")');
    });

    it('has split controllers in route entrypoint', function () {
      expectFile('./assets/_route_/people.js').matches('controllers/people');
      expectFile('./assets/_route_/people.js').matches('controllers/people/show');
    });

    it('has split route templates in route entrypoint', function () {
      expectFile('./assets/_route_/people.js').matches('templates/people');
      expectFile('./assets/_route_/people.js').matches('templates/people/index');
      expectFile('./assets/_route_/people.js').matches('templates/people/show');
    });

    it('has split routes in route entrypoint', function () {
      expectFile('./assets/_route_/people.js').matches('routes/people');
      expectFile('./assets/_route_/people.js').matches('routes/people/show');
    });

    it('has no components in route entrypoint', function () {
      expectFile('./assets/_route_/people.js').doesNotMatch('all-people');
      expectFile('./assets/_route_/people.js').doesNotMatch('welcome');
      expectFile('./assets/_route_/people.js').doesNotMatch('unused');
    });

    it('has no helpers in route entrypoint', function () {
      expectFile('./assets/_route_/people.js').doesNotMatch('capitalize');
    });

    describe('audit', function () {
      let auditResults: AuditResults;
      beforeAll(async function () {
        let audit = new Audit(build.outputPath);
        auditResults = await audit.run();
      });

      it('has no issues', function () {
        expect(auditResults.findings).toEqual([]);
      });

      it('helper is consumed only from the template that uses it', function () {
        expect(auditResults.modules['./helpers/capitalize.js']?.consumedFrom).toEqual(['./components/one-person.hbs']);
      });

      it('component is consumed only from the template that uses it', function () {
        expect(auditResults.modules['./components/one-person.js']?.consumedFrom).toEqual([
          './templates/people/show.hbs',
        ]);
      });

      it('does not include unused component', function () {
        expect(auditResults.modules['./components/unused.hbs']).toBe(undefined);
      });
    });
  });

  describe('pods', function () {
    let expectFile: ExpectFile;
    let build: BuildResult;

    beforeAll(async function () {
      let buildOptions: Partial<BuildParams> = {
        stage: 2,
        type: 'app',
        emberAppOptions: {
          tests: false,
          babel: {
            plugins: [],
          },
        },
        embroiderOptions: {
          staticAddonTrees: true,
          staticAddonTestSupportTrees: true,
          staticHelpers: true,
          staticComponents: true,
          splitAtRoutes: ['people'],
        },
      };
      let app = Project.emberNew('my-app');
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
            },
          },
          components: {
            'welcome.hbs': '',
            'all-people.js': 'export default class {}',
            'one-person.hbs': '{{capitalize @person.name}}',
            'unused.hbs': '',
          },
          helpers: {
            'capitalize.js': 'export default function(){}',
          },
        },
        config: {
          'environment.js': `module.exports = function(environment) {
  let ENV = {
    modulePrefix: 'my-app',
    podModulePrefix: 'my-app/pods',
    environment,
    rootURL: '/',
    locationType: 'auto',
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
      build = await BuildResult.build(app, buildOptions);
      expectFile = expectFilesAt(build.outputPath);
    });

    afterAll(async function () {
      await build.cleanup();
    });

    it('has no components in main entrypoint', function () {
      expectFile('./assets/my-app.js').doesNotMatch('all-people');
      expectFile('./assets/my-app.js').doesNotMatch('welcome');
      expectFile('./assets/my-app.js').doesNotMatch('unused');
    });

    it('has no helpers in main entrypoint', function () {
      expectFile('./assets/my-app.js').doesNotMatch('capitalize');
    });

    it('has non-split controllers in main entrypoint', function () {
      expectFile('./assets/my-app.js').matches('pods/index/controller');
    });

    it('has non-split route templates in main entrypoint', function () {
      expectFile('./assets/my-app.js').matches('pods/index/template');
    });

    it('has non-split routes in main entrypoint', function () {
      expectFile('./assets/my-app.js').matches('pods/index/route');
    });

    it('does not have split controllers in main entrypoint', function () {
      expectFile('./assets/my-app.js').doesNotMatch('pods/people/controller');
      expectFile('./assets/my-app.js').doesNotMatch('pods/people/show/controller');
    });

    it('does not have split route templates in main entrypoint', function () {
      expectFile('./assets/my-app.js').doesNotMatch('pods/people/template');
      expectFile('./assets/my-app.js').doesNotMatch('pods/people/index/template');
      expectFile('./assets/my-app.js').doesNotMatch('pods/people/show/template');
    });

    it('does not have split routes in main entrypoint', function () {
      expectFile('./assets/my-app.js').doesNotMatch('pods/people/route');
      expectFile('./assets/my-app.js').doesNotMatch('pods/people/show/route');
    });

    it('dynamically imports the route entrypoint from the main entrypoint', function () {
      expectFile('./assets/my-app.js').matches('import("./_route_/people")');
    });

    it('has split controllers in route entrypoint', function () {
      expectFile('./assets/_route_/people.js').matches('pods/people/controller');
      expectFile('./assets/_route_/people.js').matches('pods/people/show/controller');
    });

    it('has split route templates in route entrypoint', function () {
      expectFile('./assets/_route_/people.js').matches('pods/people/template');
      expectFile('./assets/_route_/people.js').matches('pods/people/index/template');
      expectFile('./assets/_route_/people.js').matches('pods/people/show/template');
    });

    it('has split routes in route entrypoint', function () {
      expectFile('./assets/_route_/people.js').matches('pods/people/route');
      expectFile('./assets/_route_/people.js').matches('pods/people/show/route');
    });

    it('has no components in route entrypoint', function () {
      expectFile('./assets/_route_/people.js').doesNotMatch('all-people');
      expectFile('./assets/_route_/people.js').doesNotMatch('welcome');
      expectFile('./assets/_route_/people.js').doesNotMatch('unused');
    });

    it('has no helpers in route entrypoint', function () {
      expectFile('./assets/_route_/people.js').doesNotMatch('capitalize');
    });

    describe('audit', function () {
      let auditResults: AuditResults;
      beforeAll(async function () {
        let audit = new Audit(build.outputPath);
        auditResults = await audit.run();
      });

      it('has no issues', function () {
        expect(auditResults.findings).toEqual([]);
      });

      it('helper is consumed only from the template that uses it', function () {
        expect(auditResults.modules['./helpers/capitalize.js']?.consumedFrom).toEqual(['./components/one-person.hbs']);
      });

      it('component is consumed only from the template that uses it', function () {
        expect(auditResults.modules['./components/one-person.js']?.consumedFrom).toEqual([
          './pods/people/show/template.hbs',
        ]);
      });

      it('does not include unused component', function () {
        expect(auditResults.modules['./components/unused.hbs']).toBe(undefined);
      });
    });
  });
});
