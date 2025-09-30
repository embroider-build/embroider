import { Project, templateTests } from './helpers';
import { join } from 'path';

describe('app ember dependency satisfies (prerelease)', () => {
  let project: Project;
  let filename: string;

  beforeAll(async () => {
    project = new Project('app');
    project.addDependency('ember-source', '1.2.0-beta.1');
    await project.write();
    filename = join(project.baseDir, 'sample.js');
  });

  afterAll(() => {
    project?.dispose();
  });

  templateTests(originalTransform => {
    function transform(text: string): Promise<string> {
      return originalTransform(text, { filename, appRoot: project.baseDir });
    }

    test('it considers prereleases (otherwise within the range) as allowed', async () => {
      let result = await transform(`{{macroAppEmberSatisfies '^1.0.0'}}`);
      expect(result).toEqual('{{true}}');
    });
  });
});

describe('app ember dependency satisfies (released)', () => {
  let project: Project;
  let filename: string;

  beforeAll(async () => {
    project = new Project('app');
    project.addDependency('ember-source', '2.9.1');
    await project.write();
    filename = join(project.baseDir, 'sample.js');
  });

  afterAll(() => {
    project?.dispose();
  });

  templateTests(originalTransform => {
    function transform(text: string): Promise<string> {
      return originalTransform(text, { filename, appRoot: project.baseDir });
    }

    test('in content position', async () => {
      let result = await transform(`{{macroAppEmberSatisfies '^2.8.0'}}`);
      expect(result).toEqual('{{true}}');
    });

    test('in subexpression position', async () => {
      let result = await transform(`<Foo @a={{macroAppEmberSatisfies '^2.8.0'}} />`);
      expect(result).toMatch(/@a=\{\{true\}\}/);
    });

    test('in branch', async () => {
      let result = await transform(`{{#if (macroAppEmberSatisfies '^2.8.0')}}red{{else}}blue{{/if}}`);
      expect(result).toEqual('red');
    });

    test('emits false for out-of-range package', async () => {
      let result = await transform(`{{macroAppEmberSatisfies '^10.0.0'}}`);
      expect(result).toEqual('{{false}}');
    });

    test('emits false for missing package', async () => {
      let result = await transform(`{{macroAppEmberSatisfies '^10.0.0'}}`);
      expect(result).toEqual('{{false}}');
    });

    test('args length error', async () => {
      await expect(async () => {
        await transform(`{{macroAppEmberSatisfies 'not-a-real-dep' 'another'}}`);
      }).rejects.toThrow(/macroAppEmberSatisfies requires only one argument, you passed 2/);
    });

    test('non literal arg error', async () => {
      await expect(async () => {
        await transform(`{{macroAppEmberSatisfies someDep }}`);
      }).rejects.toThrow(/all arguments to macroAppEmberSatisfies must be string literals/);
    });
  });
});
