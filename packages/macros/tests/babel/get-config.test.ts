import { allBabelVersions } from '@embroider/test-support';
import { makeBabelConfig, allModes, makeRunner } from './helpers';
import { MacrosConfig } from '../../src/node';
import { dirname } from 'path';

describe(`getConfig`, function () {
  let config: MacrosConfig;
  let filename: string;
  let run: ReturnType<typeof makeRunner>;

  allBabelVersions({
    babelConfig(version: number) {
      let c = makeBabelConfig(version, config);
      c.filename = filename;
      return c;
    },
    includePresetsTests: true,
    createTests: allModes(function (transform, { applyMode, buildTimeTest, runTimeTest }) {
      beforeEach(function () {
        // we have some tests that behave differently on files that appear to be
        // inside or outside of the macros package itself. Most tests don't care
        // and will default to "outside", with a notional path inside
        // @embroider/core, which just happens to be one of our dependencies so
        // we know it will be available.
        filename = `${dirname(require.resolve('@embroider/core/package.json'))}/sample.js`;

        config = MacrosConfig.for({}, dirname(require.resolve('@embroider/core/package.json')));
        config.setOwnConfig(filename, {
          beverage: 'coffee',
        });
        config.setConfig(filename, '@babel/traverse', {
          sizes: [
            { name: 'small', oz: 4 },
            { name: 'medium', oz: 8 },
          ],
        });
        config.setConfig(filename, '@babel/core', [1, 2, 3]);
        config.setGlobalConfig(filename, 'something-very-global', { year: 2020 });
        applyMode(config);
        config.finalize();
        run = makeRunner(transform);
      });

      test(`returns correct value for own package's config`, () => {
        let code = transform(`
          import { getOwnConfig } from '@embroider/macros';
          export default function() {
            return getOwnConfig();
          }
        `);
        expect(run(code, { filename })).toEqual({ beverage: 'coffee' });
      });

      test(`returns correct value for another package's config`, () => {
        let code = transform(`
          import { getConfig } from '@embroider/macros';
          export default function() {
            return getConfig('@babel/core');
          }
        `);
        expect(run(code, { filename })).toEqual([1, 2, 3]);
      });

      test(`returns undefined when there's no config but the package exists`, () => {
        let code = transform(`
          import { getConfig } from '@embroider/macros';
          export default function() {
            return getConfig('qunit');
          }
        `);
        expect(run(code, { filename })).toBe(undefined);
      });

      test(`returns undefined when there's no such package`, () => {
        let code = transform(`
          import { getConfig } from '@embroider/macros';
          export default function() {
            return getConfig('not-a-thing');
          }
        `);
        expect(run(code, { filename })).toBe(undefined);
      });

      buildTimeTest(`collapses property access`, () => {
        let code = transform(`
          import { getOwnConfig } from '@embroider/macros';
          export default function() {
            return doSomething(getOwnConfig().beverage);
          }
        `);
        expect(code).toMatch(/doSomething\(["']coffee["']\)/);
      });

      buildTimeTest(`collapses computed property access`, () => {
        let code = transform(`
          import { getOwnConfig } from '@embroider/macros';
          export default function() {
            return doSomething(getOwnConfig()["beverage"]);
          }
        `);
        expect(code).toMatch(/doSomething\(["']coffee["']\)/);
      });

      buildTimeTest(`collapses chained property access`, () => {
        let code = transform(`
          import { getConfig } from '@embroider/macros';
          export default function() {
            return doSomething(getConfig('@babel/traverse').sizes[1].oz);
          }
        `);
        expect(code).toMatch(/doSomething\(8\)/);
      });

      buildTimeTest(`collapses chained property access`, () => {
        let code = transform(`
        import { getConfig } from '@embroider/macros';

        export default {
          test: function() {
            this.mode = getConfig('@babel/traverse').sizes[1].oz;
          }
        };
        `);
        expect(code).toMatch(/this.mode = 8/);
      });

      // babel 6 doesn't parse nullish coalescing
      if (transform.babelMajorVersion === 7) {
        buildTimeTest(`collapses nullish coalescing, not null case`, () => {
          let code = transform(`
          import { getConfig } from '@embroider/macros';
          export default function() {
            return doSomething(getConfig('@babel/traverse')?.sizes?.[1]?.oz);
          }
        `);
          expect(code).toMatch(/doSomething\(8\)/);
        });

        buildTimeTest(`collapses nullish coalescing, nullish case`, () => {
          let code = transform(`
            import { getConfig } from '@embroider/macros';
            export default function() {
              return doSomething(getConfig('not-a-real-package')?.sizes?.[1]?.oz);
            }
          `);
          expect(code).toMatch(/doSomething\(undefined\)/);
        });

        buildTimeTest(`does not collapse nullish coalescing for non embroider macros, nullish case`, () => {
          let code = transform(`
            const aKnownValue = {};
            aKnownValue.foo = true;
            result = aKnownValue?.foo;
          `);
          expect(code).toMatch(`result = aKnownValue`);
        });

        runTimeTest(`runtime getConfig is still present in runtime mode when using optional chaining`, () => {
          let code = transform(`
            import { getConfig } from '@embroider/macros';
            export default function() {
              return doSomething(getConfig('not-a-real-package')?.sizes?.[1]?.oz);
            }
          `);
          expect(code).toMatch(/config/);
        });
      }

      runTimeTest('inlines runtime config into own source', () => {
        filename = __filename;
        let code = transform(`
          function initializeRuntimeMacrosConfig() {
          }
          export default function() {
            return initializeRuntimeMacrosConfig();
          }
        `);
        expect(code).toMatch(/beverage/);
        let coreRoot = dirname(require.resolve('@embroider/core/package.json'));
        expect(run(code, { filename }).packages[coreRoot].beverage).toEqual('coffee');
      });

      runTimeTest('does not inline runtime config into other packages', () => {
        let code = transform(`
          function initializeRuntimeMacrosConfig() {
          }
        `);
        expect(code).toMatch(/function initializeRuntimeMacrosConfig\(\)\s*\{\s*\}/);
      });

      test(`Preserves necessary side effects`, () => {
        let code = transform(`
          import { getOwnConfig } from '@embroider/macros';
          export default function() {
            let config;
            if ((config = getOwnConfig()) !== 0) {
              return config;
            }
          }
        `);
        expect(run(code, { filename })).toEqual({ beverage: 'coffee' });
      });

      test(`Accesses global config`, () => {
        let code = transform(`
          import { getGlobalConfig } from '@embroider/macros';
          export default function() {
            return getGlobalConfig()['something-very-global'].year;
          }
        `);
        expect(run(code, { filename })).toEqual(2020);
      });
    }),
  });
});
