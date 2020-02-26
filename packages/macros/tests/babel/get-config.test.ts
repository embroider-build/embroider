import { allBabelVersions, runDefault } from './helpers';

describe(`getConfig`, function() {
  allBabelVersions(function(transform, config) {
    config.setOwnConfig(__filename, {
      beverage: 'coffee',
    });
    config.setConfig(__filename, '@babel/traverse', {
      sizes: [{ name: 'small', oz: 4 }, { name: 'medium', oz: 8 }],
    });
    config.setConfig(__filename, '@babel/core', [1, 2, 3]);
    config.finalize();

    test(`returns correct value for own package's config`, () => {
      let code = transform(`
      import { getOwnConfig } from '@embroider/macros';
      export default function() {
        return getOwnConfig();
      }
      `);
      expect(runDefault(code)).toEqual({ beverage: 'coffee' });
    });

    test(`returns correct value for another package's config`, () => {
      let code = transform(`
      import { getConfig } from '@embroider/macros';
      export default function() {
        return getConfig('@babel/core');
      }
      `);
      expect(runDefault(code)).toEqual([1, 2, 3]);
    });

    test(`returns undefined when there's no config but the package exists`, () => {
      let code = transform(`
      import { getConfig } from '@embroider/macros';
      export default function() {
        return getConfig('qunit');
      }
      `);
      expect(runDefault(code)).toBe(undefined);
    });

    test(`returns undefined when there's no such package`, () => {
      let code = transform(`
      import { getConfig } from '@embroider/macros';
      export default function() {
        return getConfig('not-a-thing');
      }
      `);
      expect(runDefault(code)).toBe(undefined);
    });

    test(`collapses property access`, () => {
      let code = transform(`
      import { getOwnConfig } from '@embroider/macros';
      export default function() {
        return doSomething(getOwnConfig().beverage);
      }
      `);
      expect(code).toMatch(/doSomething\(["']coffee["']\)/);
    });

    test(`collapses computed property access`, () => {
      let code = transform(`
      import { getOwnConfig } from '@embroider/macros';
      export default function() {
        return doSomething(getOwnConfig()["beverage"]);
      }
      `);
      expect(code).toMatch(/doSomething\(["']coffee["']\)/);
    });

    test(`collapses chained property access`, () => {
      let code = transform(`
      import { getConfig } from '@embroider/macros';
      export default function() {
        return doSomething(getConfig('@babel/traverse').sizes[1].oz);
      }
      `);
      expect(code).toMatch(/doSomething\(8\)/);
    });

    if (transform.babelMajorVersion === 7) {
      test.skip(`collapses nullish coalescing, not null case`, () => {
        let code = transform(`
      import { getConfig } from '@embroider/macros';
      export default function() {
        return doSomething(getConfig('@babel/traverse')?.sizes?.[1]?.oz);
      }
      `);
        expect(code).toMatch(/doSomething\(8\)/);
      });

      test.skip(`collapses nullish coalescing, nullish case`, () => {
        let code = transform(`
      import { getConfig } from '@embroider/macros';
      export default function() {
        return doSomething(getConfig('not-a-real-package')?.sizes?.[1]?.oz);
      }
      `);
        expect(code).toMatch(/doSomething\(undefined\)/);
      });
    }
  });
});
