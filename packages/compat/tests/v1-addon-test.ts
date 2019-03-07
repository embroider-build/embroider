import {
  emberProject,
  addAddon,
  Project
} from './helpers';
import 'qunit';
import { emberApp } from '@embroider/test-support';
import CompatAddons from '../src/compat-addons';
import { Builder } from 'broccoli-builder';
import { installFileAssertions } from './file-assertions';

QUnit.module('v1-addon', function() {
  QUnit.module('max compatibility', function(origHooks) {

    let { hooks, test, skip } = installFileAssertions(origHooks);
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
              'data-test-example': 'remove me',
              config: getOwnConfig(),
              layout
            });
          `
        },
        templates: {
          components: {
            'hello-world.hbs': `
              <div data-test-example>hello world</div>
              <span>{{macroDependencySatisfies "ember-source" ">3"}}</span>
            `
          }
        }
      };
      addon.files.app = {
        components: {
          'hello-world.js': `export { default } from 'my-addon/components/hello-world'`,
          'has-inline-template.js': `
            import Component from '@ember/component';
            import hbs from 'htmlbars-inline-precompile';
            export default Component.extend({
              layout: ${"hbs`<div data-test-example>Inline</div><span>{{macroDependencySatisfies 'ember-source' '>3'}}</span>`"}
            });
          `
        }
      };

      // Our addon will use ember-test-selectors as an example of a custom AST
      // transform.
      addon.linkPackage('ember-test-selectors');
      addon.linkPackage('ember-cli-htmlbars-inline-precompile');
      addon.linkPackage('@embroider/macros');

      app.writeSync();
      let compat = new CompatAddons(emberApp(app.baseDir, {
        // this is used by our addon, but ember-test-selectors always looks here
        // (in the app config) for options. In this case we're making sure it
        // always runs.
        'ember-test-selectors': {
          strip: true
        }
      }));
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
      assertMeta.get('app-js').deepEquals('_app_', 'should have app-js metadata');
      assertMeta.get('externals').deepEquals(['@ember/component', 'htmlbars-inline-precompile'], 'should detect external modules');
      assertMeta.get('implicit-modules').deepEquals(
        ['./components/hello-world'],
        'staticAddonTrees is off so we should include the component implicitly'
      );
    });

    test('component in addon tree', function(assert) {
      let assertFile = assert.file('node_modules/my-addon/components/hello-world.js');
      assertFile.matches(
        `import layout from '../templates/components/hello-world.hbs'`,
        `template imports have explicit .hbs extension added`
      );
      assertFile.matches(
        `getOwnConfig()`,
        `JS macros have not run yet`
      );
      assertFile.doesNotMatch(
        `data-test-example`,
        `custom babel plugins have run`
      );
    });

    test('component template in addon tree', function(assert) {
      let assertFile = assert.file('node_modules/my-addon/templates/components/hello-world.hbs');
      assertFile.matches(
        '<div>hello world</div>',
        'template is still hbs and custom transforms have run'
      );
      assertFile.matches(
        '<span>{{macroDependencySatisfies "ember-source" ">3"}}</span>',
        'template macros have not run'
      );
    });

    skip('component with inline template', function(assert) {
      let assertFile = assert.file('node_modules/my-addon/_app_/components/has-inline-template.js');
      assertFile.matches(
        'hbs`<div>Inline</div>',
        'template is still hbs and custom transforms have run'
      );
      assertFile.matches(
        "<span>{{macroDependencySatisfies 'ember-source' '>3'}}</span>",
        'template macros have not run'
      );
    });
  });

});
