import { MacrosConfig } from '..';
import { join } from 'path';
import { allBabelVersions as allBabel, runDefault } from '@embroider/test-support';

export { runDefault };

export function allBabelVersions(createTests: (transform: (code: string) => string, config: MacrosConfig) => void) {
  let config: MacrosConfig;

  return allBabel({
    babelConfig(major: 6 | 7) {
      config = new MacrosConfig();
      switch(major) {
        case 6:
          return {
            filename: join(__dirname, 'sample.js'),
            presets: [],
            plugins: [config.babelPluginConfig()]
          };
        case 7:
          return {
            filename: join(__dirname, 'sample.js'),
            presets: [],
            plugins: [config.babelPluginConfig()]
          };
      }
    },
    createTests(transform: (code: string) => string) {
      createTests(transform, config);
    }
  });
}
