import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectFilesAt, expectRewrittenFilesAt } from '@embroider/test-support/file-assertions/qunit';
import type { PreparedApp, Project } from 'scenario-tester';
import { throwOnWarnings } from '@embroider/core';
import { appScenarios, baseAddon } from './scenarios';
import QUnit from 'qunit';
import { merge } from 'lodash';
const { module: Qmodule, test } = QUnit;

appScenarios
  .map('compat-addon-styles', project => {
    let addon1 = baseAddon();
    addon1.pkg.name = 'my-addon1';

    merge(addon1.files, {
      'index.js': `
        module.exports = {
          name: require('./package.json').name,
          treeForStyles() {
            const buildFunnel = require('broccoli-funnel');
            const path = require('path');
            let tree = buildFunnel(path.join(__dirname, 'node_modules/third-party1'), {
              destDir: '.'
            });
            return this._super.treeForStyles.call(this, tree);
          }
        }
      `,
    });

    addon1.addDependency('third-party1', '1.2.3').files = {
      'third-party1.css': '.error { color: red; }',
    };
    addon1.linkDependency('broccoli-funnel', { baseDir: __dirname });
    project.addDependency(addon1);

    let addon2 = baseAddon();
    addon2.pkg.name = 'my-addon2';

    merge(addon2.files, {
      'index.js': `
        module.exports = {
          name: require('./package.json').name,
          treeForStyles() {
            const buildFunnel = require('broccoli-funnel');
            const path = require('path');
            return buildFunnel(path.join(__dirname, 'node_modules/third-party2'), {
              destDir: '.'
            });
          }
        }
      `,
    });

    addon2.addDependency('third-party2', '1.2.3').files = {
      'third-party2.css': '.success { color: green }',
    };
    addon2.linkDependency('broccoli-funnel', { baseDir: __dirname });
    project.addDependency(addon2);

    let addon3 = baseAddon();
    addon3.pkg.name = 'my-addon3';
    merge(addon3.files, {
      addon: {
        styles: {
          'addon.css': `
        .from-addon {
          background-color: red;
        }
      `,
          'outer.css': `
        .from-outer {
          background-color: blue;
        }
      `,
          nested: {
            'inner.css': `
          .from-inner {
            background-color: green;
          }
        `,
          },
        },
      },
    });

    project.addDependency(addon3);
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;

      let expectFile: ExpectFile;
      let expectRewrittenFile: ExpectFile;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { STAGE1_ONLY: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(app.dir, { qunit: assert });
        expectRewrittenFile = expectRewrittenFilesAt(app.dir, { qunit: assert });
      });

      test('treeForStyles adds styles to build', function () {
        expectFile(
          './node_modules/.embroider/rewritten-packages/@embroider/synthesized-styles/assets/third-party1.css'
        ).matches('.error { color: red; }');
      });

      // prevent regression of https://github.com/embroider-build/embroider/issues/164
      test('treeForStyles not calling super adds styles to build', function () {
        expectFile(
          './node_modules/.embroider/rewritten-packages/@embroider/synthesized-styles/assets/third-party2.css'
        ).matches('.success { color: green }');
      });

      test(`all addon CSS gets convert to implicit-styles`, function () {
        let implicitStyles = expectRewrittenFile('./node_modules/my-addon3/package.json')
          .json()
          .get('ember-addon.implicit-styles');
        implicitStyles.includes('./my-addon3.css');
        implicitStyles.includes('./outer.css');
        implicitStyles.includes('./nested/inner.css');
        expectRewrittenFile('./node_modules/my-addon3/my-addon3.css').matches(`from-addon`);
        expectRewrittenFile('./node_modules/my-addon3/outer.css').matches(`from-outer`);
        expectRewrittenFile('./node_modules/my-addon3/nested/inner.css').matches(`from-inner`);
      });
    });
  });

function setAddonNameAndCSS(addon: Project, letter: string) {
  addon.pkg.name = `addon-${letter}`;
  merge(addon.files, {
    addon: {
      styles: {
        'addon.css': `.addon-${letter} {}`,
      },
    },
  });
}

appScenarios
  .map('compat-addon-styles', project => {
    const addonA: Project = baseAddon();
    setAddonNameAndCSS(addonA, 'a');

    const addonB = baseAddon();
    setAddonNameAndCSS(addonB, 'b');

    const addonC = baseAddon();
    setAddonNameAndCSS(addonC, 'c');

    const addonD = baseAddon();
    setAddonNameAndCSS(addonD, 'd');

    project.addDependency(addonA);
    project.addDependency(addonB);
    addonA.addDependency(addonC);
    project.addDependency(addonD);

    project.addDependency('third-party', '1.2.3').files = {
      'third-party.css': '.third-party {}',
    };

    merge(project.files, {
      'ember-cli-build.js': `
        'use strict';

        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { maybeEmbroider } = require('@embroider/test-setup');

        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {});
          app.import('node_modules/third-party/third-party.css');

          return maybeEmbroider(app, {
            skipBabel: [
              {
                package: 'qunit',
              },
            ],
          });
        };`,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;

      let expectFile: ExpectFile;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { STAGE2_ONLY: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(app.dir, { qunit: assert });
      });

      test('addon styles are in order', function () {
        const vendorCssPath = './node_modules/.embroider/rewritten-app/assets/vendor.css';
        expectFile(vendorCssPath).matches(/third-party.*addon-a.*addon-b.*addon-c.*addon-d/);
      });
    });
  });
