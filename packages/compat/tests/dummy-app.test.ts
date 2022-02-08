import { Project, BuildResult, expectFilesAt, ExpectFile } from '@embroider/test-support';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import { writeFileSync } from 'fs-extra';
import { join } from 'path';

describe('dummy app tests', function () {
  jest.setTimeout(120000);
  let build: BuildResult;
  let project: Project;
  let expectFile: ExpectFile;

  throwOnWarnings();

  beforeAll(async function () {
    project = Project.addonNew();
    merge(project.files, {
      'ember-cli-build.js': `'use strict';

      const EmberAddon = require('ember-cli/lib/broccoli/ember-addon');

      module.exports = function(defaults) {
        let app = new EmberAddon(defaults, {});
        const { Webpack } = require('@embroider/webpack');
        return require('@embroider/compat').compatBuild(app, Webpack);
      };`,
      'index.js': `'use strict';

      module.exports = {
        name: require('./package').name
      };`,

      addon: {
        components: {
          'example.hbs': `hello`,
        },
      },

      tests: {
        dummy: {
          app: {
            'app.js': `import Application from '@ember/application';
            import Resolver from 'ember-resolver';
            import loadInitializers from 'ember-load-initializers';
            import config from 'dummy/config/environment';

            export default class App extends Application {
              modulePrefix = config.modulePrefix;
              podModulePrefix = config.podModulePrefix;
              Resolver = Resolver;
            }

            loadInitializers(App, config.modulePrefix);`,
            'index.html': `<!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <title>Dummy</title>
                <meta name="description" content="">
                <meta name="viewport" content="width=device-width, initial-scale=1">

                {{content-for "head"}}

                <link integrity="" rel="stylesheet" href="{{rootURL}}assets/vendor.css">
                <link integrity="" rel="stylesheet" href="{{rootURL}}assets/dummy.css">

                {{content-for "head-footer"}}
              </head>
              <body>
                {{content-for "body"}}

                <script src="{{rootURL}}assets/vendor.js"></script>
                <script src="{{rootURL}}assets/dummy.js"></script>

                {{content-for "body-footer"}}
              </body>
            </html>`,
            styles: {
              'app.css': '',
            },
          },
          config: {
            'environment.js': `module.exports = function(environment) {
              let ENV = {
                modulePrefix: 'dummy',
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
          public: {
            'robots.txt': 'go away bots',
          },
        },
      },
    });

    build = await BuildResult.build(project, {
      stage: 2,
      type: 'addon',
      emberAppOptions: {
        tests: false,
      },
    });
    expectFile = expectFilesAt(build.outputPath);
  });

  afterAll(async function () {
    await build.cleanup();
  });

  test('rebuilds addon code', async function () {
    expectFile('../../components/example.hbs').matches(/hello/);
    writeFileSync(join(project.baseDir, 'addon/components/example.hbs'), 'goodbye');
    build.didChange(project.baseDir);
    await build.rebuild();
    expectFile('../../components/example.hbs').matches(/goodbye/);
  });

  test('contains public assets from dummy app', async function () {
    expectFile('robots.txt').exists();
    expectFile('package.json').json().get('ember-addon.assets').includes('robots.txt');
  });
});
