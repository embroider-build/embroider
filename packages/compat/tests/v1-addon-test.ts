import {
  emberProject,
  addAddon
} from './helpers';
import 'qunit';
import { emberApp } from '@embroider/test-support';
import CompatAddons from '../src/compat-addons';
import { Builder } from 'broccoli-builder';
import { installFileAssertions } from './file-assertions';

QUnit.module('v1-addon', function() {
  QUnit.module('max compatibility', function(origHooks) {

    let { hooks, test } = installFileAssertions(origHooks);
    let builder: Builder;

    hooks.before(async function(assert) {
      // A simple ember app with no tests
      let app = emberProject();

      // We create a simple addon with one component.
      let addon = addAddon(app, 'my-addon');
      addon.files.addon = {
        components: {
          'hello-world.js': `
            import Component from '@ember/component';
            import layout from '../templates/components/hello-world';
            export default Component.extend({
              layout
            });
          `
        },
        templates: {
          components: {
            'hello-world.hbs': '<div data-test-example>hello world</div>'
          }
        }
      };
      addon.files.app = {
        components: {
          'hello-world.js': `export { default } from 'my-addon/components/hello-world'`
        }
      };

      // Our addon will use ember-test-selectors as an example of a custom AST
      // transform.
      addon.linkPackage('ember-test-selectors');

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
      assert.setBasePath((await compat.ready()).outputPath);
      await builderPromise;
    });

    hooks.after(async function() {
      await builder.cleanup();
    });

    test('component in app tree', function(assert) {
      assert.fileExists('node_modules/my-addon/_app_/components/hello-world.js');
      assert.fileJSON('node_modules/my-addon/package.json', '_app_', 'ember-addon.app-js', 'should have app-js metadata');
    });

    test('detects externals', function(assert) {
      assert.fileJSON('node_modules/my-addon/package.json', ['@ember/component'], 'ember-addon.externals', 'should detect external modules');
    });

    test('implicity include all addon js', function(assert) {
      assert.fileJSON('node_modules/my-addon/package.json', ['./components/hello-world'], 'ember-addon.implicit-modules', 'staticAddonTrees is off so we should include the component implicitly');
    });

    test('component in addon tree', function(assert) {
      assert.fileMatches(
        'node_modules/my-addon/components/hello-world.js',
        `import layout from '../templates/components/hello-world.hbs'`,
        `template imports have explicit .hbs extension added`
        );
    });

    test('component template in addon tree', function(assert) {
      assert.fileMatches('node_modules/my-addon/templates/components/hello-world.hbs', '<div>hello world</div>', 'template is still hbs and custom transforms have run');
    });
  });

});
