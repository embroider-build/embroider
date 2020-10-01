import { allBabelVersions, runDefault } from './helpers';

describe(`dependencySatisfies`, function () {
  allBabelVersions(function (transform: (code: string) => string) {
    test('is satisfied', () => {
      let code = transform(`
      import { dependencySatisfies } from '@embroider/macros';
      export default function() {
        return dependencySatisfies('qunit', '^2.8.0');
      }
      `);
      expect(runDefault(code)).toBe(true);
    });

    test('is not satisfied', () => {
      let code = transform(`
      import { dependencySatisfies } from '@embroider/macros';
      export default function() {
        return dependencySatisfies('qunit', '^10.0.0');
      }
      `);
      expect(runDefault(code)).toBe(false);
    });

    test('is not present', () => {
      let code = transform(`
      import { dependencySatisfies } from '@embroider/macros';
      export default function() {
        return dependencySatisfies('not-a-real-dep', '^10.0.0');
      }
      `);
      expect(runDefault(code)).toBe(false);
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

    test('entire import statement gets removed', () => {
      let code = transform(`
      import { dependencySatisfies } from '@embroider/macros';
      export default function() {
        return dependencySatisfies('not-a-real-dep', '*');
      }
      `);
      expect(code).not.toMatch(/dependencySatisfies/);
      expect(code).not.toMatch(/@embroider\/macros/);
    });

    test('unused import gets removed', () => {
      let code = transform(`
      import { dependencySatisfies } from '@embroider/macros';
      export default function() {
        return 1;
      }
      `);
      expect(code).not.toMatch(/dependencySatisfies/);
      expect(code).not.toMatch(/@embroider\/macros/);
    });

    test('non call error', () => {
      expect(() => {
        transform(`
          import { dependencySatisfies } from '@embroider/macros';
          let x = dependencySatisfies;
        `);
      }).toThrow(/You can only use dependencySatisfies as a function call/);
    });

    test('args length error', () => {
      expect(() => {
        transform(`
          import { dependencySatisfies } from '@embroider/macros';
          dependencySatisfies('foo', 'bar', 'baz');
        `);
      }).toThrow(/dependencySatisfies takes exactly two arguments, you passed 3/);
    });

    test('non literal arg error', () => {
      expect(() => {
        transform(`
          import { dependencySatisfies } from '@embroider/macros';
          let name = 'qunit';
          dependencySatisfies(name, '*');
        `);
      }).toThrow(/the first argument to dependencySatisfies must be a string literal/);
    });
  });
});
