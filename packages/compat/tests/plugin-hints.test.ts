import { Project, BuildResult, ExpectFile, expectFilesAt } from '@embroider/test-support';
import { BuildParams } from '@embroider/test-support/build';
import { throwOnWarnings } from '@embroider/core';

export function samplePlugin() {
  return { visitor: {} };
}

describe('plugin hints', function () {
  jest.setTimeout(120000);
  throwOnWarnings();

  describe('can result in parallelizable babel', function () {
    let expectFile: ExpectFile;
    let build: BuildResult;

    beforeAll(async function () {
      let buildOptions: Partial<BuildParams> = {
        stage: 2,
        type: 'app',
        emberAppOptions: {
          tests: false,
          babel: {
            plugins: [samplePlugin],
          },
        },
        embroiderOptions: {
          pluginHints: [
            {
              resolve: [__filename],
              useMethod: 'samplePlugin',
            },
          ],
        },
      };
      let app = Project.emberNew();
      build = await BuildResult.build(app, buildOptions);
      expectFile = expectFilesAt(build.outputPath);
    });

    afterAll(async function () {
      await build.cleanup();
    });

    it('is parallel safe', function () {
      expectFile('./package.json').json().get('ember-addon.babel.isParallelSafe').equals(true);
    });
  });
});
