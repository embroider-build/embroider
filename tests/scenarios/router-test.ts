import { tsAppScenarios, tsAppClassicScenarios } from './scenarios';
import type { PreparedApp, Project } from 'scenario-tester';
import QUnit from 'qunit';

const { module: Qmodule, test } = QUnit;

function setupScenario(project: Project) {
  project.linkDevDependency('@embroider/router', { baseDir: __dirname });

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

tsAppScenarios
  .map('router-embroider', project => {
    setupScenario(project);
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
