import { Project, BuildResult, expectFilesAt, ExpectFile } from '@embroider/test-support';
import { throwOnWarnings } from '@embroider/core';

describe('addon.styles tests', function() {
  jest.setTimeout(120000);
  let build: BuildResult;
  let app: Project;
  let expectFile: ExpectFile;

  throwOnWarnings();

  beforeAll(async function() {
    app = Project.emberNew();

    let addon1 = app.addAddon(
      'my-addon1',
      `
      treeForStyles() {
        const Funnel = require('broccoli-funnel');
        const path = require('path');
        let tree = new Funnel(path.join(__dirname, 'node_modules/third-party1'), {
          destDir: '.'
        });
        return this._super.treeForStyles.call(this, tree);
      }
    `
    );
    addon1.addDependency('third-party1', '1.2.3').files = {
      'third-party1.css': '.error { color: red; }',
    };
    addon1.linkPackage('broccoli-funnel');

    let addon2 = app.addAddon(
      'my-addon2',
      `
      treeForStyles() {
        const Funnel = require('broccoli-funnel');
        const path = require('path');
        return new Funnel(path.join(__dirname, 'node_modules/third-party2'), {
          destDir: '.'
        });
      }
    `
    );
    addon2.addDependency('third-party2', '1.2.3').files = {
      'third-party2.css': '.success { color: green }',
    };
    addon2.linkPackage('broccoli-funnel');

    let addon3 = app.addAddon('my-addon3');
    (addon3.files.addon as Project['files']).styles = {
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
    };

    build = await BuildResult.build(app, {
      stage: 1,
      type: 'app',
      emberAppOptions: {
        tests: false,
      },
    });
    expectFile = expectFilesAt(build.outputPath);
  });

  afterAll(async function() {
    await build.cleanup();
  });

  test('treeForStyles adds styles to build', function() {
    expectFile('node_modules/@embroider/synthesized-styles/assets/third-party1.css').matches('.error { color: red; }');
  });

  // prevent regression of https://github.com/embroider-build/embroider/issues/164
  test('treeForStyles not calling super adds styles to build', function() {
    expectFile('node_modules/@embroider/synthesized-styles/assets/third-party2.css').matches(
      '.success { color: green }'
    );
  });

  test(`all addon CSS gets convert to implicit-styles`, function() {
    let implicitStyles = expectFile('node_modules/my-addon3/package.json')
      .json()
      .get('ember-addon.implicit-styles');
    implicitStyles.includes('./my-addon3.css');
    implicitStyles.includes('./outer.css');
    implicitStyles.includes('./nested/inner.css');
    expectFile('node_modules/my-addon3/my-addon3.css').matches(`from-addon`);
    expectFile('node_modules/my-addon3/outer.css').matches(`from-outer`);
    expectFile('node_modules/my-addon3/nested/inner.css').matches(`from-inner`);
  });
});
