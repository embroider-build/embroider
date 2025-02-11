import merge from 'lodash/merge';
import { loadFromFixtureData } from './helpers';
import { baseAddon, appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectRewrittenFilesAt } from '@embroider/test-support/file-assertions/qunit';

const { module: Qmodule, test } = QUnit;

appScenarios
  .only('canary')
  .map('stage-1-max-compat', project => {
    let addon = baseAddon();

    merge(project.files, {
      'ember-cli-build.js': `
        'use strict';

        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { maybeEmbroider } = require('@embroider/test-setup');

        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {
          });

          return maybeEmbroider(app, {
            staticAddonTestSupportTrees: false,
            staticAddonTrees: false,
            staticComponents: false,
            staticHelpers: false,
            staticModifiers: false,
          });
        };
      `,
    });

    merge(addon.files, loadFromFixtureData('hello-world-addon'));
    addon.pkg.name = 'my-addon';

    addon.linkDependency('@embroider/sample-transforms', { baseDir: __dirname });
    addon.linkDependency('@embroider/macros', { baseDir: __dirname });
    project.addDependency(addon);

    // our app will include an in-repo addon
    project.pkg['ember-addon'] = { paths: ['lib/in-repo-addon'] };
    merge(project.files, loadFromFixtureData('basic-in-repo-addon'));

    let addonWithGTS = baseAddon();
    addonWithGTS.pkg.name = 'addon-with-gts';
    addonWithGTS.linkDependency('ember-template-imports', { baseDir: __dirname });
    addonWithGTS.linkDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-latest' });
    addonWithGTS.mergeFiles({
      'index.js': `
        'use strict';
        module.exports = {
          name: require('./package').name,
          options: {
            'ember-cli-babel': { enableTypeScriptTransform: true },
          },
        };`,
      addon: {
        components: {
          'other.gts': `
          import Component from '@glimmer/component';

          export default class extends Component {
            abc: string;
            <template>
              other
            </template>
          };
          `,
          'gts-component.gts': `
          import Component from '@glimmer/component';
          import OtherComponent from './other';

          export default class extends Component {
            get abc(): string {
              return 'abs';
            }
            <template>
              this is gts
              with <OtherComponent />
            </template>
          };
          `,
        },
      },
      app: {
        components: {
          'gts-component.js': 'export { default } from "addon-with-gts/components/gts-component"',
        },
      },
    });
    project.addDependency(addonWithGTS);
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name}`, function (hooks) {
      let app: PreparedApp;
      let expectFile: ExpectFile;

      hooks.before(async assert => {
        process.env.THROW_UNLESS_PARALLELIZABLE = '1'; // see https://github.com/embroider-build/embroider/pull/924
        app = await scenario.prepare();
        let result = await app.execute('node ./node_modules/ember-cli/bin/ember b', {
          env: {
            STAGE1_ONLY: 'true',
            EMBROIDER_PREBUILD: 'true',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });

      hooks.after(async () => {
        delete process.env.THROW_UNLESS_PARALLELIZABLE;
      });

      hooks.beforeEach(assert => {
        expectFile = expectRewrittenFilesAt(app.dir, { qunit: assert });
      });

      test('component in app tree', function () {
        expectFile('node_modules/my-addon/_app_/components/hello-world.js').exists();
      });

      test('addon metadata', function () {
        let myAddonPkg = expectFile('node_modules/my-addon/package.json').json();
        myAddonPkg
          .get('ember-addon.app-js')
          .deepEquals({ './components/hello-world.js': './_app_/components/hello-world.js' });

        myAddonPkg
          .get('ember-addon.implicit-modules')
          .includes(
            './components/hello-world',
            'staticAddonTrees is off so we should include the component implicitly'
          );

        myAddonPkg
          .get('ember-addon.implicit-modules')
          .includes(
            './templates/components/hello-world.hbs',
            'staticAddonTrees is off so we should include the template implicitly'
          );

        myAddonPkg.get('ember-addon.version').deepEquals(2);
      });

      test('component in addon tree', function () {
        expectFile('node_modules/my-addon/components/hello-world.js').matches(
          'getOwnConfig()',
          'JS macros have not run yet'
        );

        expectFile('node_modules/my-addon/components/hello-world.js').matches(
          'embroider-sample-transforms-result',
          'custom babel plugins have run'
        );
      });

      test('component template in addon tree', function () {
        let fileContents = expectFile('node_modules/my-addon/templates/components/hello-world.hbs.js');

        fileContents.matches(
          '<div class={{embroider-sample-transforms-result}}>hello world</div>',
          'template is still hbs and custom transforms have run'
        );

        fileContents.matches(
          '<span>{{macroDependencySatisfies \\"ember-source\\" \\">3\\"}}</span>',
          'template macros have not run'
        );
      });

      test('test module name added', function () {
        let fileContents = expectFile('node_modules/my-addon/templates/components/module-name.hbs.js');
        let expected = `<div class={{embroider-sample-transforms-module \\"my-addon/templates/components/module-name.hbs\\"}}>hello world</div>`;
        fileContents.matches(expected, 'template is still hbs and module name transforms have run');
      });

      test('component with inline template', function () {
        let fileContents = expectFile('node_modules/my-addon/components/has-inline-template.js');

        fileContents.matches(
          'hbs`<div class={{embroider-sample-transforms-result}}>Inline</div>',
          'tagged template is still hbs and custom transforms have run'
        );

        fileContents.matches(
          /hbs\(["']<div class={{embroider-sample-transforms-result}}>Extra<\/div>["']\)/,
          'called template is still hbs and custom transforms have run'
        );

        fileContents.matches(
          /<span>{{macroDependencySatisfies ['"]ember-source['"] ['"]>3['"]}}<\/span>/,
          'template macros have not run'
        );
      });

      test('dynamic import is preserved', function () {
        expectFile('node_modules/my-addon/components/does-dynamic-import.js').matches(
          /return import\(['"]some-library['"]\)/
        );
      });

      test('gts in addons has valid imports', function () {
        expectFile('node_modules/addon-with-gts/components/gts-component.js').equalsCode(`
          import Component from '@glimmer/component';
          import OtherComponent from './other';
          import { precompileTemplate } from "@ember/template-compilation";
          import { setComponentTemplate } from "@ember/component";
          export default class _Class extends Component {
            get abc() {
              return 'abs';
            }
          }
          setComponentTemplate(precompileTemplate("\\n              this is gts\\n              with <OtherComponent />\\n            ", {
            strictMode: true,
            scope: () => ({
              OtherComponent
            })
          }), _Class);
        `);
      });
    });
  });

appScenarios
  .only('canary')
  .map('stage-1-inline-hbs', project => {
    let addon = baseAddon();

    merge(addon.files, {
      addon: {
        components: {
          'template-only.hbs': `<div data-test="template-only"></div>`,
          'colocated.js': `
            import Component from '@glimmer/component';
            export default class extends Component {
              identifier = "i-am-colocated";
            }
          `,
          'colocated.hbs': `<div data-test={{this.identifier}}></div>`,
          'has-inline-template.js': `
            import Component from '@ember/component';
            import hbs from 'htmlbars-inline-precompile';
            export default Component.extend({
              // tagged template form:
              layout: ${"hbs`<div class={{embroider-sample-transforms-target}}>Inline</div><span>{{macroDependencySatisfies 'ember-source' '>3'}}</span>`"},
              // call expression form:
              extra: hbs("<div class={{embroider-sample-transforms-target}}>Extra</div>")
            });
          `,
        },
      },
    });
    addon.pkg.name = 'my-addon';

    addon.linkDependency('@embroider/sample-transforms', { baseDir: __dirname });
    addon.linkDependency('@embroider/macros', { baseDir: __dirname });
    project.addDependency(addon);
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name}`, function (hooks) {
      let app: PreparedApp;
      let expectFile: ExpectFile;

      hooks.before(async () => {
        app = await scenario.prepare();
        await app.execute('node ./node_modules/ember-cli/bin/ember b', {
          env: {
            STAGE1_ONLY: 'true',
            EMBROIDER_PREBUILD: 'true',
          },
        });
      });

      hooks.beforeEach(assert => {
        expectFile = expectRewrittenFilesAt(app.dir, { qunit: assert });
      });

      test('component with inline template', function () {
        let file = expectFile('node_modules/my-addon/components/has-inline-template.js');

        file.matches(
          'hbs`<div class={{embroider-sample-transforms-result}}>Inline</div>',
          'tagged template is still hbs and custom transforms have run'
        );

        file.matches(
          /hbs\(["']<div class={{embroider-sample-transforms-result}}>Extra<\/div>["']\)/,
          'called template is still hbs and custom transforms have run'
        );

        file.matches(
          /<span>{{macroDependencySatisfies ['"]ember-source['"] ['"]>3['"]}}<\/span>/,
          'template macros have not run'
        );
      });

      test('component with colocated template', function () {
        // co-located pairs are left alone in stage1 because we deal with them
        // in stage3
        expectFile('node_modules/my-addon/components/colocated.js').matches('i-am-colocated');
        expectFile('node_modules/my-addon/components/colocated.hbs.js').exists();
      });

      test('template-only component', function () {
        expectFile('node_modules/my-addon/components/template-only.js').matches(
          'export default templateOnlyComponent()'
        );
        expectFile('node_modules/my-addon/components/template-only.hbs.js').matches(
          'export default precompileTemplate'
        );
      });
    });
  });

