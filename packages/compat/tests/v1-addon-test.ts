import Project from 'fixturify-project';
import 'qunit';

const { test } = QUnit;

QUnit.module('v1-addon', function() {
  test('simple addon with one component', function(assert) {
    let app = new Project('my-app');
    app.files = {
      'ember-cli-build.js': `
        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        module.exports = function(defaults) {
          let app = new EmberApp(defaults, {
          });
          return app.toTree();
        }
      `
    };
    let addon = app.addDependency('my-addon');
    addon.files = {
      'index.js': `
      module.exports = {
        name: require('./package').name,
      };
      `,
      addon: {
        templates: {
          components: {
            'hello-world.hbs': '<div>Hello world</div>'
          }
        }
      }
    };
    addon.pkg.keywords = ['ember-addon'];
    app.writeSync();
    assert.ok(true);
  });
});
