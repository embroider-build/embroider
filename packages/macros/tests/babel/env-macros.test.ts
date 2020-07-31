import { allBabelVersions } from '@embroider/test-support';
import { makeBabelConfig, allModes, makeRunner } from './helpers';
import { MacrosConfig } from '../..';

describe(`env macros`, function() {
  let macrosConfig: MacrosConfig;

  allBabelVersions({
    babelConfig(version: number) {
      return makeBabelConfig(version, macrosConfig);
    },
    includePresetsTests: true,
    createTests: allModes(function(transform, { applyMode, buildTimeTest, runTimeTest }) {
      let run: ReturnType<typeof makeRunner>;

      describe(`true cases`, function() {
        beforeEach(function() {
          macrosConfig = MacrosConfig.for({});
          macrosConfig.setGlobalConfig(__filename, '@embroider/macros', { isTesting: true });
          macrosConfig.enableAppDevelopment();
          applyMode(macrosConfig);
          macrosConfig.finalize();
          run = makeRunner(transform);
        });

        test('isDevelopingApp: access value', () => {
          let code = transform(`
            import { isDevelopingApp } from '@embroider/macros';
            export default function() {
              return isDevelopingApp();
            }
          `);
          expect(run(code)).toBe(true);
          expect(code).toMatch(/return true/);
        });

        buildTimeTest('isDevelopingApp: use within conditional', () => {
          let code = transform(`
            import { isDevelopingApp, macroCondition } from '@embroider/macros';
            export default function() {
              if (macroCondition(isDevelopingApp())) {
                return 'yes';
              } else {
                return 'no';
              }
            }
          `);
          expect(run(code)).toBe('yes');
          expect(code).toMatch(/return 'yes'/);
          expect(code).not.toMatch(/return 'no'/);
        });

        buildTimeTest('isTesting: access value', () => {
          let code = transform(`
            import { isTesting } from '@embroider/macros';
            export default function() {
              return isTesting();
            }
          `);
          expect(run(code)).toBe(true);
          expect(code).toMatch(/return true/);
        });

        runTimeTest('isTesting: access value', () => {
          let code = transform(`
            import { isTesting } from '@embroider/macros';
            export default function() {
              return isTesting();
            }
          `);
          expect(run(code)).toBe(true);
          expect(code).toMatch(/return isTesting\(\)/);
        });

        buildTimeTest('isTesting: use within conditional', () => {
          let code = transform(`
            import { isTesting, macroCondition } from '@embroider/macros';
            export default function() {
              if (macroCondition(isTesting())) {
                return 'yes';
              } else {
                return 'no';
              }
            }
          `);
          expect(run(code)).toBe('yes');
          expect(code).toMatch(/return 'yes'/);
          expect(code).not.toMatch(/return 'no'/);
          expect(code).not.toMatch(/isTesting\(\)/);
        });

        runTimeTest('isTesting: use within conditional', () => {
          let code = transform(`
            import { isTesting, macroCondition } from '@embroider/macros';
            export default function() {
              if (macroCondition(isTesting())) {
                return 'yes';
              } else {
                return 'no';
              }
            }
          `);
          expect(run(code)).toBe('yes');
          expect(code).toMatch(/return 'yes'/);
          expect(code).toMatch(/return 'no'/);
          expect(code).toMatch(/isTesting\(\)/);
        });
      });

      describe(`false cases`, function() {
        beforeEach(function() {
          macrosConfig = MacrosConfig.for({});
          macrosConfig.setGlobalConfig(__filename, '@embroider/macros', { isTesting: false });
          applyMode(macrosConfig);
          macrosConfig.finalize();
          run = makeRunner(transform);
        });

        test('isDevelopingApp: access value', () => {
          let code = transform(`
            import { isDevelopingApp } from '@embroider/macros';
            export default function() {
              return isDevelopingApp();
            }
          `);
          expect(run(code)).toBe(false);
        });

        test('isDevelopingApp: use within conditional', () => {
          let code = transform(`
            import { isDevelopingApp, macroCondition } from '@embroider/macros';
            export default function() {
              if (macroCondition(isDevelopingApp())) {
                return 'yes';
              } else {
                return 'no';
              }
            }
          `);
          expect(run(code)).toBe('no');
        });

        test('isTesting: access value', () => {
          let code = transform(`
            import { isTesting } from '@embroider/macros';
            export default function() {
              return isTesting();
            }
          `);
          expect(run(code)).toBe(false);
        });

        test('isTesting: use within conditional', () => {
          let code = transform(`
            import { isTesting, macroCondition } from '@embroider/macros';
            export default function() {
              if (macroCondition(isTesting())) {
                return 'yes';
              } else {
                return 'no';
              }
            }
          `);
          expect(run(code)).toBe('no');
        });
      });
    }),
  });
});