appScenarios
  .only('canary')
  .map('stage-1-problematic-addon-zoo', project => {
    let addon = baseAddon();

    // an addon that emits a package.json file from its treeForAddon
    merge(addon.files, {
      index: `module.exports = {
        name: require('./package').name,
        treeForAddon() {
          return require('path').join(__dirname, 'alpha-addon-tree');
        }
      };`,
      'alpha-addon-tree': {
        'package.json': '{}',
      },
    });

    addon.pkg.name = 'alpha';

    let hasCustomBase = baseAddon();

    // an addon that manually extends the Addon base class
    merge(hasCustomBase.files, {
      'index.js': `
        const { join } = require('path');
        const Addon = require('ember-cli/lib/models/addon');
        module.exports = Addon.extend({
          name: 'has-custom-base',
          treeForAddon() {
            return join(__dirname, 'weird-addon-path');
          }
        });`,
      'weird-addon-path': {
        'has-custom-base': {
          'file.js': '// weird-addon-path/file.js',
        },
      },
    });

    hasCustomBase.pkg.name = 'has-custom-base';

    let undefinedFastboot = baseAddon();

    // an addon that nullifies its custom fastboot tree with a custom fastboot hook
    merge(undefinedFastboot.files, {
      'index.js': `module.exports = {
        name: 'undefined-fastboot',
        treeForFastBoot() {}
      }`,
      fastboot: {
        'something.js': '',
      },
    });

    undefinedFastboot.pkg.name = 'undefined-fastboot';

    // An addon that never extends ember-cli's Addon base class. Mostly this is
    // here to make sure nothing blows up when it is present. We don't actually
    // try to do anything with the custom code in index.js.
    let weirdBase = baseAddon();
    merge(weirdBase.files, {
      'index.js': `
      module.exports = class {

      }
      `,
    });
    weirdBase.pkg.name = 'weird-base';

    // Use one addon to patch the hook on another (yes, this happens in the
    // wild...), and ensure we still detect the customized hook
    let externallyCustomized = baseAddon();
    let troubleMaker = baseAddon();
    merge(troubleMaker.files, {
      injected: {
        hello: { 'world.js': '// hello' },
      },
      'index.js': `
        const { join } = require('path');
        module.exports = {
        name: 'trouble-maker',
        included() {
          let instance = this.project.addons.find(a => a.name === "externally-customized");
          let root = this.root;
          instance.treeForPublic = function() {
            return join(root, 'injected');
          }
        }
      }`,
    });

    externallyCustomized.pkg.name = 'externally-customized';
    troubleMaker.pkg.name = 'trouble-maker';

    // an addon that customizes a tree by mutating treeForMethods
    let patchesMethodName = baseAddon();
    merge(patchesMethodName.files, {
      injected: {
        hello: { 'world.js': '// hello' },
      },
      'index.js': `
        const { join } = require('path');
        module.exports = {
        name: 'patches-method-name',
        included() {
          this.treeForMethods['addon'] = 'notTheUsual';
        },
        notTheUsual() {
          return join(this.root, 'injected');
        }
      }`,
    });
    patchesMethodName.pkg.name = 'patches-method-name';

    // an addon that customizes packageJSON['ember-addon'].main and then uses
    // stock trees. Setting the main actually changes the root for *all* stock
    // trees.
    let movedMain = baseAddon();
    merge(movedMain.files, {
      custom: {
        'index.js': `module.exports = { name: 'moved-main'};`,
        addon: { helpers: { 'hello.js': '// hello-world' } },
      },
    });
    merge(movedMain.pkg, { 'ember-addon': { main: 'custom/index.js' }, name: 'moved-main' });

    // an addon that uses treeFor() to sometimes suppress its stock trees
    let suppressed = baseAddon();
    merge(suppressed.files, {
      'index.js': `module.exports = {
        name: require('./package').name,
        treeFor(name) {
          if (name !== 'app') {
            return this._super.treeFor(name);
          } else {
            return undefined;
          }
        }
      }`,
      addon: {
        'addon-example.js': '// example',
      },
      app: {
        'app-example.js': '// example',
      },
    });

    suppressed.pkg.name = 'suppressed';

    // an addon that uses treeFor() to sometimes suppress its custom trees
    let suppressedCustom = baseAddon();
    merge(suppressedCustom.files, {
      'index.js': `module.exports = {
        name: require('./package').name,
        treeFor(name) {
          if (name !== 'app') {
            return this._super(name);
          } else {
            return undefined;
          }
        },
        treeForApp() {
          return require('path').join(__dirname, 'app-custom');
        },
        treeForAddon() {
          return require('path').join(__dirname, 'addon-custom');
        },
      }`,
      'addon-custom': {
        'suppressed-custom': {
          'addon-example.js': '// example',
        },
      },
      'app-custom': {
        'app-example.js': '// example',
      },
    });

    suppressedCustom.pkg.name = 'suppressed-custom';

    project.addDependency(addon);
    project.addDependency(hasCustomBase);
    project.addDependency(undefinedFastboot);
    project.addDependency(externallyCustomized);
    project.addDependency(troubleMaker);
    project.addDependency(movedMain);
    project.addDependency(suppressed);
    project.addDependency(suppressedCustom);
    project.addDependency(patchesMethodName);
    project.addDependency(weirdBase);

    project.pkg['ember-addon'] = { paths: ['lib/disabled-in-repo-addon', 'lib/blacklisted-in-repo-addon'] };
    merge(project.files, loadFromFixtureData('blacklisted-addon-build-options'));
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name}`, function (hooks) {
      let app: PreparedApp;
      let expectFile: ExpectFile;

      hooks.before(async () => {
        app = await scenario.prepare();
        await app.execute('node ./node_modules/ember-cli/bin/ember b', {
          env: {
            STAGE1_ONLY: 'true',
            EMBROIDER_PREBUILD: 'true',
          },
        });
      });

      hooks.beforeEach(assert => {
        expectFile = expectRewrittenFilesAt(app.dir, { qunit: assert });
      });

      test('real package.json wins', function () {
        expectFile('node_modules/alpha/package.json').matches('alpha');
      });

      test('custom tree hooks are detected in addons that manually extend from Addon', function () {
        expectFile('node_modules/has-custom-base/file.js').matches(/weird-addon-path\/file\.js/);
      });

      test('no fastboot-js is emitted', function () {
        expectFile('node_modules/undefined-fastboot/package.json').json().get('ember-addon.fastboot-js').equals(null);
      });

      test('custom tree hooks are detected when they have been patched into the addon instance', function () {
        expectFile('node_modules/externally-customized/public/hello/world.js').exists();
      });

      test('custom tree hooks are detected when they have been customized via treeForMethod names', function () {
        expectFile('node_modules/patches-method-name/hello/world.js').exists();
      });

      test('addon with customized ember-addon.main can still use stock trees', function () {
        expectFile('node_modules/moved-main/helpers/hello.js').matches(/hello-world/);
      });

      test('addon with customized treeFor can suppress a stock tree', function () {
        expectFile('node_modules/suppressed/_app_/app-example.js').doesNotExist();
      });

      test('addon with customized treeFor can pass through a stock tree', function () {
        expectFile('node_modules/suppressed/addon-example.js').exists();
      });

      test('addon with customized treeFor can suppress a customized tree', function () {
        expectFile('node_modules/suppressed-custom/_app_/app-example.js').doesNotExist();
      });

      test('addon with customized treeFor can pass through a customized tree', function () {
        expectFile('node_modules/suppressed-custom/addon-example.js').exists();
      });

      test('blacklisted in-repo addon is present but empty', function () {
        expectFile('lib/blacklisted-in-repo-addon/package.json').exists();
        expectFile('lib/blacklisted-in-repo-addon/example.js').doesNotExist();
      });

      test('disabled in-repo addon is present but empty', function () {
        expectFile('lib/disabled-in-repo-addon/package.json').exists();
        expectFile('lib/disabled-in-repo-addon/example.js').doesNotExist();
      });
    });
  });
