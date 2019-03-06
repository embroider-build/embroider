import {
  emberBuild,
  emberProject,
  addAddon
} from './helpers';
import 'qunit';

const { test } = QUnit;

QUnit.module('v1-addon', function() {
  test('simple addon with one component', function(assert) {
    let app = emberProject({
      workspaceDir: '/tmp/x'
    });
    let addon = addAddon(app, 'my-addon');
    addon.files.addon = {
      templates: {
        components: {
          'hello-world.hbs': '<div>hello world</div>'
        }
      }
    };
    app.writeSync();
    emberBuild(app.baseDir, { STAGE1_ONLY: 'true' });
    assert.ok(true);
  });
});
