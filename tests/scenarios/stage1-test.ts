import resolve from 'resolve';
import { join } from 'path';
import merge from 'lodash/merge';
import fs from 'fs-extra';
import { loadFromFixtureData } from './helpers';
import { dummyAppScenarios, baseAddon, appScenarios } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;

appScenarios
  .only('release')
  .map('stage-1', project => {
    let addon = baseAddon();

    merge(addon.files, loadFromFixtureData('hello-world-addon'));
    addon.pkg.name = 'my-addon';

    addon.linkDependency('@embroider/sample-transforms', { baseDir: __dirname });
    addon.linkDependency('@embroider/macros', { baseDir: __dirname });
    project.addDependency(addon);

    // our app will include an in-repo addon
    project.pkg['ember-addon'] = { paths: ['lib/in-repo-addon'] };
    merge(project.files, loadFromFixtureData('basic-in-repo-addon'));
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name} max compatibility`, function (hooks) {
      let app: PreparedApp;
      let workspaceDir: string;

      hooks.before(async () => {
        process.env.THROW_UNLESS_PARALLELIZABLE = '1'; // see https://github.com/embroider-build/embroider/pull/924
        app = await scenario.prepare();
        await app.execute('cross-env STAGE1_ONLY=true node ./node_modules/ember-cli/bin/ember b');
        workspaceDir = fs.readFileSync(join(app.dir, 'dist', '.stage1-output'), 'utf8');
      });

      hooks.after(async () => {
        delete process.env.THROW_UNLESS_PARALLELIZABLE;
      });

      test('component in app tree', function (assert) {
        assert.ok(fs.existsSync(join(workspaceDir, 'node_modules/my-addon/_app_/components/hello-world.js')));
      });

      test('addon metadata', function (assert) {
        let assertMeta = fs.readJsonSync(join(workspaceDir, 'node_modules/my-addon/package.json'))['ember-addon'];
        assert.deepEqual(assertMeta['app-js'], { './components/hello-world.js': './_app_/components/hello-world.js' });
        assert.ok(
          JSON.stringify(assertMeta['implicit-modules']).includes('./components/hello-world'),
          'staticAddonTrees is off so we should include the component implicitly'
        );
        assert.ok(
          JSON.stringify(assertMeta['implicit-modules']).includes('./templates/components/hello-world.hbs'),
          'staticAddonTrees is off so we should include the template implicitly'
        );

        assert.equal(assertMeta.version, 2);
      });

      test('component in addon tree', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'node_modules/my-addon/components/hello-world.js'));

        assert.ok(fileContents.includes('getOwnConfig()'), 'JS macros have not run yet');
        assert.ok(fileContents.includes('embroider-sample-transforms-result'), 'custom babel plugins have run');
      });

      test('component template in addon tree', function (assert) {
        let fileContents = fs.readFileSync(
          join(workspaceDir, 'node_modules/my-addon/templates/components/hello-world.hbs')
        );
        assert.ok(
          fileContents.includes('<div class={{embroider-sample-transforms-result}}>hello world</div>'),
          'template is still hbs and custom transforms have run'
        );
        assert.ok(
          fileContents.includes('<span>{{macroDependencySatisfies "ember-source" ">3"}}</span>'),
          'template macros have not run'
        );
      });

      test('test module name added', function (assert) {
        let fileContents = fs.readFileSync(
          join(workspaceDir, 'node_modules/my-addon/templates/components/module-name.hbs')
        );
        let searchRegExp = /\\/gi;
        let replaceWith = '\\\\';
        assert.ok(
          fileContents.includes(
            `<div class={{embroider-sample-transforms-module "${join(
              'my-addon',
              'templates',
              'components',
              'module-name.hbs'
            ).replace(searchRegExp, replaceWith)}"}}>hello world</div>`
          ),
          'template is still hbs and module name transforms have run'
        );
      });

      test('component with inline template', function (assert) {
        let fileContents = fs.readFileSync(
          join(workspaceDir, 'node_modules/my-addon/components/has-inline-template.js')
        );
        assert.ok(
          fileContents.includes('hbs`<div class={{embroider-sample-transforms-result}}>Inline</div>'),
          'tagged template is still hbs and custom transforms have run'
        );
        assert.ok(
          /hbs\(["']<div class={{embroider-sample-transforms-result}}>Extra<\/div>["']\)/.test(fileContents.toString()),
          'called template is still hbs and custom transforms have run'
        );
        assert.ok(
          /<span>{{macroDependencySatisfies ['"]ember-source['"] ['"]>3['"]}}<\/span>/.test(fileContents.toString()),
          'template macros have not run'
        );
      });

      test('in-repo-addon is available', function (assert) {
        assert.ok(resolve.sync('in-repo-addon/helpers/helper-from-in-repo-addon', { basedir: workspaceDir }));
      });

      test('dynamic import is preserved', function (assert) {
        let fileContents = fs.readFileSync(
          join(workspaceDir, 'node_modules/my-addon/components/does-dynamic-import.js')
        );
        assert.ok(/return import\(['"]some-library['"]\)/.test(fileContents.toString()));
      });
    });
  });

appScenarios
  .only('release')
  .map('stage-1-inline-hbs', project => {
    let addon = baseAddon();

    merge(addon.files, {
      addon: {
        components: {
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
    addon.linkDependency('ember-cli-htmlbars-inline-precompile', { baseDir: __dirname });
    addon.linkDependency('ember-cli-htmlbars-3', { baseDir: __dirname, resolveName: 'ember-cli-htmlbars' });
    project.addDependency(addon);
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name} inline hbs, ember-cli-htmlbars@3`, function (hooks) {
      let app: PreparedApp;
      let workspaceDir: string;

      hooks.before(async () => {
        app = await scenario.prepare();
        await app.execute('cross-env STAGE1_ONLY=true node ./node_modules/ember-cli/bin/ember b');
        workspaceDir = fs.readFileSync(join(app.dir, 'dist', '.stage1-output'), 'utf8');
      });

      test('component with inline template', function (assert) {
        let fileContents = fs.readFileSync(
          join(workspaceDir, 'node_modules/my-addon/components/has-inline-template.js')
        );
        assert.ok(
          fileContents.includes('hbs`<div class={{embroider-sample-transforms-result}}>Inline</div>'),
          'tagged template is still hbs and custom transforms have run'
        );
        assert.ok(
          /hbs\(["']<div class={{embroider-sample-transforms-result}}>Extra<\/div>["']\)/.test(fileContents.toString()),
          'called template is still hbs and custom transforms have run'
        );
        assert.ok(
          /<span>{{macroDependencySatisfies ['"]ember-source['"] ['"]>3['"]}}<\/span>/.test(fileContents.toString()),
          'template macros have not run'
        );
      });
    });
  });

appScenarios
  .only('release')
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

    project.pkg['ember-addon'] = { paths: ['lib/disabled-in-repo-addon', 'lib/blacklisted-in-repo-addon'] };
    merge(project.files, loadFromFixtureData('blacklisted-addon-build-options'));
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name} problematic addon zoo`, function (hooks) {
      let app: PreparedApp;
      let workspaceDir: string;

      hooks.before(async () => {
        app = await scenario.prepare();
        await app.execute('cross-env STAGE1_ONLY=true node ./node_modules/ember-cli/bin/ember b');
        workspaceDir = fs.readFileSync(join(app.dir, 'dist', '.stage1-output'), 'utf8');
      });

      test('real package.json wins', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'node_modules/alpha/package.json'));
        assert.ok(fileContents.includes('alpha'));
      });

      test('custom tree hooks are detected in addons that manually extend from Addon', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'node_modules/has-custom-base/file.js'));
        assert.ok(/weird-addon-path\/file\.js/.test(fileContents.toString()));
      });

      test('no fastboot-js is emitted', function (assert) {
        let fileContents = fs.readJsonSync(join(workspaceDir, 'node_modules/undefined-fastboot/package.json'));
        assert.equal(fileContents['ember-addon']['fastboot-js'], null);
      });

      test('custom tree hooks are detected when they have been patched into the addon instance', function (assert) {
        assert.ok(fs.existsSync(join(workspaceDir, 'node_modules/externally-customized/public/hello/world.js')));
      });

      test('addon with customized ember-addon.main can still use stock trees', function (assert) {
        let fileContents = fs.readFileSync(join(workspaceDir, 'node_modules/moved-main/helpers/hello.js'));
        assert.ok(/hello-world/.test(fileContents.toString()));
      });

      test('addon with customized treeFor can suppress a stock tree', function (assert) {
        assert.notOk(fs.existsSync(join(workspaceDir, 'node_modules/suppressed/_app_/app-example.js')));
      });

      test('addon with customized treeFor can pass through a stock tree', function (assert) {
        assert.ok(fs.existsSync(join(workspaceDir, 'node_modules/suppressed/addon-example.js')));
      });

      test('addon with customized treeFor can suppress a customized tree', function (assert) {
        assert.notOk(fs.existsSync(join(workspaceDir, 'node_modules/suppressed-custom/_app_/app-example.js')));
      });

      test('addon with customized treeFor can pass through a customized tree', function (assert) {
        assert.ok(fs.existsSync(join(workspaceDir, 'node_modules/suppressed-custom/addon-example.js')));
      });

      test('blacklisted in-repo addon is present but empty', function (assert) {
        assert.ok(fs.existsSync(join(workspaceDir, 'lib/blacklisted-in-repo-addon/package.json')));
        assert.notOk(fs.existsSync(join(workspaceDir, 'lib/blacklisted-in-repo-addon/example.js')));
      });

      test('disabled in-repo addon is present but empty', function (assert) {
        assert.ok(fs.existsSync(join(workspaceDir, 'lib/disabled-in-repo-addon/package.json')));
        assert.notOk(fs.existsSync(join(workspaceDir, 'lib/disabled-in-repo-addon/example.js')));
      });
    });
  });

dummyAppScenarios
  .map('stage-1-dummy-addon', project => {
    project.pkg.name = 'my-addon';

    project.linkDependency('@embroider/webpack', { baseDir: __dirname });
    project.linkDependency('@embroider/core', { baseDir: __dirname });
    project.linkDependency('@embroider/compat', { baseDir: __dirname });

    merge(project.files, {
      addon: {
        components: {
          'hello-world.js': '',
        },
      },
    });
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name} addon dummy app`, function (hooks) {
      let app: PreparedApp;
      let workspaceDir: string;

      hooks.before(async () => {
        app = await scenario.prepare();
        await app.execute('cross-env STAGE1_ONLY=true node ./node_modules/ember-cli/bin/ember b');
        workspaceDir = fs.readFileSync(join(app.dir, 'dist', '.stage1-output'), 'utf8');
      });

      test('dummy app can resolve own addon', function (assert) {
        assert.ok(resolve.sync('my-addon/components/hello-world.js', { basedir: workspaceDir }));
      });
    });
  });
