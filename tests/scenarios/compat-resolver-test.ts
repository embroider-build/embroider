import { AppMeta } from '@embroider/shared-internals';
import { ExpectFile, expectFilesAt, Transpiler } from '@embroider/test-support';
import { outputFileSync } from 'fs-extra';
import { resolve } from 'path';

import QUnit from 'qunit';
import { Project, Scenarios } from 'scenario-tester';

const { module: Qmodule, test } = QUnit;

Scenarios.fromProject(() => new Project())
  .map('compat-resolver-test', app => {
    let appMeta: AppMeta = {
      type: 'app',
      version: 2,
      'auto-upgraded': true,
      assets: [],
      'root-url': '/',
      babel: {
        majorVersion: 7,
        filename: '_babel_config.js',
        isParallelSafe: true,
        fileFilter: '_babel_filter.js',
      },
    };
    app.pkg = {
      name: 'my-app',
      keywords: ['ember-addon'],
      'ember-addon': appMeta,
    };

    app.mergeFiles({
      '_babel_config.js': `
      module.exports = {}
      `,
      '_babel_filter.js': `
        module.exports = function(filename) { return true }
      `,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let expectFile: ExpectFile;
      let build: Transpiler;
      let givenFiles: (files: Record<string, string>) => void;

      hooks.beforeEach(async assert => {
        let app = await scenario.prepare();
        expectFile = expectFilesAt(app.dir, { qunit: assert });
        build = new Transpiler(app.dir);
        givenFiles = function (files: Record<string, string>) {
          for (let [filename, contents] of Object.entries(files)) {
            outputFileSync(resolve(app.dir, filename), contents, 'utf8');
          }
        };
      });

      test('emits no components when staticComponents is off', function () {
        givenFiles({
          'components/hello-world.js': '',
          'templates/application.hbs': `{{hello-world}} <HelloWorld />`,
        });
        expectFile('templates/application.hbs').transform(build.transpile).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{hello-world}} <HelloWorld />", {
            moduleName: "my-app/templates/application.hbs",
          });`);
      });
    });
  });
