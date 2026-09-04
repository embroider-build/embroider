import { describe, test, afterEach, expect } from 'vitest';

import rollupDeclarationsPlugin from '../src/rollup-declarations';
import { Project } from 'scenario-tester';
import {
  rollup,
  watch,
  type Plugin,
  type RollupWatcher,
  type RollupWatcherEvent,
} from 'rollup';
import { readFile, writeFile, pathExists } from 'fs-extra';
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

// A stand-in for glint/tsc: records each invocation and emits a declaration
// file, so tests can count how many times the plugin actually spawned it.
const FAKE_TYPE_COMMAND = 'node fake-tsc.js';
const fakeTsc = `
const fs = require('fs');
fs.appendFileSync('type-runs.txt', 'run\\n');
fs.mkdirSync('declarations', { recursive: true });
fs.writeFileSync('declarations/index.d.ts', 'export default 123;\\n');
`;

async function generateCountingProject(): Promise<Project> {
  const project = new Project('my-addon', {
    files: {
      ...projectBoilerplate,
      'fake-tsc.js': fakeTsc,
      src: { 'index.ts': 'export default 123;' },
    },
  });

  await project.write();

  return project;
}

async function typeRunCount(project: Project): Promise<number> {
  const file = join(project.baseDir, 'type-runs.txt');
  if (!(await pathExists(file))) return 0;
  const contents = await readFile(file, { encoding: 'utf8' });
  return contents.trim().split('\n').filter(Boolean).length;
}

function nextBuild(watcher: RollupWatcher): Promise<void> {
  return new Promise((resolve, reject) => {
    function handler(event: RollupWatcherEvent) {
      if (event.code === 'END') {
        watcher.off('event', handler);
        resolve();
      } else if (event.code === 'ERROR') {
        watcher.off('event', handler);
        reject(event.error);
      }
    }
    watcher.on('event', handler);
  });
}

// Runs an initial watch build, then edits a source file to force exactly one
// rebuild, and resolves once that rebuild has finished.
async function runRollupWatchWithRebuild(dir: string, plugin: Plugin) {
  const currentDir = process.cwd();
  process.chdir(dir);

  let watcher: RollupWatcher | undefined;
  try {
    watcher = watch({
      input: './src/index.ts',
      plugins: [plugin],
      output: { format: 'esm', dir: 'dist' },
    });

    await nextBuild(watcher);

    const rebuilt = nextBuild(watcher);
    await writeFile(join(dir, 'src/index.ts'), 'export default 456;');
    await rebuilt;
  } finally {
    await watcher?.close();
    process.chdir(currentDir);
  }
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

  describe('watch mode', function () {
    test('by default it type-checks once per watch session, not per rebuild', async function () {
      project = await generateCountingProject();

      await runRollupWatchWithRebuild(
        project.baseDir,
        rollupDeclarationsPlugin('declarations', FAKE_TYPE_COMMAND)
      );

      expect(await typeRunCount(project)).toBe(1);

      // declarations are still on disk for a consuming app
      expect(
        await readFile(join(project.baseDir, 'declarations/index.d.ts'), {
          encoding: 'utf8',
        })
      ).toContain('export default');
    });

    test("watch: 'always' type-checks on every rebuild", async function () {
      project = await generateCountingProject();

      await runRollupWatchWithRebuild(
        project.baseDir,
        rollupDeclarationsPlugin('declarations', {
          command: FAKE_TYPE_COMMAND,
          watch: 'always',
        })
      );

      expect(await typeRunCount(project)).toBe(2);
    });

    test("watch: 'never' skips type-checking entirely", async function () {
      project = await generateCountingProject();

      await runRollupWatchWithRebuild(
        project.baseDir,
        rollupDeclarationsPlugin('declarations', {
          command: FAKE_TYPE_COMMAND,
          watch: 'never',
        })
      );

      expect(await typeRunCount(project)).toBe(0);
      expect(await pathExists(join(project.baseDir, 'declarations'))).toBe(
        false
      );
    });

    test('a failed run is retried on the next rebuild', async function () {
      project = await generateCountingProject();
      project.mergeFiles({ 'fake-tsc.js': fakeTsc + 'process.exit(1);\n' });
      await project.write();

      await runRollupWatchWithRebuild(
        project.baseDir,
        rollupDeclarationsPlugin('declarations', FAKE_TYPE_COMMAND)
      );

      expect(await typeRunCount(project)).toBe(2);
    });
  });

  describe('outside watch mode', function () {
    test('it always type-checks', async function () {
      project = await generateCountingProject();

      await runRollup(project.baseDir, {
        plugins: [rollupDeclarationsPlugin('declarations', FAKE_TYPE_COMMAND)],
      });

      expect(await typeRunCount(project)).toBe(1);
    });

    test('the options object form accepts a command', async function () {
      project = await generateCountingProject();

      await runRollup(project.baseDir, {
        plugins: [
          rollupDeclarationsPlugin('declarations', {
            command: FAKE_TYPE_COMMAND,
          }),
        ],
      });

      expect(await typeRunCount(project)).toBe(1);
    });
  });
});
