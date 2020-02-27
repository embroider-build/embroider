import { MacrosConfig } from '../..';
import { join } from 'path';
import { allBabelVersions as allBabel, runDefault, Transform } from '@embroider/test-support';
import 'qunit';

export { runDefault };

type CreateTestsWithConfig = (transform: Transform, config: MacrosConfig) => void;
type CreateTests = (transform: Transform) => void;

export function makeBabelConfig(macroConfig: MacrosConfig) {
  return {
    filename: join(__dirname, 'sample.js'),
    presets: [],
    plugins: [macroConfig.babelPluginConfig()],
  };
}

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
