import { allBabelVersions, runDefault } from './helpers';

describe(`moduleExists`, function () {
  allBabelVersions(function (transform: (code: string) => string) {
    test('package import is satisfied', () => {
      let code = transform(`
      import { moduleExists } from '@embroider/macros';
      export default function() {
        // TODO this should support reading package.json exports
        // return moduleExists('@embroider/core/src/index');
        return moduleExists('@embroider/core/dist/src/index');
      }
      `);
      expect(runDefault(code)).toBe(true);
    });

    test('package import is not satisfied', () => {
      let code = transform(`
      import { moduleExists } from '@embroider/macros';
      export default function() {
        return moduleExists('@embroider/core/not/a/real/thing');
      }
      `);
      expect(runDefault(code)).toBe(false);
    });

    test('relative import is satisfied', () => {
      let code = transform(`
      import { moduleExists } from '@embroider/macros';
      export default function() {
        return moduleExists('./dependency-satisfies.test');
      }
      `);
      expect(runDefault(code)).toBe(true);
    });

    test('relative import is not satisfied', () => {
      let code = transform(`
      import { moduleExists } from '@embroider/macros';
      export default function() {
        return moduleExists('./nope');
      }
      `);
      expect(runDefault(code)).toBe(false);
    });

    test('package not present', () => {
      let code = transform(`
      import { moduleExists } from '@embroider/macros';
      export default function() {
        return moduleExists('not-a-real-dep');
      }
      `);
      expect(runDefault(code)).toBe(false);
    });

    test('import gets removed', () => {
      let code = transform(`
      import { moduleExists } from '@embroider/macros';
      export default function() {
        return moduleExists('not-a-real-dep');
      }
      `);
      expect(code).not.toMatch(/moduleExists/);
      expect(code).not.toMatch(/@embroider\/macros/);
    });

    test('non call error', () => {
      expect(() => {
        transform(`
          import { moduleExists } from '@embroider/macros';
          let x = moduleExists;
        `);
      }).toThrow(/You can only use moduleExists as a function call/);
    });

    test('args length error', () => {
      expect(() => {
        transform(`
          import { moduleExists } from '@embroider/macros';
          moduleExists('foo', 'bar');
        `);
      }).toThrow(/moduleExists takes exactly one argument, you passed 2/);
    });

    test('non literal arg error', () => {
      expect(() => {
        transform(`
          import { moduleExists } from '@embroider/macros';
          let name = 'qunit';
          moduleExists(name);
        `);
      }).toThrow(/the first argument to moduleExists must be a string literal/);
    });
  });
});
