import { allBabelVersions, runDefault } from './helpers';
import { MacrosConfig } from '../..';

describe('macroIf', function() {
  allBabelVersions(function createTests(transform: (code: string) => string, config: MacrosConfig) {
    config.setConfig(__filename, 'qunit', { items: [{ approved: true, other: null, size: 2.3 }] });
    config.finalize();

    test('select consequent, drop alternate', () => {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      export default function() {
        return macroIf(true, () => 'alpha', () => 'beta');
      }
      `);
      expect(runDefault(code)).toBe('alpha');
      expect(code).not.toMatch(/beta/);
      expect(code).not.toMatch(/macroIf/);
      expect(code).not.toMatch(/@embroider\/macros/);
    });

    test('select consequent, drop alternate', () => {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      export default function() {
        return macroIf(false, () => 'alpha', () => 'beta');
      }
      `);
      expect(runDefault(code)).toBe('beta');
      expect(code).not.toMatch(/alpha/);
      expect(code).not.toMatch(/macroIf/);
      expect(code).not.toMatch(/@embroider\/macros/);
    });

    test('works with block forms', () => {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      export default function() {
        return macroIf(false, () => { return 'alpha'; }, () => { return 'beta'; });
      }
      `);
      expect(runDefault(code)).toBe('beta');
      expect(code).not.toMatch(/alpha/);
    });

    test('block lifting', () => {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      export default function() {
        let value = macroIf(true, () => {
          let value = 1;
          return value + 1;
        });
        return value;
      }
      `);
      expect(runDefault(code)).toBe(2);
    });

    test('preserves this when using single-expression arrows', () => {
      let code = transform(`
      import { macroIf } from '@embroider/macros';

      class Example {
        constructor() {
          this.name = 'Quint';
        }
        method() {
          return macroIf(true, () => this.name, () => 'Other');
        }
      }

      export default function() {
        return new Example().method();
      }
      `);
      expect(runDefault(code)).toBe('Quint');
    });

    test('preserves this when using block arrows', () => {
      let code = transform(`
      import { macroIf } from '@embroider/macros';

      class Example {
        constructor() {
          this.name = 'Quint';
        }
        method() {
          return macroIf(true, () => { return this.name;}, () => { return 'Other'; });
        }
      }

      export default function() {
        return new Example().method();
      }
      `);
      expect(runDefault(code)).toBe('Quint');
    });

    test('select consequent, no alternate', () => {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      export default function() {
        return macroIf(true, () => 'alpha');
      }
      `);
      expect(runDefault(code)).toBe('alpha');
      expect(code).not.toMatch(/macroIf/);
      expect(code).not.toMatch(/@embroider\/macros/);
    });

    test('drop consequent, no alternate', () => {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      export default function() {
        return macroIf(false, () => 'alpha');
      }
      `);
      expect(runDefault(code)).toBe(undefined);
    });

    test('drops imports that are only used in the unused branch', () => {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      import a from 'module-a';
      import b from 'module-b';
      import c from 'module-c';
      export default function() {
        return macroIf(true, () => a, () => b);
      }
      `);
      expect(code).toMatch(/module-a/);
      expect(code).not.toMatch(/module-b/);
    });

    test('non-static predicate refuses to build', () => {
      expect(() => {
        transform(`
        import { macroIf } from '@embroider/macros';
        import other from 'other';
        export default function() {
          return macroIf(other, () => a, () => b);
        }
        `);
      }).toThrow(/the first argument to macroIf must be statically known/);
    });

    test('leaves unrelated unused imports alone', () => {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      import a from 'module-a';
      import b from 'module-b';
      import c from 'module-c';
      export default function() {
        return macroIf(true, () => a, () => b);
      }
      `);
      expect(code).toMatch(/module-c/);
    });

    test('leaves unrelated used imports alone', () => {
      let code = transform(`
      import { macroIf } from '@embroider/macros';
      import a from 'module-a';
      import b from 'module-b';
      import c from 'module-c';
      export default function() {
        c();
        return macroIf(true, () => a, () => b);
      }
      `);
      expect(code).toMatch(/module-c/);
    });

    test('composes with other macros', () => {
      let code = transform(`
      import { macroIf, dependencySatisfies } from '@embroider/macros';
      export default function() {
        return macroIf(dependencySatisfies('qunit', '*'), () => 'alpha', () => 'beta');
      }
      `);
      expect(runDefault(code)).toBe('alpha');
      expect(code).not.toMatch(/beta/);
    });

    test('composes with self', () => {
      let code = transform(`
      import { macroIf, dependencySatisfies } from '@embroider/macros';
      export default function() {
        return macroIf(dependencySatisfies('qunit', '*'), () => {
          return macroIf(
            dependencySatisfies('not-a-real-dep', '*'),
            () => 'gamma',
            () => 'alpha'
          );
        }, () => 'beta');
      }
      `);
      expect(runDefault(code)).toBe('alpha');
      expect(code).not.toMatch(/beta/);
      expect(code).not.toMatch(/gamma/);
    });

    test('can see booleans inside getConfig', () => {
      let code = transform(`
      import { macroIf, getConfig } from '@embroider/macros';
      export default function() {
        // this deliberately chains three kinds of property access syntax: by
        // identifier, by numeric index, and by string literal.
        return macroIf(getConfig('qunit').items[0]["approved"], () => 'alpha', () => 'beta');
      }
      `);
      expect(runDefault(code)).toBe('alpha');
      expect(code).not.toMatch(/beta/);
    });

    test(`direct export of macroIf`, () => {
      let code = transform(`
      import { dependencySatisfies, macroIf } from '@embroider/macros';

      function a() {
        return 'a';
      }

      function b() {
        return 'b';
      }

      export default macroIf(
        false,
        () => a,
        () => b,
      );
      `);
      expect(runDefault(code)).toBe('b');
    });
  });
});
