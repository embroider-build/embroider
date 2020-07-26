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
    createTests: allModes(function(transform, { applyMode, runTimeTest }) {
      let run: ReturnType<typeof makeRunner>;

      describe(`true cases`, function() {
        beforeEach(function() {
          macrosConfig = MacrosConfig.for({});
          macrosConfig.setGlobalConfig(__filename, '@embroider/macros', { isDeveloping: true, isTesting: true });
          applyMode(macrosConfig);
          macrosConfig.finalize();
          run = makeRunner(transform);
        });

        test('isDeveloping: access value', () => {
          let code = transform(`
            import { isDeveloping } from '@embroider/macros';
            export default function() {
              return isDeveloping();
            }
          `);
          expect(run(code)).toBe(true);
        });

        test('isDeveloping: use within conditional', () => {
          let code = transform(`
            import { isDeveloping, macroCondition } from '@embroider/macros';
            export default function() {
              if (macroCondition(isDeveloping())) {
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
          macrosConfig.setGlobalConfig(__filename, '@embroider/macros', { isDeveloping: false, isTesting: false });
          applyMode(macrosConfig);
          macrosConfig.finalize();
          run = makeRunner(transform);
        });

        test('isDeveloping: access value', () => {
          let code = transform(`
            import { isDeveloping } from '@embroider/macros';
            export default function() {
              return isDeveloping();
            }
          `);
          expect(run(code)).toBe(false);
        });

        test('isDeveloping: use within conditional', () => {
          let code = transform(`
            import { isDeveloping, macroCondition } from '@embroider/macros';
            export default function() {
              if (macroCondition(isDeveloping())) {
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
