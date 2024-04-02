import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import globby from 'globby';
import fs from 'fs/promises';
import { pathExists } from 'fs-extra';
import path from 'path';
import execa, { type Options, type ExecaChildProcess } from 'execa';

const { module: Qmodule, test } = QUnit;

let app = appScenarios.skip('canary').map('watch-mode', () => {
  /**
   * We will create files as a part of the watch-mode tests,
   * because creating files should cause appropriate watch/update behavior
   */
});

const DEFAULT_TIMEOUT = process.env.CI ? 90000 : 30000;

class EmberCLI {
  static launch(args: readonly string[], options: Options<string> = {}): EmberCLI {
    return new EmberCLI(execa('ember', args, { ...options, all: true }));
  }

  private lines: string[] = [];
  private nextWaitedLine = 0;
  private exitCode: number | null = null;
  private currentWaiter: (() => void) | undefined;

  constructor(private process: ExecaChildProcess) {
    process.all!.on('data', data => {
      const lines = data.toString().split(/\r?\n/);
      this.lines.push(...lines);
      this.currentWaiter?.();
    });

    process.on('exit', code => {
      this.exitCode = code;
      this.currentWaiter?.();
    });
  }

  private async internalWait(timedOut?: Promise<void>): Promise<void> {
    if (this.currentWaiter) {
      throw new Error(`bug: only one wait at a time`);
    }
    try {
      await Promise.race(
        [
          timedOut,
          new Promise<void>(resolve => {
            this.currentWaiter = resolve;
          }),
        ].filter(Boolean)
      );
    } finally {
      this.currentWaiter = undefined;
    }
  }

  private searchLines(output: string | RegExp): boolean {
    while (this.nextWaitedLine < this.lines.length) {
      let line = this.lines[this.nextWaitedLine++];
      if (typeof output === 'string') {
        if (output === line) {
          return true;
        }
      } else {
        if (output.test(line)) {
          return true;
        }
      }
    }
    return false;
  }

  async waitFor(output: string | RegExp, timeout = DEFAULT_TIMEOUT): Promise<void> {
    let timedOut = new Promise<void>((_resolve, reject) => {
      setTimeout(() => {
        let err = new Error(
          'Timed out after ' +
            timeout +
            'ms before output "' +
            output +
            '" was found. ' +
            'Output:\n\n' +
            this.lines.join('\n')
        );
        reject(err);
      }, timeout);
    });
    while (true) {
      if (this.exitCode != null) {
        throw new Error(
          'Process exited with code ' +
            this.exitCode +
            ' before output "' +
            output +
            '" was found. ' +
            'Output:\n\n' +
            this.lines.join('\n')
        );
      }
      if (this.searchLines(output)) {
        return;
      }
      await this.internalWait(timedOut);
    }
  }

  async shutdown(): Promise<void> {
    if (this.exitCode != null) {
      return;
    }

    this.process.kill();

    // on windows the subprocess won't close if you don't end all the sockets
    // we don't just end stdout because when you register a listener for stdout it auto registers stdin and stderr... for some reason :(
    this.process.stdio.forEach((socket: any) => {
      if (socket) {
        socket.end();
      }
    });

    await this.waitForExit();
  }

  async waitForExit(): Promise<number> {
    while (true) {
      if (this.exitCode != null) {
        return this.exitCode;
      }
      await this.internalWait();
    }
  }
}

class File {
  constructor(readonly label: string, readonly fullPath: string) {}

  async exists(): Promise<boolean> {
    return pathExists(this.fullPath);
  }

  async read(): Promise<string | null> {
    try {
      return await fs.readFile(this.fullPath, { encoding: 'utf-8' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      } else {
        throw error;
      }
    }
  }

  async write(content: string): Promise<void> {
    await fs.writeFile(this.fullPath, content, { encoding: 'utf-8' });
  }

  async delete(): Promise<void> {
    await fs.unlink(this.fullPath);
  }
}

class AssertFile {
  readonly file: File;

  constructor(private assert: Assert, file: File) {
    this.file = file;
  }

  async exists(): Promise<void> {
    this.assert.true(await this.file.exists(), `${this.file.label} exists`);
  }

  async doesNotExist(): Promise<void> {
    this.assert.false(await this.file.exists(), `${this.file.label} does not exists`);
  }

  async hasContent(expected: string): Promise<void> {
    let actual = await this.file.read();

    if (actual === null) {
      this.assert.ok(false, `${this.file.label} does not exists`);
    } else {
      this.assert.equal(actual, expected, `content of ${this.file.label}`);
    }
  }

