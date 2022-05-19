import { Project, BuildResult, expectFilesAt, ExpectFile } from '@embroider/test-support';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';

describe('preprocessors tests', function () {
  jest.setTimeout(120000);
  let build: BuildResult;
  let app: Project;
  let expectFile: ExpectFile;

  throwOnWarnings();

  beforeAll(async function () {
    app = Project.emberNew('my-app');

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

    const PACKAGE_MY_PREPROCESSOR = 'my-preprocessor';
    let addonPreprocessor = app.addAddon(PACKAGE_MY_PREPROCESSOR);

    const INDEX_JS_WITH_PREPROCESSOR = `const { map } = require('broccoli-stew');

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
`;

    addonPreprocessor.linkDevPackage('broccoli-stew');
    addonPreprocessor.files['index.js'] = INDEX_JS_WITH_PREPROCESSOR;

    let addon = app.addAddon('my-addon');

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

    // We must explicitly pass the addonPreprocessor using the
    // name is not sufficient.
    addon.addDependency(addonPreprocessor);

    build = await BuildResult.build(app, {
      stage: 2,
      type: 'app',
      emberAppOptions: {
        tests: false,
      },
    });

    expectFile = expectFilesAt(build.outputPath);
  });

  afterAll(async () => {
    await build.cleanup();
  });

  test('dependencies are setup for this test suite correctly', () => {
    expectFile('package.json').exists();
    expectFile('package.json').matches(/my-preprocessor/, 'has the preprocessor dependency');
    expectFile('node_modules/my-addon/package.json').exists();
    expectFile('node_modules/my-addon/package.json').matches(/my-preprocessor/, 'has the preprocessor dependency');
    expectFile('node_modules/my-preprocessor/package.json').exists();
  });

  test('app has correct path embedded in comment', () => {
    const assertFile = expectFile('components/from-the-app.js');
    assertFile.exists();
    // This is the expected output during an classic build.
    assertFile.matches(/path@my-app\/components\/from-the-app\.js/, 'has a path comment in app components');
  });

  test('addon has correct path embedded in comment', () => {
    expectFile('node_modules/my-preprocessor/package.json').exists();
    const assertFile = expectFile('node_modules/my-addon/components/greeting.js');
    assertFile.matches(/path@my-addon\/components\/greeting\.js/, 'has a path comment in app components');
  });
});
