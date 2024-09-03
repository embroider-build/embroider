import type { PreparedApp } from 'scenario-tester';
import { appScenarios, baseAddon } from './scenarios';
import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectRewrittenFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;

// skipping this entire test suite. As of inversion-of-control, we don't have
// support for custom JS preprocessors applied to app code. We may choose to
// reimplement in the future.
appScenarios
  .only('canary') // scenario-tester doesn't have a "skip('*')", but this achieves the same thing
  .skip('canary')
  .map('compat-preprocessors', app => {
    function makePreprocessor() {
      let addonPreprocessor = baseAddon();
      addonPreprocessor.pkg.name = 'my-preprocessor';
      addonPreprocessor.linkDependency('broccoli-stew', { baseDir: __dirname });
      merge(addonPreprocessor.files, {
        'index.js': `
      const { map } = require('broccoli-stew');

      module.exports = {
        name: require('./package').name,

        setupPreprocessorRegistry(type, registry) {
          if (type !== 'parent') {
            return;
          }

          registry.add('js', {
            name: 'special-path-processor',
            toTree(tree, inputPath) {
              if (inputPath !== '/') {
                return tree;
              }

              let augmented = map(
                tree,
                '**/*.{js,css}',
                function (content, relativePath) {
                  return \`/*path@\${relativePath}*/\n\${content}\`;
                }
              );
              return augmented;
            },
          });
        }
      };
      `,
      });
      return addonPreprocessor;
    }
    app.addDevDependency(makePreprocessor());
    merge(app.files, {
      config: {
        'targets.js': `module.exports = { browsers: ['last 1 Chrome versions'] }`,
      },
      app: {
        components: {
          'from-the-app.js': `
            import Component from '@glimmer/component';
            export default class extends Component {}
          `,
          'from-the-app.hbs': `<div>{{this.title}}</div><Greeting/>`,
        },
      },
    });

    let addon = baseAddon();
    addon.pkg.name = 'my-addon';
    addon.addDependency(makePreprocessor());
    merge(addon.files, {
      app: {
        components: {
          'greeting.js': `export { default } from 'my-addon/components/greeting';`,
        },
      },
      addon: {
        components: {
          'greeting.js': `
            import Component from '@glimmer/component';
            export default class extends Component {}
          `,
          'greeting.hbs': `Hello World`,
        },
      },
    });
    app.addDevDependency(addon);
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let expectFile: ExpectFile;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { EMBROIDER_PREBUILD: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      hooks.beforeEach(assert => {
        expectFile = expectRewrittenFilesAt(app.dir, { qunit: assert });
      });

      test('dependencies are setup for this test suite correctly', () => {
        expectFile('./package.json').exists();
        expectFile('./package.json').matches(/my-preprocessor/, 'has the preprocessor dependency');
        expectFile('./node_modules/my-addon/package.json').exists();
        expectFile('./node_modules/my-addon/package.json').matches(
          /my-preprocessor/,
          'has the preprocessor dependency'
        );
        expectFile('./node_modules/my-preprocessor/package.json').exists();
      });

      test('app has correct path embedded in comment', () => {
        const assertFile = expectFile('./app/components/from-the-app.js');
        assertFile.exists();
        // This is the expected output during an classic build.
        assertFile.matches(
          /path@app-template\/app\/components\/from-the-app\.js/,
          'has a path comment in app components'
        );
      });

      test('addon has correct path embedded in comment', () => {
        expectFile('./node_modules/my-preprocessor/package.json').exists();
        const assertFile = expectFile('./node_modules/my-addon/components/greeting.js');
        assertFile.matches(/path@my-addon\/components\/greeting\.js/, 'has a path comment in app components');
      });
    });
  });
