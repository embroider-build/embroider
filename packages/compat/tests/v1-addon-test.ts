import {
  emberBuild,
  emberProject,
  addAddon
} from './helpers';
import 'qunit';

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
    emberBuild(app.baseDir, { STAGE1_ONLY: 'true' });
    assert.ok(true);
  });
});
