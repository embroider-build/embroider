import { allBabelVersions } from '@embroider/test-support';
import { MacrosConfig } from '../../src/node';
import { Project } from 'scenario-tester';
import { makeBabelConfig, makeRunner } from './helpers';
import { dirname, join } from 'path';

describe(`addon-config`, function () {
  let project: Project;
  let addon: Project;
  let config: MacrosConfig;
  let filename: string;
  let run: ReturnType<typeof makeRunner>;

  allBabelVersions({
    babelConfig(version: number) {
      let c = makeBabelConfig(version, config);
      c.filename = filename;
      return c;
    },
    createTests: function (transform) {
      beforeEach(function () {
        project = new Project('app', '1.0.0', {
          files: {
            config: {
              'addons.js': `'use strict';

    module.exports = {
      'v2-addon': {
        enabled: true
      },
    };`,
            },
          },
        });

        addon = Project.fromDir(dirname(require.resolve('../../../../tests/v2-addon-template/package.json')), {
          linkDeps: true,
        });
        addon.pkg.name = 'v2-addon';
        addon.addDependency('@embroider/macros');

        project.addDependency(addon);
        project.write();

        config = MacrosConfig.for({}, project.baseDir);
        filename = join(addon.baseDir, 'sample.js');

        run = makeRunner(transform);
      });

      test('reads config from config/addon.js', () => {
        config.finalize();
        let code = transform(`
          import { getOwnConfig } from '@embroider/macros';
          export default function() {
            return getOwnConfig();
          }
        `);
        expect(run(code, { filename })).toEqual({ enabled: true });
      });

      test('overriddes config from addon', () => {
        config.setOwnConfig(filename, { enabled: false, other: true });
        config.finalize();
        let code = transform(`
          import { getOwnConfig } from '@embroider/macros';
          export default function() {
            return getOwnConfig();
          }
        `);
        expect(run(code, { filename })).toEqual({ enabled: true, other: true });
      });
    },
  });
});
