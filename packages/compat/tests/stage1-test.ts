import { emberProject, addAddon, Project, addonProject } from './helpers';
import 'qunit';
import { emberApp, emberAddon } from '@embroider/test-support';
import CompatAddons from '../src/compat-addons';
import { Builder } from 'broccoli';
import { installFileAssertions } from './file-assertions';
import resolve from 'resolve';

QUnit.module('stage1 build', function() {
  QUnit.module('max compatibility', function(origHooks) {
    let { hooks, test } = installFileAssertions(origHooks);
    let builder: Builder;
    let app: Project;

    hooks.before(async function(assert) {
      // A simple ember app with no tests
      app = emberProject();

      // We create an addon
      let addon = addAddon(app, 'my-addon');
      addon.files.addon = {
        components: {
          'hello-world.js': `
            import Component from '@ember/component';
            import layout from '../templates/components/hello-world';
            import { getOwnConfig } from '@embroider/macros';
            export default Component.extend({
              message: 'embroider-sample-transforms-target',
              config: getOwnConfig(),
              layout
            });
          `,
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
          'has-relative-template.js': `
            import Component from '@ember/component';
            import layout from './t';
            export default Component.extend({
              layout
            });
          `,
          't.hbs': ``,
        },
        templates: {
          components: {
            'hello-world.hbs': `
              <div class={{embroider-sample-transforms-target}}>hello world</div>
              <span>{{macroDependencySatisfies "ember-source" ">3"}}</span>
            `,
          },
        },
      };
      addon.files.app = {
        components: {
          'hello-world.js': `export { default } from 'my-addon/components/hello-world'`,
        },
      };

      // Our addon will use @embroider/sample-transforms as examples of custom
      // AST and babel transforms.
      addon.linkPackage('@embroider/sample-transforms');
      addon.linkPackage('ember-cli-htmlbars-inline-precompile');
      addon.linkPackage('@embroider/macros');

      // our app will include an in-repo addon
      app.pkg['ember-addon'] = {
        paths: ['lib/in-repo-addon'],
      };
      app.files.lib = {
        'in-repo-addon': {
          'package.json': JSON.stringify(
            {
              name: 'in-repo-addon',
              keywords: ['ember-addon'],
            },
            null,
            2
          ),
          'index.js': `module.exports = { name: 'in-repo-addon' };`,
          addon: {
            helpers: {
              'helper-from-in-repo-addon.js': '',
            },
          },
        },
      };

      app.writeSync();
      let compat = new CompatAddons(emberApp(app.baseDir));
      builder = new Builder(compat.tree);
      let builderPromise = builder.build();
      assert.basePath = (await compat.ready()).outputPath;
      await builderPromise;
    });

    hooks.after(async function() {
      await app.dispose();
      await builder.cleanup();
    });

    test('component in app tree', function(assert) {
      assert.file('node_modules/my-addon/_app_/components/hello-world.js').exists();
    });

    test('addon metadata', function(assert) {
      let assertMeta = assert.file('node_modules/my-addon/package.json').json('ember-addon');
      assertMeta.get('app-js').equals('_app_', 'should have app-js metadata');
      assertMeta.get('externals').includes('@ember/component', 'should detect external modules');
      assertMeta
        .get('implicit-modules')
        .includes('./components/hello-world', 'staticAddonTrees is off so we should include the component implicitly');
      assertMeta
        .get('implicit-modules')
        .includes(
          './templates/components/hello-world.hbs',
          'staticAddonTrees is off so we should include the template implicitly'
        );
      assertMeta.get('version').equals(2);
    });

    test('component in addon tree', function(assert) {
      let assertFile = assert.file('node_modules/my-addon/components/hello-world.js');
      assertFile.matches(
        `import layout from '../templates/components/hello-world.hbs'`,
        `template imports have explicit .hbs extension added`
      );
      assertFile.matches(`getOwnConfig()`, `JS macros have not run yet`);
      assertFile.matches(`embroider-sample-transforms-result`, `custom babel plugins have run`);
    });

    test('component template in addon tree', function(assert) {
      let assertFile = assert.file('node_modules/my-addon/templates/components/hello-world.hbs');
      assertFile.matches(
        '<div class={{embroider-sample-transforms-result}}>hello world</div>',
        'template is still hbs and custom transforms have run'
      );
      assertFile.matches(
        '<span>{{macroDependencySatisfies "ember-source" ">3"}}</span>',
        'template macros have not run'
      );
    });

    test('component with inline template', function(assert) {
      let assertFile = assert.file('node_modules/my-addon/components/has-inline-template.js');
      assertFile.matches(
        'hbs`<div class={{embroider-sample-transforms-result}}>Inline</div>',
        'tagged template is still hbs and custom transforms have run'
      );
      assertFile.matches(
        /hbs\(["']<div class={{embroider-sample-transforms-result}}>Extra<\/div>["']\)/,
        'called template is still hbs and custom transforms have run'
      );
      assertFile.matches(
        /<span>{{macroDependencySatisfies ['"]ember-source['"] ['"]>3['"]}}<\/span>/,
        'template macros have not run'
      );
    });

    test.skip('component with relative import of arbitrarily placed template', function(assert) {
      let assertFile = assert.file('node_modules/my-addon/components/has-relative-template.js');
      assertFile.matches(`import layout from './t.hbs'`, 'arbitrary relative template gets hbs extension');
    });

    test('in-repo-addon is available', function(assert) {
      assert.expect(0);
      resolve.sync('in-repo-addon/helpers/helper-from-in-repo-addon', { basedir: assert.basePath });
    });
  });

  QUnit.module('addon dummy app', function(origHooks) {
    let { hooks, test } = installFileAssertions(origHooks);
    let builder: Builder;
    let app: Project;

    hooks.before(async function(assert) {
      app = addonProject();
      (app.files.addon as Project['files']).components = {
        'hello-world.js': '',
      };

      app.writeSync();
      let compat = new CompatAddons(emberAddon(app.baseDir));
      builder = new Builder(compat.tree);
      let builderPromise = builder.build();
      assert.basePath = (await compat.ready()).outputPath;
      await builderPromise;
    });

    hooks.after(async function() {
      await app.dispose();
      await builder.cleanup();
    });

    test('dummy app can resolve own addon', function(assert) {
      assert.expect(0);
      resolve.sync('my-addon/components/hello-world.js', { basedir: assert.basePath });
    });
  });
});
