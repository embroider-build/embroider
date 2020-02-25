import { MacrosConfig } from '../..';
import { join } from 'path';
import { allBabelVersions as allBabel, runDefault } from '@embroider/test-support';
import 'qunit';

export { runDefault };

type CreateTestsWithConfig = (transform: (code: string) => string, config: MacrosConfig) => void;
type CreateTests = (transform: (code: string) => string) => void;

export function allBabelVersions(createTests: CreateTests | CreateTestsWithConfig) {
  let config: MacrosConfig;
  allBabel({
    includePresetsTests: true,
    babelConfig() {
      return {
        filename: join(__dirname, 'sample.js'),
        presets: [],
        plugins: [config.babelPluginConfig()],
      };
    },

    createTests(transform) {
      config = MacrosConfig.for({});
      if (createTests.length === 1) {
        // The caller will not be using `config`, so we finalize it for them.
        config.finalize();
        (createTests as CreateTests)(transform);
      } else {
        // The caller is receivng `config` and they are responsible for
        // finalizing it.
        (createTests as CreateTestsWithConfig)(transform, config!);
      }
    },
  });
}
