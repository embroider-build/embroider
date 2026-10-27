import { tsAppScenarios, tsAppClassicScenarios, minimalAppScenarios, isUsingQunit9 } from './scenarios';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { PreparedApp, Project } from 'scenario-tester';
import QUnit from 'qunit';

const { module: Qmodule, test } = QUnit;

function setupScenario(project: Project) {
  // not strictly needed in the embroider case, but needed in the classic
  // case.
  project.linkDevDependency('@embroider/macros', { baseDir: __dirname });

  project.mergeFiles({
    'ember-cli-build.js': `
      'use strict';

      const EmberApp = require('ember-cli/lib/broccoli/ember-app');
      const { compatBuild } = require('@embroider/compat');

      module.exports = async function (defaults) {
        const { buildOnce } = await import('@embroider/vite');
        const app = new EmberApp(defaults, {
            'ember-cli-babel': {
              enableTypeScriptTransform: true,
            },
            '@embroider/macros': {
              setOwnConfig: {
                expectClassic: process.env.EMBROIDER_TEST_SETUP_FORCE === 'classic'
              }
            }
          });

        return compatBuild(app, buildOnce, { splitAtRoutes: ['split-me'] });
      };
    `,
    app: {
      components: {
        'used-in-child.hbs': `
            <div data-test-used-in-child>This is the used-in-child component</div>
          `,
      },
      controllers: {
        'split-me.js': `
            import Controller from '@ember/controller';
            import { tracked } from '@glimmer/tracking';
            export default class SplitMeController extends Controller {
              queryParams = ['name'];

              @tracked name;

              updateName = (event) => {
                this.name = event.target.value;
              }
            }
          `,
        'split-me': {
          'child.ts': `
              import Controller from '@ember/controller';
              export default class SplitMeChildController extends Controller {}
            `,
        },
      },
      routes: {
        'split-me.ts': `
            import Route from '@ember/routing/route';
            export default class SplitMeRoute extends Route {}
          `,
        'split-me': {
          'child.ts': `
              import Route from '@ember/routing/route';
              export default class SplitMeChildRoute extends Route {}
            `,
          'index.ts': `
              import Route from '@ember/routing/route';
              export default class SplitMeIndexRoute extends Route {}
            `,
        },
        'slow.ts': `
          import Route from "@ember/routing/route";
          export default class SlowRoute extends Route {
            async model() {
              return await new Promise((resolve) => {
                (globalThis as any).resolveSlowRoute = resolve;
              });
            }
          }
        `,
      },
      templates: {
        'application.hbs': `
            {{page-title 'Router Tests'}}

            <h2 id='title'>Welcome to Ember</h2>

            <LinkTo @route='index' data-test-index-link>Index</LinkTo>
            <LinkTo @route='split-me' data-test-split-me-link>Split Index</LinkTo>
            <LinkTo @route='split-me.child' data-test-split-me-child-link>Split Child</LinkTo>

            {{outlet}}
          `,
        'split-me.hbs': `{{outlet}}
                        <label for="name-input">Enter name to update query params</label>
                        <input id="name-input" type="text" value={{this.name}} {{on "change" this.updateName}} />`,
        'split-me': {
          'child.hbs': `<UsedInChild />`,
          'index.hbs': `<div data-test-split-me-index>This is the split-me/index.</div>`,
        },
        'slow.hbs': `<div data-slow>{{@model.message}}</div>`,
        'slow-loading.hbs': `<div data-loading>loading</div>`,
      },
      'router.ts': `
          import EmberRouter from '@embroider/router';
          import config from 'ts-app-template/config/environment';

          export default class Router extends EmberRouter {
            location = config.locationType;
            rootURL = config.rootURL;
          }

          Router.map(function () {
            this.route('split-me', function () {
              this.route('child');
            });
            this.route('slow');
          });
        `,
    },
    tests: {
      acceptance: {
        'lazy-routes-test.ts': `
          import { module, test, only } from "qunit";
          import { click, currentURL, fillIn, visit } from "@ember/test-helpers";
          import { setupApplicationTest } from "ember-qunit";
          import { getGlobalConfig, getOwnConfig } from "@embroider/macros";
          import type Resolver from "ember-resolver";

          declare global {
            interface Assert {
              containerHas(name: string, message?: string): void;
              containerDoesNotHave(name: string, message?: string): void;
            }
          }

          module("Acceptance | lazy routes", function (hooks) {
            setupApplicationTest(hooks);

            hooks.beforeEach(function (assert) {
              // these assertions cannot do owner.lookup(name) because that permanently
              // caches its result in the Registry, which is shared between tests.

              assert.containerHas = (name: \`\${string}:\${string}\`, message?: string) => {
                let resolver = this.owner.lookup("resolver:current") as Resolver;
                assert.ok(Boolean(resolver.resolve(name)), message);
              };

              assert.containerDoesNotHave = (
                name: \`\${string}:\${string}\`,
                message?: string,
              ) => {
                let resolver = this.owner.lookup("resolver:current") as Resolver;
                assert.notOk(Boolean(resolver.resolve(name)), message);
              };
            });

            if (getOwnConfig<{ expectClassic: boolean }>().expectClassic) {
              test("lazy routes present", async function (assert) {
                await visit("/");
                assert.containerHas(
                  "controller:split-me",
                  "classic build has controller",
                );
                assert.containerHas("route:split-me", "classic build has route");
                assert.containerHas("template:split-me", "classic build has template");
                assert.containerHas(
                  "controller:split-me/child",
                  "classic build has child controller",
                );
                assert.containerHas(
                  "route:split-me/child",
                  "classic build has child route",
                );
                assert.containerHas(
                  "template:split-me/child",
                  "classic build has child template",
                );
                assert.containerHas(
                  "component:used-in-child",
                  "classic build has all components",
                );
              });
            } else {
              test("lazy routes not yet present", async function (assert) {
                await visit("/");
                assert.containerDoesNotHave("controller:split-me", "controller is lazy");
                assert.containerDoesNotHave("route:split-me", "route is lazy");
                assert.containerDoesNotHave("template:split-me", "template is lazy");
                assert.containerDoesNotHave(
                  "controller:split-me/child",
                  "child controller is lazy",
                );
                assert.containerDoesNotHave(
                  "route:split-me/child",
                  "child route is lazy",
                );
                assert.containerDoesNotHave(
                  "template:split-me/child",
                  "child template is lazy",
                );
              });
            }

            if (getOwnConfig<{ expectClassic: boolean }>().expectClassic) {
              test("classic builds can not see @embroider/core config", async function (assert) {
                let config = getGlobalConfig<{ "@embroider/core"?: { active: true } }>()[
                  "@embroider/core"
                ];
                assert.strictEqual(
                  config,
                  undefined,
                  "expected no embroider core config",
                );
              });
            } else {
              test("can see @embroider/core config", async function (assert) {
                let config = getGlobalConfig<{ "@embroider/core"?: { active: true } }>()[
                  "@embroider/core"
                ];
                assert.true(config!.active, "expected to see active @embroider/core");
              });
            }

            test("can enter a lazy route", async function (assert) {
              await visit("/split-me");
              assert.ok(
                document.querySelector("[data-test-split-me-index]"),
                "split-me/index rendered",
              );
            });

            test("can enter a child of a lazy route", async function (assert) {
              await visit("/split-me/child");
              assert.ok(
                document.querySelector("[data-test-used-in-child]"),
                "split-me/child rendered",
              );
            });
          });
          module("Acceptance | lazy routes query params", function (hooks) {
            setupApplicationTest(hooks);

            test("sticky params when re-entering route", async function (assert) {
              await visit("/split-me");
              await fillIn('#name-input','QueryValue');
              assert.equal(currentURL(), '/split-me?name=QueryValue', "query param is updated in the url");
              await click('[data-test-index-link]');
              assert.equal(currentURL(), '/', "query param removed from url on navigation");
              await click('[data-test-split-me-link]');
              assert.equal(currentURL(), '/split-me?name=QueryValue', "query param is updated in the url");
              assert.ok(
                document.querySelector("[data-test-split-me-index]"),
                "split-me/index rendered",
              );
            });
          });

        `,
        'slow-test.js': `
          import { module, test } from "qunit";
          import { visit, waitFor, settled } from "@ember/test-helpers";
          import { setupApplicationTest } from "ember-qunit";

          module("Acceptance | slow", function (hooks) {
            setupApplicationTest(hooks);

            test("loading routes work", async function (assert) {
              visit("/slow");
              let element = await waitFor("[data-loading]");
              assert.dom(element).containsText("loading");
              globalThis.resolveSlowRoute({
                message: "I'm slow",
              });
              await settled();
              assert.dom("[data-slow]").containsText("I'm slow");
            });
          });
        `,
      },
    },
  });
}

