import { minimalAppScenarios } from './scenarios';
import { throwOnWarnings } from '@embroider/core';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';
import QUnit from 'qunit';
import CommandWatcher from './helpers/command-watcher';
import fetch from 'node-fetch';

const { module: Qmodule, test } = QUnit;

/**
 * Tests that splitAtRoutes can be configured via the ember() vite plugin,
 * without needing an ember-cli-build.js. Uses the minimal app template.
 */
minimalAppScenarios
  .only('canary')
  .map('vite-splitAtRoutes', app => {
    app.linkDevDependency('@embroider/test-support', { baseDir: __dirname });

    app.mergeFiles({
      'vite.config.mjs': `
        import { defineConfig } from 'vite';
        import { extensions, ember } from '@embroider/vite';
        import { babel } from '@rollup/plugin-babel';

        export default defineConfig({
          plugins: [
            ember({
              splitAtRoutes: ['people'],
            }),
            babel({
              babelHelpers: 'runtime',
              extensions,
            }),
          ],
        });
      `,
      src: {
        'app.js': `
          import Application from '@ember/application';
          import Resolver from 'ember-resolver';
          import config from '#config';
          import compatModules from '@embroider/virtual/compat-modules';

          export default class App extends Application {
            modulePrefix = config.modulePrefix;
            Resolver = Resolver.withModules(compatModules);
          }
        `,
        'router.js': `
          import EmberRouter from '@embroider/router';
          import config from '#config';

          export default class Router extends EmberRouter {
            location = config.locationType;
            rootURL = config.rootURL;
          }

          Router.map(function () {
            this.route('people');
          });
        `,
        components: {
          'all-people.gjs': `<template><div>All people</div></template>`,
          'one-person.gjs': `
            import capitalize from '../helpers/capitalize.js';
            <template><div>{{capitalize @person.name}}</div></template>
          `,
          'unused.gjs': `<template><div>unused</div></template>`,
        },
        helpers: {
          'capitalize.js': 'export default function(){}',
        },
        modifiers: {
          'auto-focus.js': 'export default function(){}',
        },
        templates: {
          'application.gjs': `<template>{{outlet}}</template>`,
          'index.gjs': `<template><div>Index</div></template>`,
          'people.gjs': `<template><h1>People</h1>{{outlet}}</template>`,
          people: {
            'index.gjs': `
              import AllPeople from '../../components/all-people.gjs';
              <template><AllPeople /></template>
            `,
            'show.gjs': `
              import OnePerson from '../../components/one-person.gjs';
              <template><OnePerson /></template>
            `,
            'edit.gjs': `
              import autoFocus from '../../modifiers/auto-focus.js';
              <template><input {{autoFocus}} /></template>
            `,
          },
        },
        routes: {
          'index.js': `import Route from '@ember/routing/route'; export default class extends Route {}`,
          'people.js': `import Route from '@ember/routing/route'; export default class extends Route {}`,
          people: {
            'show.js': `import Route from '@ember/routing/route'; export default class extends Route {}`,
          },
        },
        controllers: {
          'index.js': `import Controller from '@ember/controller'; export default class extends Controller {}`,
          'people.js': `import Controller from '@ember/controller'; export default class extends Controller {}`,
          people: {
            'show.js': `import Controller from '@ember/controller'; export default class extends Controller {}`,
          },
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let server: CommandWatcher;
      let appURL: string;

      hooks.before(async () => {
        let app = await scenario.prepare();
        server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
        [, appURL] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);
      });

      hooks.after(async () => {
        await server?.shutdown();
      });

      let expectAudit = setupAuditTest(hooks, () => ({
        appURL,
        startingFrom: ['index.html'],
        fetch: fetch as unknown as typeof globalThis.fetch,
      }));

      test('has non-split controllers in main entrypoint', function () {
        checkContents(expectAudit, contents => {
          if (!contents.includes('controllers/index')) {
            throw new Error(`controllers/index should be found in entrypoint:\n---\n${contents}`);
          }
        });
      });

      test('has non-split route templates in main entrypoint', function () {
        checkContents(expectAudit, contents => {
          if (!contents.includes('templates/index')) {
            throw new Error(`templates/index should be found in entrypoint:\n---\n${contents}`);
          }
        });
      });

      test('has non-split routes in main entrypoint', function () {
        checkContents(expectAudit, contents => {
          if (!contents.includes('routes/index')) {
            throw new Error(`routes/index should be found in entrypoint:\n---\n${contents}`);
          }
        });
      });

      test('does not have split controllers in main entrypoint', function () {
        checkContents(expectAudit, contents => {
          for (let t of ['controllers/people', 'controllers/people/show']) {
            if (contents.includes(t)) {
              throw new Error(`${t} should not be found in entrypoint`);
            }
          }
        });
      });

      test('does not have split route templates in main entrypoint', function () {
        checkContents(expectAudit, contents => {
          for (let t of ['templates/people', 'templates/people/index', 'templates/people/show']) {
            if (contents.includes(t)) {
              throw new Error(`${t} should not be found in entrypoint`);
            }
          }
        });
      });

      test('does not have split routes in main entrypoint', function () {
        checkContents(expectAudit, contents => {
          for (let t of ['routes/people', 'routes/people/show']) {
            if (contents.includes(t)) {
              throw new Error(`${t} should not be found in entrypoint`);
            }
          }
        });
      });

      test('dynamically imports the route entrypoint from the main entrypoint', function () {
        checkContents(expectAudit, contents => {
          if (!/import\(".*-embroider-route-entrypoint\.js:route=people/.test(contents)) {
            throw new Error(
              `Entrypoint should contain a dynamic import for the people route entrypoint:\n---\n${contents}`
            );
          }
        });
      });

      test('has split controllers in route entrypoint', function () {
        checkContents(
          expectAudit,
          contents => {
            for (let t of ['controllers/people', 'controllers/people/show']) {
              if (!contents.includes(t)) {
                throw new Error(`${t} should be found in route entrypoint:\n---\n${contents}`);
              }
            }
          },
          /\/-embroider-route-entrypoint\.js:route=people/
        );
      });

      test('has split route templates in route entrypoint', function () {
        checkContents(
          expectAudit,
          contents => {
            for (let t of ['templates/people', 'templates/people/index', 'templates/people/show']) {
              if (!contents.includes(t)) {
                throw new Error(`${t} should be found in route entrypoint:\n---\n${contents}`);
              }
            }
          },
          /\/-embroider-route-entrypoint\.js:route=people/
        );
      });

      test('has split routes in route entrypoint', function () {
        checkContents(
          expectAudit,
          contents => {
            for (let t of ['routes/people', 'routes/people/show']) {
              if (!contents.includes(t)) {
                throw new Error(`${t} should be found in route entrypoint:\n---\n${contents}`);
              }
            }
          },
          /\/-embroider-route-entrypoint\.js:route=people/
        );
      });

      test('has no issues', function () {
        expectAudit.hasNoFindings();
      });

      test('does not include unused component', function () {
        expectAudit.module('./src/components/unused.gjs').doesNotExist();
      });
    });
  });

function checkContents(
  expectAudit: ReturnType<typeof setupAuditTest>,
  fn: (contents: string) => void,
  entrypointFile?: string | RegExp
) {
  let resolved = expectAudit
    .module('./index.html')
    .resolves(/\/index.html.*/) // in-html app-boot script
    .toModule()
    .resolves(/\/app\.js.*/)
    .toModule()
    .resolves(/.*\/-embroider-entrypoint\.js/);

  if (entrypointFile) {
    resolved = resolved.toModule().resolves(entrypointFile);
  }
  resolved.toModule().withContents(contents => {
    fn(contents);
    return true;
  });
}
