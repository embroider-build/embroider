import { allBabelVersions, runDefault } from './helpers';
import { MacrosConfig } from '../..';

describe(`getConfig`, function() {
  allBabelVersions(function(transform: (code: string) => string, config: MacrosConfig) {
    config.setOwnConfig(__filename, { beverage: 'coffee' });
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

    test('import gets removed', () => {
      let code = transform(`
      import { dependencySatisfies } from '@embroider/macros';
      export default function() {
        return dependencySatisfies('not-a-real-dep', '1');
      }
      `);
      expect(code).not.toMatch(/dependencySatisfies/);
    });
  });
});
