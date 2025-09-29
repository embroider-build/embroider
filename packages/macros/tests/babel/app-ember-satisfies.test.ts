import { allBabelVersions, runDefault } from '@embroider/test-support';
import { Project } from 'scenario-tester';
import { join, dirname } from 'node:path';
import { buildMacros } from '../../src/babel';


const ROOT = process.cwd();

export function baseV2Addon() {
  return Project.fromDir(dirname(require.resolve('../../../../tests/v2-addon-template/package.json')), { linkDeps: true });
}

export function fakeEmber(version: string) {
  const project = baseV2Addon();

  project.name = 'ember-source';
  project.version = version;

  return project;
}


describe(`appEmberSatisfies`, function () {
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
      project.write();

      let config = buildMacros({
        dir: project.baseDir,
      });

      return {
        filename: join(project.baseDir, 'sample.js'),
        plugins: config.babelMacros,
      };
    },

    createTests(transform) {
      test('is satisfied (app specifies exact version)', () => {
        project.addDependency('ember-source', '4.11.0');
        let code = transform(`
      import { appEmberSatisfies } from '@embroider/macros';
      export default function() {
        return appEmberSatisfies('^4.11.0');
      }
      `);
        expect(runDefault(code)).toBe(true);
      });

      test('is satisfied (app specifies caret version)', () => {
        project.addDependency(fakeEmber('4.12.0'));
        project.pkg.dependencies ||= {};
        project.pkg.dependencies['ember-source'] = '^4.11.0';

        let code = transform(`
      import { appEmberSatisfies } from '@embroider/macros';
      export default function() {
        return appEmberSatisfies('^4.11.0');
      }
      `);
        expect(runDefault(code)).toBe(true);
      });

      test('is not satisfied', () => {
        project.addDependency('ember-source', '2.9.0');
        let code = transform(`
      import { appEmberSatisfies } from '@embroider/macros';
      export default function() {
        return appEmberSatisfies('^10.0.0');
      }
      `);
        expect(runDefault(code)).toBe(false);
      });

      test('is not present', () => {
        let code = transform(`
      import { appEmberSatisfies } from '@embroider/macros';
      export default function() {
        return appEmberSatisfies('^10.0.0');
      }
      `);
        expect(runDefault(code)).toBe(false);
      });

      test('import gets removed', () => {
        let code = transform(`
      import { appEmberSatisfies } from '@embroider/macros';
      export default function() {
        return appEmberSatisfies('1');
      }
      `);
        expect(code).not.toMatch(/appEmberSatisfies/);
      });

      test('entire import statement gets removed', () => {
        let code = transform(`
      import { appEmberSatisfies } from '@embroider/macros';
      export default function() {
        return appEmberSatisfies('*');
      }
      `);
        expect(code).not.toMatch(/appEmberSatisfies/);
        expect(code).not.toMatch(/@embroider\/macros/);
      });

      test('unused import gets removed', () => {
        let code = transform(`
      import { appEmberSatisfies } from '@embroider/macros';
      export default function() {
        return 1;
      }
      `);
        expect(code).not.toMatch(/appEmberSatisfies/);
        expect(code).not.toMatch(/@embroider\/macros/);
      });

      test('non call error', () => {
        expect(() => {
          transform(`
          import { appEmberSatisfies } from '@embroider/macros';
          let x = appEmberSatisfies;
        `);
        }).toThrow(/You can only use appEmberSatisfies as a function call/);
      });

      test('args length error', () => {
        expect(() => {
          transform(`
          import { appEmberSatisfies } from '@embroider/macros';
          appEmberSatisfies('foo', 'bar', 'baz');
        `);
        }).toThrow(/appEmberSatisfies takes exactly one argument, you passed 3/);
      });

      test('non literal arg error', () => {
        expect(() => {
          transform(`
          import { appEmberSatisfies } from '@embroider/macros';
          let range = '*';
          appEmberSatisfies(range);
        `);
        }).toThrow(/the only argument to appEmberSatisfies must be a string literal/);
      });

      test('it considers prereleases (otherwise within the range) as allowed', () => {
        project.addDependency('ember-source', '1.1.0-beta.1');
        let code = transform(
          `
          import { appEmberSatisfies } from '@embroider/macros';
          export default function() {
            return appEmberSatisfies('^1.0.0');
          }
        `
        );
        expect(runDefault(code)).toBe(true);
      });
    },
  });
});
