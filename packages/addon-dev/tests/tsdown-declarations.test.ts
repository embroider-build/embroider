import { describe, test, afterEach, expect } from 'vitest';

import { build } from 'tsdown';
import { Project } from 'scenario-tester';
import { readFile } from 'fs-extra';
import { join } from 'path';

import { Addon } from '../src/rollup';
import { tsdown } from '../src/tsdown';
import { fixDeclarations } from '../src/fix-declarations';

async function generateProject(src: {}): Promise<Project> {
  const project = new Project('my-addon', {
    files: {
      'package.json': JSON.stringify({
        name: 'my-addon',
        version: '0.0.0',
        type: 'module',
      }),
      src,
    },
  });

  await project.write();

  return project;
}

async function runTsdown(dir: string) {
  const currentDir = process.cwd();
  process.chdir(dir);

  try {
    const addon = new Addon({ srcDir: 'src', destDir: 'dist' });
    await build({
      // don't try to auto-load a tsdown.config from disk
      config: false,
      logLevel: 'silent',
      ...tsdown(addon, {
        publicEntrypoints: ['**/*.js'],
        declarations: true,
      }),
    });
  } finally {
    process.chdir(currentDir);
  }
}

describe('tsdown declarations', function () {
  let project: Project | null;

  afterEach(() => {
    project?.dispose();
    project = null;
  });

  test('it emits declarations for .ts and .gts modules', async function () {
    project = await generateProject({
      'index.ts': `
        export { foo } from './foo.gts';
        export { baz } from './baz.ts';
        export type { Bar } from './bar.gts';
      `,
      'foo.gts': `export const foo: number = 123;`,
      'bar.gts': `export type Bar = 'x' | 'y';`,
      'baz.ts': `export const baz: number = 345;`,
    });

    await runTsdown(project.baseDir);

    const index = await readFile(join(project.baseDir, 'dist/index.d.ts'), {
      encoding: 'utf8',
    });
    const foo = await readFile(join(project.baseDir, 'dist/foo.d.ts'), {
      encoding: 'utf8',
    });

    // exported symbols survive into the declarations
    expect(index).toContain('foo');
    expect(index).toContain('baz');
    expect(index).toContain('Bar');
    expect(foo).toContain('foo');

    // no .gts / .gjs extensions leak into any emitted declaration
    expect(index).not.toMatch(/\.g[jt]s/);
    expect(foo).not.toMatch(/\.g[jt]s/);
  });

  test('it emits component declarations from a .gts file', async function () {
    project = await generateProject({
      'index.ts': `export { default, type GreetingSignature } from './greeting.gts';`,
      'greeting.gts': `
        import Component from '@glimmer/component';

        export interface GreetingSignature {
          Element: HTMLDivElement;
          Args: { name: string };
        }

        export default class Greeting extends Component<GreetingSignature> {
          get message(): string {
            return 'Hello ' + this.args.name;
          }

          <template>
            <div ...attributes>{{this.message}}</div>
          </template>
        }
      `,
    });

    await runTsdown(project.baseDir);

    const greeting = await readFile(
      join(project.baseDir, 'dist/greeting.d.ts'),
      { encoding: 'utf8' }
    );

    expect(greeting).toContain('interface GreetingSignature');
    expect(greeting).toContain('class Greeting');
    expect(greeting).toContain('get message(): string');
    // the <template> is stripped before declarations are generated
    expect(greeting).not.toContain('<template>');
    expect(greeting).not.toMatch(/\.g[jt]s/);
  });

  test('the .d.ts extension fixup strips .gts but keeps .ts', function () {
    const input = [
      `import foo from './foo.gts';`,
      `import bar from "./bar.gts";`,
      `import baz from './baz.ts';`,
      `export class Foo { bar = import('./bar.gts'); }`,
    ].join('\n');

    const output = fixDeclarations(input);

    expect(output).toContain(`import foo from './foo';`);
    expect(output).toContain(`import bar from './bar';`);
    expect(output).toContain(`import baz from './baz.ts';`);
    expect(output).toContain(`import('./bar')`);
  });
});
