import { describe, test, afterEach, expect } from 'vitest';

import rollupDeclarationsPlugin from '../src/rollup-declarations';
import { Project } from 'scenario-tester';
import { rollup } from 'rollup';
import { readFile } from 'fs-extra';
import { join } from 'path';

const projectBoilerplate = {
  'tsconfig.json': JSON.stringify({
    include: ['src/**/*'],
    compilerOptions: {
      target: 'es2022',
      module: 'esnext',
      declaration: true,
      declarationDir: 'declarations',
      emitDeclarationOnly: true,
      rootDir: './src',
      allowImportingTsExtensions: true,
    },
    glint: {
      environment: ['ember-loose', 'ember-template-imports'],
    },
  }),
};

async function generateGlintV1Project(src: {}): Promise<Project> {
  const project = new Project('my-addon', {
    files: {
      ...projectBoilerplate,
      src,
    },
  });
  project.linkDevDependency('typescript', { baseDir: __dirname });
  project.linkDevDependency('@glint/core', { baseDir: __dirname });
  project.linkDevDependency('@glint/template', { baseDir: __dirname });
  project.linkDevDependency('@glint/environment-ember-loose', {
    baseDir: __dirname,
  });
  project.linkDevDependency('@glint/environment-ember-template-imports', {
    baseDir: __dirname,
  });

  await project.write();

  return project;
}

async function generateGlintV2Project(src: {}): Promise<Project> {
  const project = new Project('my-addon', {
    files: {
      ...projectBoilerplate,
      src,
    },
  });
  project.linkDevDependency('typescript', { baseDir: __dirname });
  project.linkDevDependency('@glint/ember-tsc', { baseDir: __dirname });
  project.linkDevDependency('@glint/template', { baseDir: __dirname });
  project.linkDevDependency('@glint/tsserver-plugin', { baseDir: __dirname });

  await project.write();

  return project;
}

async function runRollup(dir: string, rollupOptions = {}) {
  const currentDir = process.cwd();
  process.chdir(dir);

  try {
    const bundle = await rollup({
      input: './src/index.ts',
      plugins: [rollupDeclarationsPlugin('declarations')],
      ...rollupOptions,
    });

    await bundle.write({ format: 'esm', dir: 'dist' });
  } finally {
    process.chdir(currentDir);
  }
}

describe('declarations', function () {
  let project: Project | null;

  afterEach(() => {
    project?.dispose();
    project = null;
  });

  describe('glint not present', function () {
    test('it errors without glint present', async function () {});
  });

  describe('glint v1', function () {
    test('it generates dts output', async function () {
      project = await generateGlintV1Project({
        'index.ts': 'export default 123',
      });

      await runRollup(project.baseDir);

      expect(
        await readFile(join(project.baseDir, 'declarations/index.d.ts'), {
          encoding: 'utf8',
        })
      ).toContain('export default');
    });

    test('it has correct imports', async function () {
      project = await generateGlintV1Project({
        'index.ts': `
        import foo from './foo.gts';
        import bar from './bar.gts';
        import baz from './baz.ts';
        export { foo, bar, baz };

        export class Foo {
          bar = import('./bar.gts')
        }
      `,
        'foo.gts': 'export default 123',
        'bar.gts': 'export default 234',
        'baz.ts': 'export default 345',
      });

      await runRollup(project.baseDir);

      const output = await readFile(
        join(project.baseDir, 'declarations/index.d.ts'),
        {
          encoding: 'utf8',
        }
      );

      expect(output).toContain(`import foo from './foo';`);
      expect(output).toContain(`import bar from './bar';`);
      expect(output).toContain(`import baz from './baz.ts';`);
      expect(output).toContain(`import('./bar')`);
    });
  });

  describe('glint v2', function () {
    test('it generates dts output', async function () {
      project = await generateGlintV2Project({
        'index.ts': 'export default 123',
      });

      await runRollup(project.baseDir);

      expect(
        await readFile(join(project.baseDir, 'declarations/index.d.ts'), {
          encoding: 'utf8',
        })
      ).toContain('export default');
    });

    test('it has correct imports', async function () {
      project = await generateGlintV2Project({
        'index.ts': `
        import foo from './foo.gts';
        import bar from './bar.gts';
        import baz from './baz.ts';
        export { foo, bar, baz };

        export class Foo {
          bar = import('./bar.gts')
        }
      `,
        'foo.gts': 'export default 123',
        'bar.gts': 'export default 234',
        'baz.ts': 'export default 345',
      });

      await runRollup(project.baseDir);

      const output = await readFile(
        join(project.baseDir, 'declarations/index.d.ts'),
        {
          encoding: 'utf8',
        }
      );

      expect(output).toContain(`import foo from './foo';`);
      expect(output).toContain(`import bar from './bar';`);
      expect(output).toContain(`import baz from './baz.ts';`);
      expect(output).toContain(`import('./bar')`);
    });
  });
});
