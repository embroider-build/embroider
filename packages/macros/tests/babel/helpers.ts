import { MacrosConfig } from '../..';
import { join } from 'path';
import { allBabelVersions as allBabel, runDefault, Transform } from '@embroider/test-support';
import 'qunit';

export { runDefault };

type CreateTestsWithConfig = (transform: Transform, config: MacrosConfig) => void;

export function makeBabelConfig(_babelVersion: number, macroConfig: MacrosConfig) {
  return {
    filename: join(__dirname, 'sample.js'),
    presets: [],
    plugins: [macroConfig.babelPluginConfig()],
  };
}

type CreateTests = (transform: Transform) => void;
interface ModeTestHooks {
  runTimeTest: typeof test;
  buildTimeTest: typeof test;
  applyMode: (m: MacrosConfig) => void;
}
type CreateModeTests = (transform: Transform, hooks: ModeTestHooks) => void;

function disabledTest(_name: string, _impl: jest.ProvidesCallback | undefined) {}
disabledTest.only = disabledTest;
disabledTest.skip = disabledTest;
disabledTest.todo = disabledTest;
disabledTest.concurrent = disabledTest;
disabledTest.each = test.each;

export function allModes(fn: CreateModeTests): CreateTests {
  return function createTests(transform: Transform) {
    for (let mode of ['build-time', 'run-time']) {
      describe(mode, function() {
        function applyMode(macrosConfig: MacrosConfig) {
          if (mode === 'run-time') {
            macrosConfig.enableRuntimeMode();
          }
        }
        fn(transform, {
          runTimeTest: mode === 'run-time' ? test : disabledTest,
          buildTimeTest: mode === 'build-time' ? test : disabledTest,
          applyMode,
        });
      });
    }
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
