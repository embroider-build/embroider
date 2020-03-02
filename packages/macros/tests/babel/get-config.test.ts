import { allBabelVersions } from '@embroider/test-support';
import { makeBabelConfig, allModes, makeRunner } from './helpers';
import { MacrosConfig } from '../../src';
import { dirname } from 'path';

describe(`getConfig`, function() {
  let config: MacrosConfig;
  let filename: string;
  let run: ReturnType<typeof makeRunner>;

  allBabelVersions({
    babelConfig(version: number) {
      let c = makeBabelConfig(version, config);
      c.filename = filename;
      return c;
    },
    createTests: allModes(function(transform, { applyMode, buildTimeTest }) {
      beforeEach(function() {
        // we have some tests that behave differently on files that appear to be
        // inside or outside of the macros package itself. Most tests don't care
        // and will default to "outside", with a notional path inside
        // @embroider/core, which just happens to be one of our dependencies so
        // we know it will be available.
        filename = `${dirname(require.resolve('@embroider/core/package.json'))}/sample.js`;

        config = MacrosConfig.for({});
        config.setOwnConfig(filename, {
          beverage: 'coffee',
        });
        config.setConfig(filename, '@babel/traverse', {
          sizes: [{ name: 'small', oz: 4 }, { name: 'medium', oz: 8 }],
        });
        config.setConfig(filename, '@babel/core', [1, 2, 3]);
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
        debugger;
        expect(run(code)).toEqual({ beverage: 'coffee' });
      });

      test(`returns correct value for another package's config`, () => {
        let code = transform(`
          import { getConfig } from '@embroider/macros';
          export default function() {
            return getConfig('@babel/core');
          }
        `);
        expect(run(code)).toEqual([1, 2, 3]);
      });

      test(`returns undefined when there's no config but the package exists`, () => {
        let code = transform(`
          import { getConfig } from '@embroider/macros';
          export default function() {
            return getConfig('qunit');
          }
        `);
        expect(run(code)).toBe(undefined);
      });

      test(`returns undefined when there's no such package`, () => {
        let code = transform(`
          import { getConfig } from '@embroider/macros';
          export default function() {
            return getConfig('not-a-thing');
          }
        `);
        expect(run(code)).toBe(undefined);
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
      }

      test('inlines runtime config into own source', () => {
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
        expect(run(code)[coreRoot].beverage).toEqual('coffee');
      });

      test('does not inline runtime config into other packages', () => {
        let code = transform(`
          function initializeRuntimeMacrosConfig() {
          }
        `);
        expect(code).toMatch(/function initializeRuntimeMacrosConfig\(\)\s*\{\s*\}/);
      });
    }),
  });
});
