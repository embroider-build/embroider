import { allBabelVersions, runDefault } from './helpers';
import { MacrosConfig } from '../..';

describe('macroCondition', function() {
  allBabelVersions(function createTests(transform: (code: string) => string, config: MacrosConfig) {
    config.setConfig(__filename, 'qunit', { items: [{ approved: true, other: null, size: 2.3 }] });
    config.finalize();

    test('if selects consequent, drops alternate', () => {
      let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        if (macroCondition(true)) {
          return 'alpha';
        } else {
          return 'beta';
        }
      }
      `);
      expect(runDefault(code)).toBe('alpha');
      expect(code).not.toMatch(/beta/);
      expect(code).not.toMatch(/macroCondition/);
      expect(code).not.toMatch(/if/);
      expect(code).not.toMatch(/@embroider\/macros/);
    });

    test('non-block if selects consequent', () => {
      let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        if (macroCondition(true))
          return 'alpha';
      }
      `);
      expect(runDefault(code)).toBe('alpha');
      expect(code).not.toMatch(/beta/);
      expect(code).not.toMatch(/macroCondition/);
      expect(code).not.toMatch(/if/);
      expect(code).not.toMatch(/@embroider\/macros/);
    });

    test('if selects alternate, drops consequent', () => {
      let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        if (macroCondition(false)) {
          return 'alpha';
        } else {
          return 'beta';
        }
      }
      `);
      expect(runDefault(code)).toBe('beta');
      expect(code).not.toMatch(/alpha/);
      expect(code).not.toMatch(/macroCondition/);
      expect(code).not.toMatch(/if/);
      expect(code).not.toMatch(/@embroider\/macros/);
    });

    test('ternary selects consequent, drops alternate', () => {
      let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        return macroCondition(true) ? 'alpha' : 'beta';
      }
      `);
      expect(runDefault(code)).toBe('alpha');
      expect(code).not.toMatch(/beta/);
      expect(code).not.toMatch(/macroCondition/);
      expect(code).not.toMatch(/\?/);
      expect(code).not.toMatch(/@embroider\/macros/);
    });

    test('ternary selects alternate, drops consequent', () => {
      let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        return macroCondition(false) ? 'alpha' : 'beta';
      }
      `);
      expect(runDefault(code)).toBe('beta');
      expect(code).not.toMatch(/alpha/);
      expect(code).not.toMatch(/macroCondition/);
      expect(code).not.toMatch(/\?/);
      expect(code).not.toMatch(/@embroider\/macros/);
    });

    test('if selects consequent, no alternate', () => {
      let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        if (macroCondition(true)) {
          return 'alpha';
        }
      }
      `);
      expect(runDefault(code)).toBe('alpha');
      expect(code).not.toMatch(/macroCondition/);
      expect(code).not.toMatch(/@embroider\/macros/);
    });

    test('if drops consequent, no alternate', () => {
      let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        if (macroCondition(false)) {
          return 'alpha';
        }
      }
      `);
      expect(runDefault(code)).toBe(undefined);
    });

    test('else if consequent', () => {
      let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        if (macroCondition(false)) {
          return 'alpha';
        } else if (macroCondition(true)) {
          return 'beta';
        } else {
          return 'gamma';
        }
      }
      `);
      expect(runDefault(code)).toBe('beta');
      expect(code).not.toMatch(/alpha/);
      expect(code).not.toMatch(/gamma/);
    });

    test('else if alternate', () => {
      let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        if (macroCondition(false)) {
          return 'alpha';
        } else if (macroCondition(false)) {
          return 'beta';
        } else {
          return 'gamma';
        }
      }
      `);
      expect(runDefault(code)).toBe('gamma');
      expect(code).not.toMatch(/alpha/);
      expect(code).not.toMatch(/beta/);
    });

    test('else if with indeterminate predecessor, alternate', () => {
      let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        if (window.x) {
          return 'alpha';
        } else if (macroCondition(false)) {
          return 'beta';
        } else {
          return 'gamma';
        }
      }
      `);
      expect(code).toMatch(/alpha/);
      expect(code).not.toMatch(/beta/);
      expect(code).toMatch(/gamma/);
    });

    test('else if with indeterminate predecessor, consequent', () => {
      let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        if (window.x) {
          return 'alpha';
        } else if (macroCondition(true)) {
          return 'beta';
        } else {
          return 'gamma';
        }
      }
      `);
      expect(code).toMatch(/alpha/);
      expect(code).toMatch(/beta/);
      expect(code).not.toMatch(/gamma/);
    });

    test('non-static predicate refuses to build', () => {
      expect(() => {
        transform(`
        import { macroCondition } from '@embroider/macros';
        import other from 'other';
        export default function() {
          return macroCondition(other) ? 1 : 2;
        }
        `);
      }).toThrow(/the first argument to macroCondition must be statically known/);
    });

    test('wrong arity refuses to build', () => {
      expect(() => {
        transform(`
        import { macroCondition } from '@embroider/macros';
        export default function() {
          return macroCondition() ? 1 : 2;
        }
        `);
      }).toThrow(/macroCondition accepts exactly one argument, you passed 0/);
    });

    test('usage inside expression refuses to build', () => {
      expect(() => {
        transform(`
        import { macroCondition } from '@embroider/macros';
        export default function() {
          return macroCondition(true);
        }
        `);
      }).toThrow(/macroCondition can only be used as the predicate of an if statement or ternary expression/);
    });

    test('composes with other macros using ternary', () => {
      let code = transform(`
      import { macroCondition, dependencySatisfies } from '@embroider/macros';
      export default function() {
        return macroCondition(dependencySatisfies('qunit', '*')) ? 'alpha' : 'beta';
      }
      `);
      expect(runDefault(code)).toBe('alpha');
      expect(code).not.toMatch(/beta/);
    });

    test('composes with other macros using if', () => {
      let code = transform(`
      import { macroCondition, dependencySatisfies } from '@embroider/macros';
      export default function() {
        let qunit;
        if (macroCondition(dependencySatisfies('qunit', '*'))) {
          qunit = 'found';
         } else {
           qunit = 'not found';
        }
        let notARealPackage;
        if (macroCondition(dependencySatisfies('not-a-real-package', '*'))) {
          notARealPackage = 'found';
        } else {
          notARealPackage = 'not found';
        }
        return { qunit, notARealPackage };
      }
      `);
      expect(runDefault(code)).toEqual({ qunit: 'found', notARealPackage: 'not found' });
      expect(code).not.toMatch(/beta/);
    });

    test('can evaluate boolean expressions', () => {
      let code = transform(`
      import { macroCondition, dependencySatisfies } from '@embroider/macros';
      export default function() {
        return macroCondition((2 > 1) && dependencySatisfies('qunit', '*')) ? 'alpha' : 'beta';
      }
      `);
      expect(runDefault(code)).toBe('alpha');
      expect(code).not.toMatch(/beta/);
    });

    test('can see booleans inside getConfig', () => {
      let code = transform(`
      import { macroCondition, getConfig } from '@embroider/macros';
      export default function() {
        // this deliberately chains three kinds of property access syntax: by
        // identifier, by numeric index, and by string literal.
        return macroCondition(getConfig('qunit').items[0]["other"]) ? 'alpha' : 'beta';
      }
      `);
      expect(runDefault(code)).toBe('beta');
      expect(code).not.toMatch(/alpha/);
    });
  });
});