function useQunit9TestHelper(project: Project) {
  if (isUsingQunit9(project)) {
    (project.files['tests'] as any)['test-helper.ts'] = `
import Application from 'ts-app-template/app';
import config from 'ts-app-template/config/environment';
import * as QUnit from 'qunit';
import { setApplication } from '@ember/test-helpers';
import { setup } from 'qunit-dom';
import { start as qunitStart, setupEmberOnerrorValidation } from 'ember-qunit';

export function start() {

  setApplication(Application.create(config.APP));
  setup(QUnit.assert);
  setupEmberOnerrorValidation();
  qunitStart();
}
`;
  }
}

tsAppScenarios
  .map('router-embroider', project => {
    setupScenario(project);

    useQunit9TestHelper(project);
    project.mergeFiles({
      'ember-cli-build.js': `
        'use strict';

          const EmberApp = require('ember-cli/lib/broccoli/ember-app');
          const { compatBuild } = require('@embroider/compat');

          module.exports = async function (defaults) {
            const { buildOnce } = await import('@embroider/vite');
            const app = new EmberApp(defaults, {
                'ember-cli-babel': {
                  enableTypeScriptTransform: true,
                },
                '@embroider/macros': {
                  setOwnConfig: {
                    expectClassic: process.env.EMBROIDER_TEST_SETUP_FORCE === 'classic'
                  }
                }
              });

            return compatBuild(app, buildOnce, { splitAtRoutes: ['split-me'] });
          };
        `,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`type checks`, async function (assert) {
        let result = await app.execute('pnpm tsc');
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`EMBROIDER pnpm test:ember`, async function (assert) {
        let result = await app.execute('pnpm test:ember', {
          env: {
            EMBROIDER_TEST_SETUP_FORCE: 'embroider',
            EMBROIDER_TEST_SETUP_OPTIONS: 'optimized',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });

tsAppClassicScenarios
  .map('router-classic', project => {
    setupScenario(project);

    if (isUsingQunit9(project)) {
      (project.files['tests'] as any)['test-helper.ts'] = `
  import Application from 'ts-app-template/app';
  import config from 'ts-app-template/config/environment';
  import * as QUnit from 'qunit';
  import { setApplication } from '@ember/test-helpers';
  import { setup } from 'qunit-dom';
  import { start as qunitStart, setupEmberOnerrorValidation } from 'ember-qunit';
  import { loadTests } from 'ember-qunit/test-loader';

  setApplication(Application.create(config.APP));
  setup(QUnit.assert);
  setupEmberOnerrorValidation();
  loadTests()
  qunitStart();
  `;
    }

    project.mergeFiles({
      'ember-cli-build.js': `
      'use strict';

      const EmberApp = require('ember-cli/lib/broccoli/ember-app');
      const { maybeEmbroider } = require('@embroider/test-setup');

      module.exports = function (defaults) {
        let app = new EmberApp(defaults, {
          'ember-cli-babel': {
            enableTypeScriptTransform: true,
          },
          '@embroider/macros': {
            setOwnConfig: {
              expectClassic: process.env.EMBROIDER_TEST_SETUP_FORCE === 'classic'
            }
          }
        });

        return maybeEmbroider(app, {
          staticInvokables: true,
          splitAtRoutes: ['split-me'],
        });
      };
    `,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`CLASSIC pnpm test:ember`, async function (assert) {
        let result = await app.execute('pnpm ember test', {
          env: {
            EMBROIDER_TEST_SETUP_FORCE: 'classic',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });

const embroiderCliBuild = (options: string) => `
  'use strict';

  const EmberApp = require('ember-cli/lib/broccoli/ember-app');
  const { compatBuild } = require('@embroider/compat');

  module.exports = async function (defaults) {
    const { buildOnce } = await import('@embroider/vite');
    const app = new EmberApp(defaults, {
      'ember-cli-babel': {
        enableTypeScriptTransform: true,
      },
      '@embroider/macros': {
        setOwnConfig: {
          expectClassic: false,
        },
      },
    });

    return compatBuild(app, buildOnce, ${options});
  };
`;

tsAppScenarios
  .only('release')
  .map('router-embroider-config', project => {
    setupScenario(project);
    useQunit9TestHelper(project);
    project.mergeFiles({
      'ember-cli-build.js': embroiderCliBuild('{}'),
      'embroider.config.cjs': `module.exports = { splitAtRoutes: ['split-me'], staticAppPaths: ['static-dir'] };`,
      app: {
        'static-dir': {
          'my-library.js': `
            globalThis.staticDirMyLibLoaded = true;
            export {};
          `,
        },
        'non-static-dir': {
          'another-library.js': `
            globalThis.anotherLibraryLoaded = true;
            export {};
          `,
        },
      },
      tests: {
        unit: {
          'static-app-paths-test.js': `
            import { module, test } from 'qunit';

            module('Unit | staticAppPaths from the Embroider config', function () {
              test('non-static-dir is loaded', function (assert) {
                assert.true(globalThis.anotherLibraryLoaded);
              });

              test('static-dir is not loaded', function (assert) {
                assert.notOk(globalThis.staticDirMyLibLoaded);
              });
            });
          `,
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`reads splitAtRoutes and staticAppPaths from embroider.config.cjs`, async function (assert) {
        let result = await app.execute('pnpm test:ember', {
          env: {
            EMBROIDER_TEST_SETUP_FORCE: 'embroider',
            EMBROIDER_TEST_SETUP_OPTIONS: 'optimized',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`errors when ember-cli-build sets the same option`, async function (assert) {
        writeFileSync(join(app.dir, 'ember-cli-build.js'), embroiderCliBuild(`{ splitAtRoutes: ['split-me'] }`));
        let result = await app.execute('pnpm vite build');
        assert.notEqual(result.exitCode, 0, result.output);
        assert.true(
          result.output.includes(
            'These Embroider options are set in ember-cli-build and in embroider.config.cjs: splitAtRoutes. Set each option in one place only.'
          ),
          result.output
        );
      });
    });
  });

minimalAppScenarios
  .only('canary')
  .map('router-minimal-embroider-config', project => {
    /**
     * compat-modules includes the app-js of every active addon.
     * The app-js of ember-data needs an ember-cli-build file.
     */
    project.removeDevDependency('ember-data');

    project.mergeFiles({
      'embroider.config.js': `export default { splitAtRoutes: ['split-me'], staticAppPaths: ['static-dir'] };`,
      src: {
        'static-dir': {
          'my-library.js': `
            globalThis.staticDirMyLibLoaded = true;
            export {};
          `,
        },
        'non-static-dir': {
          'another-library.js': `
            globalThis.anotherLibraryLoaded = true;
            export {};
          `,
        },
        'registry.js': null,
        'app.js': `
          import Application from '@ember/application';
          import Resolver from 'ember-resolver';
          import compatModules from '@embroider/virtual/compat-modules';
          import config from '#config';

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
            this.route('about');
            this.route('split-me', function () {
              this.route('child');
            });
          });
        `,
        routes: {
          'about.js': `
            import Route from '@ember/routing/route';
            export default class AboutRoute extends Route {}
          `,
          'split-me.js': `
            import Route from '@ember/routing/route';
            export default class SplitMeRoute extends Route {}
          `,
        },
        templates: {
          'about.gjs': `<template><div data-test-about>This is the about route.</div></template>`,
          'split-me.gjs': `<template>{{outlet}}</template>`,
          'split-me': {
            'index.gjs': `<template><div data-test-split-me-index>This is the split-me/index.</div></template>`,
            'child.gjs': `<template><div data-test-split-me-child>This is the split-me/child.</div></template>`,
          },
        },
      },
      tests: {
        unit: {
          'static-app-paths-test.js': `
            import { module, test } from 'qunit';

            module('Unit | staticAppPaths from the Embroider config', function () {
              test('non-static-dir is loaded', function (assert) {
                assert.true(globalThis.anotherLibraryLoaded);
              });

              test('static-dir is not loaded', function (assert) {
                assert.notOk(globalThis.staticDirMyLibLoaded);
              });
            });
          `,
        },
        'test-helper.js': `
          import Application from '#src/app';
          import config, { enterTestMode } from '#config';
          import * as QUnit from 'qunit';
          import { setApplication } from '@ember/test-helpers';
          import { setup } from 'qunit-dom';
          import { start as qunitStart, setupEmberOnerrorValidation } from 'ember-qunit';

          export function start() {
            enterTestMode();
            setApplication(Application.create(config.APP));
            setup(QUnit.assert);
            setupEmberOnerrorValidation();
            qunitStart();
          }
        `,
        acceptance: {
          'lazy-routes-test.js': `
            import { module, test } from 'qunit';
            import { visit } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';

            module('Acceptance | lazy routes', function (hooks) {
              setupApplicationTest(hooks);

              /**
               * One test, because the resolver keeps the modules of a loaded bundle.
               * A second test would see split-me as loaded already.
               */
              test('loads split-me only when the app enters it', async function (assert) {
                let resolver = this.owner.lookup('resolver:current');

                await visit('/about');
                assert.dom('[data-test-about]').exists();
                assert.ok(resolver.resolve('route:about'), 'about is in the initial bundle');
                assert.notOk(resolver.resolve('route:split-me'), 'split-me route is not loaded');
                assert.notOk(resolver.resolve('template:split-me'), 'split-me template is not loaded');
                assert.notOk(resolver.resolve('template:split-me/child'), 'split-me/child template is not loaded');

                await visit('/split-me');
                assert.dom('[data-test-split-me-index]').exists();
                assert.ok(resolver.resolve('route:split-me'), 'split-me route is loaded');
                assert.ok(resolver.resolve('template:split-me/child'), 'split-me/child template is loaded');

                await visit('/split-me/child');
                assert.dom('[data-test-split-me-child]').exists();
              });
            });
          `,
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`vite build puts split-me in its own chunk`, async function (assert) {
        let result = await app.execute('pnpm cross-env NODE_ENV=development vite build --mode development');
        assert.equal(result.exitCode, 0, result.output);

        let assetsDir = join(app.dir, 'dist', 'assets');
        let chunks = readdirSync(assetsDir).filter(name => name.endsWith('.js'));
        let splitChunks = chunks.filter(name => name.includes('route_split-me'));
        assert.equal(splitChunks.length, 1, `one split-me chunk in ${chunks.join(', ')}`);
        if (splitChunks.length !== 1) {
          return;
        }

        let splitSource = readFileSync(join(assetsDir, splitChunks[0]), 'utf8');
        for (let name of [
          'routes/split-me',
          'templates/split-me',
          'templates/split-me/index',
          'templates/split-me/child',
        ]) {
          assert.true(splitSource.includes(`"app-template-minimal/${name}"`), `split-me chunk has ${name}`);
        }

        let otherSources = chunks
          .filter(name => !splitChunks.includes(name))
          .map(name => readFileSync(join(assetsDir, name), 'utf8'))
          .join('\n');
        assert.true(otherSources.includes('"app-template-minimal/routes/about"'), 'about is in the initial bundle');
        assert.false(
          otherSources.includes('"app-template-minimal/routes/split-me"'),
          'split-me is not in the initial bundle'
        );
      });

      test(`loads split-me lazily and skips static-dir at runtime`, async function (assert) {
        let result = await app.execute('pnpm dist:ember:test');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
