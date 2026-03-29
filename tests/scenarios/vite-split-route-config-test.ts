import { appScenarios, renameApp } from './scenarios';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';
import QUnit from 'qunit';
import CommandWatcher from './helpers/command-watcher';
import fetch from 'node-fetch';

const { module: Qmodule, test } = QUnit;

/**
 * Tests that splitAtRoutes can be configured via the ember() vite plugin
 * rather than in ember-cli-build.js. The ember-cli-build.js is nulled out
 * to a bare minimum compat build with no splitAtRoutes config.
 */
let splitScenarios = appScenarios.map('vite-splitAtRoutes', app => {
  renameApp(app, 'my-app');
  merge(app.files, {
    'ember-cli-build.js': `
      'use strict';
      const EmberApp = require('ember-cli/lib/broccoli/ember-app');
      const { maybeEmbroider } = require('@embroider/test-setup');
      module.exports = function (defaults) {
        let app = new EmberApp(defaults, {});
        return maybeEmbroider(app);
      };
    `,
    'vite.config.mjs': `
      import { defineConfig } from "vite";
      import { extensions, classicEmberSupport, ember } from "@embroider/vite";
      import { babel } from "@rollup/plugin-babel";

      export default defineConfig({
        plugins: [
          classicEmberSupport(),
          ember({
            splitAtRoutes: ['people'],
          }),
          babel({
            babelHelpers: "runtime",
            extensions,
          }),
        ],
      });
    `,
    app: {
      components: {
        'all-people.gjs': `<template><div>All people</div></template>`,
        'one-person.gjs': `
          import capitalize from 'my-app/helpers/capitalize';
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
      templates: {
        'index.gjs': `<template><div>Index</div></template>`,
        'people.gjs': `<template><h1>People</h1>{{outlet}}</template>`,
        people: {
          'index.gjs': `
            import AllPeople from 'my-app/components/all-people';
            <template><AllPeople /></template>
          `,
          'show.gjs': `
            import OnePerson from 'my-app/components/one-person';
            <template><OnePerson /></template>
          `,
          'edit.gjs': `
            import autoFocus from 'my-app/modifiers/auto-focus';
            <template><input {{autoFocus}} /></template>
          `,
        },
      },
      controllers: {
        'index.js': `import Controller from '@ember/controller'; export default class extends Controller {}`,
        'people.js': `import Controller from '@ember/controller'; export default class extends Controller {}`,
        people: {
          'show.js': `import Controller from '@ember/controller'; export default class extends Controller {}`,
        },
      },
      routes: {
        'index.js': `import Route from '@ember/routing/route'; export default class extends Route {}`,
        'people.js': `import Route from '@ember/routing/route'; export default class extends Route {}`,
        people: {
          'show.js': `import Route from '@ember/routing/route'; export default class extends Route {}`,
        },
      },
    },
  });
  app.linkDependency('@ember/string', { baseDir: __dirname });
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
    .resolves(/\/app\/app\.js.*/)
    .toModule()
    .resolves(/.*\/-embroider-entrypoint.js/);

  if (entrypointFile) {
    resolved = resolved.toModule().resolves(entrypointFile);
  }
  resolved.toModule().withContents(contents => {
    fn(contents);
    return true;
  });
}

function notInEntrypointFunction(expectAudit: ReturnType<typeof setupAuditTest>) {
  return function (text: string[] | string, entrypointFile?: string | RegExp) {
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
      },
      entrypointFile
    );
  };
}

function inEntrypointFunction(expectAudit: ReturnType<typeof setupAuditTest>) {
  return function (text: string[] | string | RegExp, entrypointFile?: string | RegExp) {
    checkContents(
      expectAudit,
      contents => {
        if (Array.isArray(text)) {
          text.forEach(t => {
            if (!contents.includes(t)) {
              throw new Error(`${t} should be found in entrypoint:
---
${contents}`);
            }
          });
        } else if (text instanceof RegExp) {
          if (!text.test(contents)) {
            throw new Error(`Entrypoint should match ${text}`);
          }
        } else {
          if (!contents.includes(text)) {
            throw new Error(`${text} should be found in entrypoint`);
          }
        }
      },
      entrypointFile
    );
  };
}

splitScenarios.forEachScenario(scenario => {
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
    let notInEntrypoint = notInEntrypointFunction(expectAudit);
    let inEntrypoint = inEntrypointFunction(expectAudit);

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
      inEntrypoint(/import\("\/app\/-embroider-route-entrypoint.js:route=people/);
    });

    test('has split controllers in route entrypoint', function () {
      inEntrypoint(
        ['app/controllers/people', 'app/controllers/people/show'],
        /\/app\/-embroider-route-entrypoint.js:route=people/
      );
    });

    test('has split route templates in route entrypoint', function () {
      inEntrypoint(
        ['app/templates/people', 'app/templates/people/index', 'app/templates/people/show'],
        /\/app\/-embroider-route-entrypoint.js:route=people/
      );
    });

    test('has split routes in route entrypoint', function () {
      inEntrypoint(
        ['app/routes/people', 'app/routes/people/show'],
        /\/app\/-embroider-route-entrypoint.js:route=people/
      );
    });

    test('has no components in route entrypoint', function () {
      notInEntrypoint(['all-people', 'unused'], /\/app\/-embroider-route-entrypoint.js:route=people/);
    });

    test('has no helpers in route entrypoint', function () {
      notInEntrypoint('capitalize', /\/app\/-embroider-route-entrypoint.js:route=people/);
    });

    test('has no modifiers in route entrypoint', function () {
      notInEntrypoint('auto-focus', /\/app\/-embroider-route-entrypoint.js:route=people/);
    });

    test('has no issues', function () {
      expectAudit.hasNoFindings();
    });

    test('does not include unused component', function () {
      expectAudit.module('./app/components/unused.gjs').doesNotExist();
    });
  });
});
