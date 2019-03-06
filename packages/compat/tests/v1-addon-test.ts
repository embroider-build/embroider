import {
  emberBuild,
  emberProject,
  addAddon
} from './helpers';
import 'qunit';
import { emberApp } from '@embroider/test-support';
import CompatAddons from '../src/compat-addons';
import { Builder } from 'broccoli-builder';

const { test } = QUnit;

QUnit.module('v1-addon', function() {
  test('full app build', function(assert) {
    let app = emberProject({
      workspaceDir: '/tmp/x'
    });
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
    emberBuild(app.baseDir, { STAGE1_ONLY: 'true' });
    assert.ok(true);
  });

  test('direct build', async function(assert) {
    let app = emberProject({
      workspaceDir: '/tmp/x'
    });
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

    let builder = new Builder(compat.tree);
    let buildPromise = builder.build();
    let { outputPath } = await compat.ready();
    assert.ok(outputPath);
    await buildPromise;
    await builder.cleanup();
  });
});
