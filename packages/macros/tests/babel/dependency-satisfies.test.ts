import { allBabelVersions, Project, runDefault } from '@embroider/test-support';
import { join } from 'path';
import { MacrosConfig } from '../../src/node';

const ROOT = process.cwd();

describe(`dependencySatisfies`, function () {
  let project: Project;

  beforeEach(() => {
    project = new Project('test-app');
  });

  afterEach(() => {
    project?.dispose();
    process.chdir(ROOT);
  });

  allBabelVersions({
    includePresetsTests: true,
    babelConfig() {
      project.writeSync();
      let config = MacrosConfig.for({}, project.baseDir);
      config.finalize();
      return {
        filename: join(project.baseDir, 'sample.js'),
        plugins: config.babelPluginConfig(),
      };
    },

    createTests(transform) {
      test('is satisfied', () => {
        project.addDependency('example-package', '2.9.0');
        let code = transform(`
      import { dependencySatisfies } from '@embroider/macros';
      export default function() {
        return dependencySatisfies('example-package', '^2.8.0');
      }
      `);
        expect(runDefault(code)).toBe(true);
      });

      test('is not satisfied', () => {
        project.addDependency('example-package', '2.9.0');
        let code = transform(`
      import { dependencySatisfies } from '@embroider/macros';
      export default function() {
        return dependencySatisfies('example-package', '^10.0.0');
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

      test('it considers prereleases (otherwise within the range) as allowed', () => {
        project.addDependency('foo', '1.1.0-beta.1');
        let code = transform(
          `
          import { dependencySatisfies } from '@embroider/macros';
          export default function() {
            return dependencySatisfies('foo', '^1.0.0');
          }
        `
        );
        expect(runDefault(code)).toBe(true);
      });

      test(`it considers a project's used pre-releases as allowed`, () => {
        project.addDependency('foo', '4.2.0-beta.1');
        let code = transform(
          `
          import { dependencySatisfies } from '@embroider/macros';
          export default function() {
            return dependencySatisfies('foo', '>= 3.27.0-alpha.1 || >= 3.27.0-beta.1');
          }
        `
        );
        expect(runDefault(code)).toBe(true);
      });

      test(`in monorepos, the * dep is commonly used to mean "latest"`, () => {
        project.addDependency('foo', '4.2.0-beta.1', project => {
          project.pkg.dependencies = {
            ...project.pkg.dependencies,
            foo: '*',
          };
        });

        let code = transform(
          `
          import { dependencySatisfies } from '@embroider/macros';
          export default function() {
            return dependencySatisfies('foo', '>= 3.27.0-alpha.1 || >= 3.27.0-beta.1');
          }
        `
        );
        expect(runDefault(code)).toBe(true);
      });

      test('monorepo resolutions resolve correctly', () => {
        project.addDependency('@embroider/util', '1.2.3');
        let code = transform(`
        import { dependencySatisfies } from '@embroider/macros';

        export default function() {
          return {
            // specified in dependencies
            util: dependencySatisfies('@embroider/util', '*'),

            // not specified as any kind of dep
            webpack: dependencySatisfies('@embroider/webpack', '*'),
          }
        }
      `);

        expect(runDefault(code)).toEqual({ util: true, webpack: false });
      });
    },
  });
});