  async doesNotHaveContent(expected: string | RegExp): Promise<void> {
    let actual = await this.file.read();

    if (actual === null) {
      this.assert.ok(false, `${this.file.label} does not exists`);
    } else {
      this.assert.notEqual(actual, expected, `content of ${this.file.label}`);
    }
  }

  async includesContent(expected: string): Promise<void> {
    let actual = await this.file.read();

    if (actual === null) {
      this.assert.ok(false, `${this.file.label} does not exists`);
    } else {
      this.assert.true(actual.includes(expected), `content of ${this.file.label}`);
    }
  }

  async doesNotIncludeContent(expected: string): Promise<void> {
    let actual = await this.file.read();

    if (actual === null) {
      this.assert.ok(false, `${this.file.label} does not exists`);
    } else {
      this.assert.false(actual.includes(expected), `content of ${this.file.label}`);
    }
  }
}

function d(strings: TemplateStringsArray, ...values: unknown[]): string {
  let buf = '';
  for (let string of strings) {
    if (values.length) {
      buf += string + values.shift();
    } else {
      buf += string;
    }
  }
  return deindent(buf);
}

function deindent(s: string): string {
  if (s.startsWith('\n')) {
    s = s.slice(1);
  }

  let indentSize = s.search(/\S/);

  if (indentSize > 0) {
    let indent = s.slice(0, indentSize);

    s = s
      .split('\n')
      .map(line => {
        if (line.startsWith(indent)) {
          return line.slice(indentSize);
        } else {
          return line;
        }
      })
      .join('\n');
  }

  s = s.trimEnd();

  return s;
}

app.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    let server: EmberCLI;

    function appFile(appPath: string): File {
      let fullPath = path.join(app.dir, ...appPath.split('/'));
      return new File(appPath, fullPath);
    }

    async function waitFor(...args: Parameters<EmberCLI['waitFor']>): Promise<void> {
      await server.waitFor(...args);
    }

    async function added(filePath: string): Promise<void> {
      await waitFor(`file added ${path.join(...filePath.split('/'))}`);
    }

    async function changed(filePath: string): Promise<void> {
      await waitFor(`file changed ${path.join(...filePath.split('/'))}`);
    }

    async function deleted(filePath: string): Promise<void> {
      await waitFor(`file deleted ${path.join(...filePath.split('/'))}`);
    }

    async function checkScripts(distPattern: RegExp, needle: string) {
      let root = app.dir;
      let available = await globby('**/*', { cwd: path.join(root, 'dist') });

      let matchingFiles = available.filter((item: string) => distPattern.test(item));
      let matchingFileContents = await Promise.all(
        matchingFiles.map(async (item: string) => {
          return fs.readFile(path.join(app.dir, 'dist', item), 'utf8');
        })
      );
      return matchingFileContents.some((item: string) => item.includes(needle));
    }

