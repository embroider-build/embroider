import { describe, test, afterEach, expect } from 'vitest';

import dependencies from '../src/rollup-addon-dependencies';
import { Project } from 'scenario-tester';
import { rollup } from 'rollup';
import { readFile } from 'fs-extra';
import { join } from 'path';

async function generateProject(src: {}): Promise<Project> {
  const project = new Project('my-addon', {
    files: {
      src,
    },
  });
  project.linkDevDependency('ember-source', { baseDir: __dirname });

  await project.write();

  return project;
}

async function runRollup(dir: string, rollupOptions = {}) {
  const currentDir = process.cwd();
  process.chdir(dir);

  try {
    const bundle = await rollup({
      input: './src/index.js',
      plugins: [dependencies()],
      ...rollupOptions,
    });

    await bundle.write({ format: 'esm', dir: 'dist' });
  } finally {
    process.chdir(currentDir);
  }
}

describe('dependencies', function () {
  let project: Project | null;

  afterEach(() => {
    project?.dispose();
    project = null;
  });

  test('it works without imports', async function () {
    project = await generateProject({
      'index.js': 'export default 123',
    });

    await runRollup(project.baseDir);

    expect(
      await readFile(join(project.baseDir, 'declarations/index.d.ts'), {
        encoding: 'utf8',
      })
    ).toContain('export default');
  });

  test('it can import renamed-modules', async function () {
    project = await generateProject({
      'index.js': `
        import { trackedObject } from '@ember/reactive/collections';

        export const state = trackedObject();
      `,
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
