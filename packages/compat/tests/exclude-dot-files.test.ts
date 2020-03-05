import { Project, BuildResult, ExpectFile, expectFilesAt } from '@embroider/test-support';
import { throwOnWarnings } from '@embroider/core';

describe('dot files are excluded as modules from apps and addons', function() {
  jest.setTimeout(120000);
  let build: BuildResult;
  let app: Project;
  let expectFile: ExpectFile;

  throwOnWarnings();

  beforeAll(async function() {
    app = Project.emberNew();
    app.files.app = Object.assign({}, app.files.app, {
      '.foobar.js': `// foobar content`,
      '.barbaz.js': `// barbaz content`,
      'bizbiz.js': `// bizbiz content`,
    });

    let addon = app.addAddon('my-addon');

    addon.files.addon = Object.assign({}, addon.files.addon, {
      '.fooaddon.js': `// fooaddon content`,
      'baraddon.js': `// bizbiz content`,
    });

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

  test('dot files are not included as app modules', function() {
    // dot files should exist on disk
    expectFile('.foobar.js').exists();
    expectFile('.barbaz.js').exists();
    expectFile('bizbiz.js').exists();

    // dot files should not be included as modules
    expectFile('assets/my-app.js').doesNotMatch('my-app/.foobar');
    expectFile('assets/my-app.js').doesNotMatch('my-app/.barbaz');
    expectFile('assets/my-app.js').matches('my-app/bizbiz');
  });

  test('dot files are not included as addon implicit-modules', function() {
    // Dot files should exist on disk
    expectFile('node_modules/my-addon/.fooaddon.js').exists();
    expectFile('node_modules/my-addon/baraddon.js').exists();

    let myAddonPackage = expectFile('node_modules/my-addon/package.json').json();

    // dot files are not included as implicit-modules
    myAddonPackage.get(['ember-addon', 'implicit-modules']).deepEquals(['./baraddon']);
  });
});
