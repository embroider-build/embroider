import * as path from 'path';
import { allBabelVersions, Project, runDefault } from './helpers';

const ROOT = process.cwd();

describe(`dependencySatisfies`, function () {
  let project: Project;

  afterEach(() => {
    if (project) {
      project.dispose();
    }

    process.chdir(ROOT);
  });

  allBabelVersions(function (transform: (code: string, options?: object) => string) {
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

    test('it considers prereleases (otherwise within the range) as allowed', () => {
      project = new Project('test-app', '1.0.0');
      project.addDevDependency('foo', '1.1.0-beta.1');
      project.writeSync();

      process.chdir(project.baseDir);

      let code = transform(
        `
          import { dependencySatisfies } from '@embroider/macros';
          export default function() {
            return dependencySatisfies('foo', '^1.0.0');
          }
        `,
        { filename: path.join(project.baseDir, 'foo.js') }
      );
      expect(runDefault(code)).toBe(true);
    });

    test('monorepo resolutions resolve correctly', () => {
      project = new Project('test-app', '1.0.0');
      project.addDependency('@embroider/util', '*');
      project.writeSync();

      process.chdir(project.baseDir);

      let code = transform(`
        import { dependencySatisfies } from '@embroider/macros';

        // specified in dependencies
        export const util = dependencySatisfies('@embroider/util', '*');
        // not specified as any kind of dep
        export const webpack = dependencySatisfies('@embroider/webpack', '*');
      `);

      expect(code).toMatch(/util = true/);
      expect(code).toMatch(/webpack = false/);
    });
  });
});
