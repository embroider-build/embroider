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
    createTests: allModes(function(transform, { applyMode }) {
      let run: ReturnType<typeof makeRunner>;

      describe(`true cases`, function() {
        beforeEach(function() {
          macrosConfig = MacrosConfig.for({});
          macrosConfig.setGlobalConfig(__filename, '@embroider/macros', { isDevelopingApp: true, isTesting: true });
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
          expect(run(code)).toBe('yes');
        });

        test('isTesting: access value', () => {
          let code = transform(`
            import { isTesting } from '@embroider/macros';
            export default function() {
              return isTesting();
            }
          `);
          expect(run(code)).toBe(true);
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
          expect(run(code)).toBe('yes');
        });
      });

      describe(`false cases`, function() {
        beforeEach(function() {
          macrosConfig = MacrosConfig.for({});
          macrosConfig.setGlobalConfig(__filename, '@embroider/macros', { isDevelopingApp: false, isTesting: false });
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
