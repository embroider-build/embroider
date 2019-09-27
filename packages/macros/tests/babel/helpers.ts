import { MacrosConfig } from '../..';
import { join } from 'path';
import { allBabelVersions as allBabel, runDefault } from '@embroider/test-support';
import 'qunit';

export { runDefault };
export function allBabelVersions(createTests: (transform: (code: string) => string, config: MacrosConfig) => void) {
  let config: MacrosConfig;

  describe('without presets', function() {
    allBabel({
      babelConfig() {
        config = new MacrosConfig();
        if (createTests.length < 2) {
          // if the consumer of allBabelVersions provides a callback of the following form:
          //   allBabelVersions((transform) => { });
          //
          //  they have no oppertunity to finalize the config, or mutate it, so
          //  we finalize it for them.
          //
          // if the consumer of allBabelVersions provides a callback of the following form:
          //   allBabelVersions((transform, config) => { });
          //
          //  they do have the oppertunity to write to the config, thereby they
          //  are responsible to finalize the config after writing.
          //
          config.finalize();
        }

        return {
          filename: join(__dirname, 'sample.js'),
          presets: [],
          plugins: [config.babelPluginConfig()],
        };
      },
      createTests(transform: (code: string) => string) {
        createTests(transform, config);
      },
    });
  });

  describe('with presets', function() {
    allBabel({
      babelConfig(major: number) {
        config = new MacrosConfig();
        if (createTests.length < 2) {
          // if the consumer of allBabelVersions provides a callback of the following form:
          //   allBabelVersions((transform) => { });
          //
          //  they have no oppertunity to finalize the config, or mutate it, so
          //  we finalize it for them.
          //
          // if the consumer of allBabelVersions provides a callback of the following form:
          //   allBabelVersions((transform, config) => { });
          //
          //  they do have the oppertunity to write to the config, thereby they
          //  are responsible to finalize the config after writing.
          //
          config.finalize();
        }

        return {
          filename: join(__dirname, 'sample.js'),
          presets: [
            [
              require.resolve(major === 6 ? 'babel-preset-env' : '@babel/preset-env'),
              {
                modules: false,
                targets: {
                  ie: '11.0.0',
                },
              },
            ],
          ],
          plugins: [config.babelPluginConfig()],
        };
      },
      createTests(transform: (code: string) => string) {
        createTests(transform, config);
      },
    });
  });
}
