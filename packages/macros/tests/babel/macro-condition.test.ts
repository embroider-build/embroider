import { makeRunner, makeBabelConfig, allModes } from './helpers';
import { allBabelVersions } from '@embroider/test-support';
import { Project } from 'scenario-tester';
import { MacrosConfig } from '../../src/node';
import { join } from 'path';

describe('macroCondition', function () {
  let config: MacrosConfig;
  let project: Project;
  let filename: string;

  beforeAll(() => {
    project = new Project('test-app');
    project.addDependency('qunit', '2.0.0');
    project.write();
    filename = join(project.baseDir, 'sample.js');
  });

  afterAll(() => {
    project?.dispose();
  });

  allBabelVersions({
    babelConfig(version: number) {
      let babelConfig = makeBabelConfig(version, config);
      if (version === 7) {
        babelConfig.plugins.push('@babel/plugin-transform-class-properties');
      }
      babelConfig.filename = filename;
      return babelConfig;
    },
    includePresetsTests: true,
    createTests: allModes((transform, { applyMode, buildTimeTest, runTimeTest }) => {
      let run = makeRunner(transform);
      beforeEach(function () {
        config = MacrosConfig.for({}, project.baseDir);
        config.setConfig(join(project.baseDir, 'sample.js'), 'qunit', {
          items: [{ approved: true, other: null, size: 2.3 }],
        });
        config.setGlobalConfig(__filename, '@embroider/macros', { isTesting: true });
        applyMode(config);
        config.finalize();
      });

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
        expect(run(code, { filename })).toBe('alpha');
        expect(code).not.toMatch(/beta/);
        expect(code).not.toMatch(/macroCondition/);
        expect(code).not.toMatch(/if/);
        expect(code).not.toMatch(/@embroider\/macros/);
        expect(code).not.toMatch(/\/runtime/);
      });

      runTimeTest('given runtime implementation, it evaluates consequent block', () => {
        let code = transform(`
      import { isTesting, macroCondition } from '@embroider/macros';
      export default function() {
        if (macroCondition(isTesting())) {
          return 'alpha';
        } else {
          return 'beta';
        }
      }
      `);
        expect(run(code, { filename })).toBe('alpha');
        expect(code).toMatch(/beta/);
        expect(code).toMatch(/macroCondition/);
        expect(code).toMatch(/if/);
        expect(code).not.toMatch(/@embroider\/macros/);
        expect(code).toMatch(/\/runtime/);
      });

      test('non-block if selects consequent', () => {
        let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        if (macroCondition(true))
          return 'alpha';
      }
      `);
        expect(run(code, { filename })).toBe('alpha');
        expect(code).not.toMatch(/beta/);
        expect(code).not.toMatch(/macroCondition/);
        expect(code).not.toMatch(/if/);
        expect(code).not.toMatch(/@embroider\/macros/);
        expect(code).not.toMatch(/\/runtime/);
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
        expect(run(code, { filename })).toBe('beta');
        expect(code).not.toMatch(/alpha/);
        expect(code).not.toMatch(/macroCondition/);
        expect(code).not.toMatch(/if/);
        expect(code).not.toMatch(/@embroider\/macros/);
        expect(code).not.toMatch(/\/runtime/);
      });

      test('ternary selects consequent, drops alternate', () => {
        let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        return macroCondition(true) ? 'alpha' : 'beta';
      }
      `);
        expect(run(code, { filename })).toBe('alpha');
        expect(code).not.toMatch(/beta/);
        expect(code).not.toMatch(/macroCondition/);
        expect(code).not.toMatch(/\?/);
        expect(code).not.toMatch(/@embroider\/macros/);
        expect(code).not.toMatch(/\/runtime/);
      });

      runTimeTest('given runtime implementation, ternary evaluates to consequent', () => {
        let code = transform(`
      import { isTesting, macroCondition } from '@embroider/macros';
      export default function() {
        return macroCondition(isTesting()) ? 'alpha' : 'beta';
      }
      `);
        expect(run(code, { filename })).toBe('alpha');
        expect(code).toMatch(/beta/);
        expect(code).toMatch(/macroCondition/);
        expect(code).toMatch(/\?/);
        expect(code).not.toMatch(/@embroider\/macros/);
        expect(code).toMatch(/\/runtime/);
      });

      test('ternary selects alternate, drops consequent', () => {
        let code = transform(`
      import { macroCondition } from '@embroider/macros';
      export default function() {
        return macroCondition(false) ? 'alpha' : 'beta';
      }
      `);
        expect(run(code, { filename })).toBe('beta');
        expect(code).not.toMatch(/alpha/);
        expect(code).not.toMatch(/macroCondition/);
        expect(code).not.toMatch(/\?/);
        expect(code).not.toMatch(/@embroider\/macros/);
        expect(code).not.toMatch(/\/runtime/);
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
        expect(run(code, { filename })).toBe('alpha');
        expect(code).not.toMatch(/macroCondition/);
        expect(code).not.toMatch(/@embroider\/macros/);
        expect(code).not.toMatch(/\/runtime/);
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
        expect(run(code, { filename })).toBe(undefined);
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
        expect(run(code, { filename })).toBe('beta');
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
        expect(run(code, { filename })).toBe('gamma');
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

      test('can find static predicate through comma operator', () => {
        let code = transform(`
        import { macroCondition } from '@embroider/macros';
        import other from 'other';
        export default function() {
          return macroCondition((other,true)) ? 'alpha' : 'beta';
        }
        `);

        expect(code).toMatch(/alpha/);
        expect(code).not.toMatch(/beta/);
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
        expect(run(code, { filename })).toBe('alpha');
        expect(code).not.toMatch(/beta/);
      });

      runTimeTest('given runtime implementation, it composes with other macros using ternary', () => {
        let code = transform(`
      import { isTesting, macroCondition, dependencySatisfies } from '@embroider/macros';
      export default function() {
        return macroCondition(isTesting() && dependencySatisfies('qunit', '*')) ? 'alpha' : 'beta';
      }
      `);
        expect(run(code, { filename })).toBe('alpha');
        expect(code).toMatch(/beta/);
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
        expect(run(code, { filename })).toEqual({ qunit: 'found', notARealPackage: 'not found' });
        expect(code).not.toMatch(/beta/);
      });

      runTimeTest('given runtime implementation, it can evaluate boolean expressions', () => {
        let code = transform(`
      import { isTesting, macroCondition, dependencySatisfies } from '@embroider/macros';
      export default function() {
        return macroCondition(isTesting() && (2 > 1) && dependencySatisfies('qunit', '*')) ? 'alpha' : 'beta';
      }
      `);
        expect(run(code, { filename })).toBe('alpha');
        expect(code).toMatch(/beta/);
      });

      test('can evaluate boolean expressions', () => {
        let code = transform(`
      import { macroCondition, dependencySatisfies } from '@embroider/macros';
      export default function() {
        return macroCondition((2 > 1) && dependencySatisfies('qunit', '*')) ? 'alpha' : 'beta';
      }
      `);
        expect(run(code, { filename })).toBe('alpha');
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
        expect(run(code, { filename })).toBe('beta');
        expect(code).not.toMatch(/alpha/);
      });

      if (transform.babelMajorVersion === 7) {
        buildTimeTest('can be used as class field initializer', () => {
          let code = transform(`
            import { macroCondition, getConfig } from '@embroider/macros';
            class QUnitTest {
              version = macroCondition(getConfig('qunit').items[0]["other"]) ? 'alpha' : 'beta';
            }
            let test = new QUnitTest();
            export default function() {
              return test.version;
            }
          `);
          expect(run(code, { filename })).toBe('beta');
          expect(code).not.toMatch(/alpha/);
        });

        runTimeTest('given runtime implementation, it can be used as class field initializer', () => {
          let code = transform(`
            import { isTesting, macroCondition, getConfig } from '@embroider/macros';
            class QUnitTest {
              version = macroCondition(isTesting() && getConfig('qunit').items[0]["other"]) ? 'alpha' : 'beta';
            }
            let test = new QUnitTest();
            export default function() {
              return test.version;
            }
          `);
          expect(run(code, { filename })).toBe('beta');
          expect(code).toMatch(/alpha/);
        });
      }
    }),
  });
});
