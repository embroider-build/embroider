import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import globby from 'globby';
import fs from 'fs/promises';
import { pathExists } from 'fs-extra';
import path from 'path';
import execa, { type Options, type ExecaChildProcess } from 'execa';

const { module: Qmodule, test } = QUnit;

let app = appScenarios.map('watch-mode', () => {
  /**
   * We will create files as a part of the watch-mode tests,
   * because creating files should cause appropriate watch/update behavior
   */
});

abstract class Waiter {
  readonly promise: Promise<void>;
  protected _resolve!: () => void;
  protected _reject!: (error: unknown) => void;
  private _timeout = (timeout: number) => this.onTimeout(timeout);

  constructor(timeout: number | null = DEFAULT_TIMEOUT) {
    this.promise = new Promise<void>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });

    if (timeout !== null) {
      setTimeout(() => this._timeout(timeout), timeout);
    }
  }

  abstract onOutputLine(data: string): boolean;
  abstract onExit(code: number): void;
  abstract onTimeout(timeout: number): void;

  protected resolve(): void {
    const resolve = this._resolve;
    this._resolve = this._reject = this._timeout = () => {};
    resolve();
  }

  protected reject(error: unknown): void {
    const reject = this._reject;
    this._resolve = this._reject = this._timeout = () => {};
    reject(error);
  }
}

const DEFAULT_TIMEOUT = process.env.CI ? 90000 : 30000;

class OutputWaiter extends Waiter {
  constructor(private process: EmberCLI, private output: string | RegExp, timeout?: number | null) {
    super(timeout);
  }

  onOutputLine(line: string): boolean {
    if (this.matchLine(line)) {
      this.resolve();
      return true;
    } else {
      return false;
    }
  }

  onExit(code: number): void {
    try {
      throw new Error(
        'Process exited with code ' +
          code +
          ' before output "' +
          this.output +
          '" was found. ' +
          'Recent output:\n\n' +
          this.process.recentOutput
      );
    } catch (error) {
      this.reject(error);
    }
  }

  onTimeout(timeout: number): void {
    try {
      throw new Error(
        'Timed out after ' +
          timeout +
          'ms before output "' +
          this.output +
          '" was found. ' +
          'Recent output:\n\n' +
          this.process.recentOutput
      );
    } catch (error) {
      this.reject(error);
    }
  }

  private matchLine(line: string): boolean {
    if (typeof this.output === 'string') {
      return this.output === line;
    } else {
      return this.output.test(line);
    }
  }
}

type Status = { type: 'running' } | { type: 'errored'; error: unknown } | { type: 'completed' };

class EmberCLI {
  static launch(args: readonly string[], options: Options<string> = {}): EmberCLI {
    return new EmberCLI(execa('ember', args, { ...options, all: true }));
  }

  readonly completed: Promise<void>;

  private status: Status = { type: 'running' };
  private waiters: Waiter[] = [];
  private lines: string[] = [];

  constructor(private process: ExecaChildProcess) {
    process.all!.on('data', data => {
      const lines = data.toString().split(/\r?\n/);
      this.lines.push(...lines);
      for (const line of lines) {
        this.waiters = this.waiters.filter(waiter => !waiter.onOutputLine(line));
      }
    });

    process.on('exit', code => {
      for (const waiter of this.waiters) {
        waiter.onExit(code ?? 0);
      }

      this.waiters = [];
    });

    const exit = new (class ExitWaiter extends Waiter {
      constructor(private process: EmberCLI) {
        super(null);
      }

      onOutputLine(): boolean {
        return false;
      }

      onExit(code: number): void {
        if (code === 0) {
          this.resolve();
        } else {
          try {
            throw new Error(
              'Process exited with code ' + code + '. ' + 'Recent output:\n\n' + this.process.recentOutput
            );
          } catch (error) {
            this.reject(error);
          }
        }
      }

      onTimeout() {}
    })(this);

    this.waiters.push(exit);

    this.completed = exit.promise
      .then(() => {
        this.status = { type: 'completed' };
      })
      .catch(error => {
        this.status = { type: 'errored', error };
        throw error;
      });
  }

  get isRunning(): boolean {
    return this.status.type === 'running';
  }

  get isErrored(): boolean {
    return this.status.type === 'errored';
  }

  get isCompleted(): boolean {
    return this.status.type === 'completed';
  }

  get recentOutput(): string {
    return this.lines.join('\n');
  }

  async waitFor(output: string | RegExp, timeout?: number | null): Promise<void> {
    const waiter = new OutputWaiter(this, output, timeout);

    for (const line of this.lines) {
      if (waiter.onOutputLine(line)) {
        return;
      }
    }

    this.waiters.push(waiter);
    await waiter.promise;
  }

  clearOutput(): void {
    this.lines = [];
  }

  async shutdown(): Promise<void> {
    if (this.isErrored || this.isCompleted) {
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

    await this.completed;
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
      server.clearOutput();
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
      server.clearOutput();

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
        await assertRewrittenFile('components/hello-world.js').includesContent(
          'export default templateOnlyComponent();'
        );
        server.clearOutput();

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

        await appFile('tests/integration/hello-world-test.js').write(`
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
        server.clearOutput();

        await appFile('app/components/hello-world.js').write(`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await added('components/hello-world.js');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').hasContent(`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await assertRewrittenFile('tests/integration/hello-world-test.js').includesContent('<HelloWorld />');
        server.clearOutput();

        let test = await EmberCLI.launch(['test', '--filter', 'hello-world'], { cwd: app.dir });
        await test.waitFor(/^not ok .+ Integration | hello-world: it renders/, DEFAULT_TIMEOUT * 2);
        await assert.rejects(test.completed);

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added('components/hello-world.hbs');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await assertRewrittenFile('tests/integration/hello-world-test.js').includesContent('<HelloWorld />');

        test = await EmberCLI.launch(['test', '--filter', 'hello-world'], { cwd: app.dir });
        await test.waitFor(/^ok .+ Integration | hello-world: it renders/);
        await test.completed;
      });

      test('Scenario 3: deleting a co-located template', async function () {
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').doesNotExist();

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added('components/hello-world.hbs');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').includesContent('templateOnlyComponent();');
        server.clearOutput();

        await appFile('app/components/hello-world.js').write(`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await added('components/hello-world.js');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        server.clearOutput();

        await appFile('app/components/hello-world.hbs').delete();
        await deleted('components/hello-world.hbs');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').hasContent(`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
      });
    });
  });
});
