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
  QUnit.module('compatibility', function(origHooks) {

    let { hooks, test } = installFileAssertions(origHooks);
    let builder: Builder;

    hooks.before(async function(assert) {
      let app = emberProject();
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
            'hello-world.hbs': '<div>hello world</div>'
          }
        }
      };
      addon.files.app = {
        components: {
          'hello-world.js': `export { default } from 'my-addon/components/hello-world'`
        }
      };
      app.writeSync();
      let appInstance = emberApp(app.baseDir);
      let compat = new CompatAddons(appInstance);
      builder = new Builder(compat.tree);
      let buildPromise = builder.build();
      let compatReady = await compat.ready();
      await buildPromise;
      assert.setBasePath(compatReady.outputPath);
    });

    hooks.after(async function() {
      await builder.cleanup();
    });

    test('component in app tree', function(assert) {
      assert.fileExists('node_modules/my-addon/_app_/components/hello-world.js');
    });

    test('component in addon tree', function(assert) {
      assert.fileExists('node_modules/my-addon/components/hello-world.js');
    });

    test('component template in addon tree', function(assert) {
      assert.fileExists('node_modules/my-addon/templates/components/hello-world.hbs');
    });
  });

});
