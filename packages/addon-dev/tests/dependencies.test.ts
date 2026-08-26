import { describe, test, afterEach, expect } from 'vitest';

import dependencies from '../src/rollup-addon-dependencies';
import { Project } from 'scenario-tester';
import { rollup } from 'rollup';
import { readFile } from 'fs-extra';
import { join } from 'path';

function emberSourceWithRenamedModules(): Project {
  let emberSource = new Project('ember-source', '7.3.0');
  emberSource.pkg['ember-addon'] = {
    version: 2,
    type: 'addon',
    'renamed-modules': {
      '@ember/reactive/index.js': 'ember-source/@ember/reactive/index.js',
      '@ember/reactive/collections.js':
        'ember-source/@ember/reactive/collections.js',
    },
  };
  return emberSource;
}

async function generateProject(src: {}): Promise<Project> {
  const project = new Project('my-addon', {
    files: {
      src,
    },
  });

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
      onLog(level, log, defaultLog) {
        if (['warn'].includes(level)) {
          expect(log).toBe("we don't want warnings");
        }

        defaultLog(level, log);
      },
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
    await project.write();

    await runRollup(project.baseDir);

    expect(
      await readFile(join(project.baseDir, 'dist/index.js'), {
        encoding: 'utf8',
      })
    ).toContain('default');
  });

  test('modules from ember-source renamed-modules stay external', async function () {
    project = await generateProject({
      'index.js': `
        import { trackedObject } from '@ember/reactive/collections';

        export const state = trackedObject();
      `,
    });
    project.addDevDependency(emberSourceWithRenamedModules());
    await project.write();

    await runRollup(project.baseDir);

    const output = await readFile(join(project.baseDir, 'dist/index.js'), {
      encoding: 'utf8',
    });

    expect(output).toContain(`from '@ember/reactive/collections'`);
  });

  test('static virtual packages stay external without ember-source', async function () {
    project = await generateProject({
      'index.js': `
        import { getOwner } from '@ember/owner';

        export const owner = getOwner({});
      `,
    });
    await project.write();

    await runRollup(project.baseDir);

    const output = await readFile(join(project.baseDir, 'dist/index.js'), {
      encoding: 'utf8',
    });

    expect(output).toContain(`from '@ember/owner'`);
  });
});
