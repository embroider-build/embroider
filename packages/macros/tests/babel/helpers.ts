import { MacrosConfig } from '../..';
import { join } from 'path';
import { allBabelVersions as allBabel, runDefault } from '@embroider/test-support';
import 'qunit';

export { runDefault };
export function allBabelVersions(createTests: (transform: (code: string) => string, config: MacrosConfig) => void) {
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
      config = new MacrosConfig();
      createTests(transform, config!);
    },
  });
}
