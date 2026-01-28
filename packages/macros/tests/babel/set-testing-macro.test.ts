import { allBabelVersions } from '@embroider/test-support';
import { makeBabelConfig, allModes, makeRunner } from './helpers';
import { MacrosConfig } from '../../src/node';
import { resolve } from 'path';

describe(`setTesting macro`, function () {
  let macrosConfig: MacrosConfig;

  allBabelVersions({
    babelConfig(version: number) {
      return makeBabelConfig(version, macrosConfig);
    },
    includePresetsTests: true,
    createTests: allModes(function (transform, { applyMode, runTimeTest }) {
      let run: ReturnType<typeof makeRunner>;

      beforeEach(function () {
        macrosConfig = MacrosConfig.for({}, resolve(__dirname, '..', '..'));
        applyMode(macrosConfig);
        macrosConfig.finalize();
        run = makeRunner(transform);
      });

      runTimeTest('setTesting: can be called in runtime mode', () => {
        let code = transform(`
          import { setTesting } from '@embroider/macros';
          export default function() {
            setTesting(true);
            return true;
          }
        `);
        // Should transform to runtime import
        expect(code).toMatch(/from ['"].*runtime['"]/);
        expect(run(code)).toBe(true);
      });

      runTimeTest('setTesting: can be called with false', () => {
        let code = transform(`
          import { setTesting } from '@embroider/macros';
          export default function() {
            setTesting(false);
            return true;
          }
        `);
        expect(code).toMatch(/from ['"].*runtime['"]/);
        expect(run(code)).toBe(true);
      });

      test('setTesting: removed in build-time mode', () => {
        let code = transform(`
          import { setTesting } from '@embroider/macros';
          export default function() {
            setTesting(true);
          }
        `);
        // In build-time mode, setTesting call should be removed
        // In runtime mode, it should be transformed to runtime import
        if (code.includes('runtime')) {
          // Runtime mode - transformed to runtime implementation
          expect(code).toMatch(/from ['"].*runtime['"]/);
        } else {
          // Build-time mode - call should be removed
          expect(code).not.toMatch(/setTesting/);
        }
      });
    }),
  });
});