    hooks.beforeEach(async () => {
      app = await scenario.prepare();
      server = EmberCLI.launch(['serve', '--port', '0'], { cwd: app.dir });
      await waitFor(/Serving on http:\/\/localhost:[0-9]+\//, DEFAULT_TIMEOUT * 2);
    });

    hooks.afterEach(async () => {
      await server.shutdown();
    });

    test(`ember serve`, async function (assert) {
      const originalContent =
        'TWO IS A GREAT NUMBER< I LKE IT A LOT< IT IS THE POWER OF ALL  OF ELECTRONICS, MATH, ETC';
      assert.false(await checkScripts(/js$/, originalContent), 'file has not been created yet');

      await appFile('app/simple-file.js').write(`export const two = "${originalContent}";`);
      await added('simple-file.js');
      await waitFor(/Build successful/);

      assert.true(await checkScripts(/js$/, originalContent), 'the file now exists');

      const updatedContent = 'THREE IS A GREAT NUMBER TWO';
      assert.false(await checkScripts(/js$/, updatedContent), 'file has not been created yet');

      await appFile('app/simple-file.js').write(`export const two = "${updatedContent}";`);
      await changed('simple-file.js');
      await waitFor(/Build successful/);

      // TODO: find a better way to test this; this seems to linger around
      // assert.false(await checkScripts(/js$/, originalContent), 'the original file does not exists');
      assert.true(await checkScripts(/js$/, updatedContent), 'the updated file now exists');
    });

    Qmodule('[GH#1619] co-located components regressions', function (hooks) {
      // These tests uses the internal `.rewritten-app` structure to confirm the failures.
      // If that changes these tests should be updated to match the spirit of the original
      // issue (https://github.com/embroider-build/embroider/issues/1619)
      let assertRewrittenFile: (rewrittenPath: string) => AssertFile;

      hooks.beforeEach(assert => {
        assertRewrittenFile = (rewrittenPath: string) => {
          let fullPath = path.join(app.dir, 'node_modules', '.embroider', 'rewritten-app', ...rewrittenPath.split('/'));
          let file = new File(rewrittenPath, fullPath);
          return new AssertFile(assert, file);
        };
      });

      test('Scenario 1: deleting a template-only component', async function () {
        await assertRewrittenFile('assets/app-template.js').doesNotIncludeContent(
          '"app-template/components/hello-world"'
        );
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').doesNotExist();

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added('components/hello-world.hbs');
        await waitFor(/Build successful/);
        await assertRewrittenFile('assets/app-template.js').includesContent('"app-template/components/hello-world"');
        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          /* import __COLOCATED_TEMPLATE__ from './hello-world.hbs'; */
          import templateOnlyComponent from '@ember/component/template-only';
          export default templateOnlyComponent();
        `);

        await appFile('app/components/hello-world.hbs').delete();
        await deleted('components/hello-world.hbs');
        await waitFor(/Build successful/);
        await assertRewrittenFile('assets/app-template.js').doesNotIncludeContent(
          '"app-template/components/hello-world"'
        );
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').doesNotExist();
      });

      test('Scenario 2: adding a template to a component', async function (assert) {
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').doesNotExist();
        await assertRewrittenFile('tests/integration/hello-world-test.js').doesNotExist();

        await appFile('tests/integration/hello-world-test.js').write(d`
          import { module, test } from 'qunit';
          import { setupRenderingTest } from 'ember-qunit';
          import { render } from '@ember/test-helpers';
          import { hbs } from 'ember-cli-htmlbars';

          module('Integration | hello-world', function(hooks) {
            setupRenderingTest(hooks);

            test('it renders', async function(assert) {
              await render(hbs\`<HelloWorld />\`);
              assert.dom(this.element).hasText('hello world!');
            });
          });
        `);
        await added('integration/hello-world-test.js');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').doesNotExist();
        await assertRewrittenFile('tests/integration/hello-world-test.js').includesContent('<HelloWorld />');

        await appFile('app/components/hello-world.js').write(d`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await added('components/hello-world.js');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await assertRewrittenFile('tests/integration/hello-world-test.js').includesContent('<HelloWorld />');

        let test = await EmberCLI.launch(['test', '--filter', 'hello-world'], { cwd: app.dir });
        await test.waitFor(/^not ok .+ Integration | hello-world: it renders/, DEFAULT_TIMEOUT * 2);
        await assert.notStrictEqual(await test.waitForExit(), 0);

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added('components/hello-world.hbs');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          /* import __COLOCATED_TEMPLATE__ from './hello-world.hbs'; */
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await assertRewrittenFile('tests/integration/hello-world-test.js').includesContent('<HelloWorld />');

        test = await EmberCLI.launch(['test', '--filter', 'hello-world'], { cwd: app.dir });
        await test.waitFor(/^ok .+ Integration | hello-world: it renders/);
        await assert.strictEqual(await test.waitForExit(), 0);
      });

      test('Scenario 3: deleting a co-located template', async function () {
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').doesNotExist();

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added('components/hello-world.hbs');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          /* import __COLOCATED_TEMPLATE__ from './hello-world.hbs'; */
          import templateOnlyComponent from '@ember/component/template-only';
          export default templateOnlyComponent();
        `);

        await appFile('app/components/hello-world.js').write(d`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await added('components/hello-world.js');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          /* import __COLOCATED_TEMPLATE__ from './hello-world.hbs'; */
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);

        await appFile('app/components/hello-world.hbs').delete();
        await deleted('components/hello-world.hbs');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
      });

      test('Scenario 4: editing a co-located js file', async function () {
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').doesNotExist();

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added('components/hello-world.hbs');
        await waitFor(/Build successful/);

        await appFile('app/components/hello-world.js').write(d`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await added('components/hello-world.js');
        await waitFor(/Build successful/);

        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          /* import __COLOCATED_TEMPLATE__ from './hello-world.hbs'; */
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);

        await appFile('app/components/hello-world.js').write(d`
          import Component from '@glimmer/component';
          export default class extends Component {
            // this shows that updates invalidate any caches and reflects properly
          }
        `);
        await changed('components/hello-world.js');
        await waitFor(/Build successful/);

        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          /* import __COLOCATED_TEMPLATE__ from './hello-world.hbs'; */
          import Component from '@glimmer/component';
          export default class extends Component {
            // this shows that updates invalidate any caches and reflects properly
          }
        `);
      });
    });
  });
});
