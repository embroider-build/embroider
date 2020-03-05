import { Project, BuildResult, expectFilesAt, ExpectFile } from '@embroider/test-support';
import { throwOnWarnings } from '@embroider/core';
import { join } from 'path';

describe('app.import tests', function() {
  jest.setTimeout(120000);
  let build: BuildResult;
  let app: Project;
  let expectFile: ExpectFile;

  throwOnWarnings();

  beforeAll(async function() {
    app = Project.emberNew();

    let addon = app.addAddon(
      'my-addon',
      `
      included() {
        this._super.included.apply(this, arguments);
        this.import('vendor/some-font.ttf', { destDir: 'fonts' });
        this.import('node_modules/third-party/third-party.js', { outputFile: 'assets/tp.js' });
      }
    `
    );
    addon.files.vendor = {
      'some-font.ttf': `some font`,
    };

    addon.addDependency('third-party', '1.2.3').files = {
      'third-party.js': '// third party',
    };

    build = await BuildResult.build(app, {
      stage: 2,
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

  test('destDir puts vendor files into public assets', function() {
    expectFile('node_modules/@embroider/synthesized-vendor/package.json')
      .json()
      .get(['ember-addon', 'public-assets', './vendor/some-font.ttf'])
      .equals('fonts/some-font.ttf');
    expectFile('node_modules/@embroider/synthesized-vendor/vendor/some-font.ttf').exists();
  });

  test('handle non-transformed node_module with explicit outputFile', function() {
    expectFile('node_modules/@embroider/synthesized-vendor/package.json')
      .json()
      .get([
        'ember-addon',
        'public-assets',
        join(app.baseDir, 'node_modules', 'my-addon', 'node_modules', 'third-party', 'third-party.js'),
      ])
      .equals('assets/tp.js');
  });
});
