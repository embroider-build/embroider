import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import globby from 'globby';
import fs from 'fs/promises';
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

type Status = { type: 'starting' } | { type: 'ready' } | { type: 'errored'; error: unknown } | { type: 'completed' };

class EmberCLI {
  static launch(args: readonly string[], options: Options<string>): EmberCLI {
    return new EmberCLI(execa('ember', args, { ...options, all: true }));
  }

  readonly ready: Promise<void>;
  readonly completed: Promise<void>;

  private status: Status = { type: 'starting' };
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

    const ready = new OutputWaiter(this, /Serving on http:\/\/localhost:[0-9]+\//, DEFAULT_TIMEOUT * 2);

    this.waiters.push(ready);

    this.ready = ready.promise.then(() => {
      this.status = { type: 'ready' };
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

  get isStarting(): boolean {
    return this.status.type === 'starting';
  }

  get isReady(): boolean {
    return this.status.type === 'ready';
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

app.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    let cli: EmberCLI;

    async function waitFor(...args: Parameters<EmberCLI['waitFor']>): Promise<void> {
      await cli.waitFor(...args);
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
      cli = EmberCLI.launch(['serve', '--port', '0'], { cwd: app.dir });
      await cli.ready;
      cli.clearOutput();
    });

    hooks.afterEach(async () => {
      await cli.shutdown();
    });

    test(`ember serve`, async function (assert) {
      const originalContent =
        'TWO IS A GREAT NUMBER< I LKE IT A LOT< IT IS THE POWER OF ALL  OF ELECTRONICS, MATH, ETC';
      assert.false(await checkScripts(/js$/, originalContent), 'file has not been created yet');

      await fs.writeFile(path.join(app.dir, 'app/simple-file.js'), `export const two = "${originalContent}";`);
      await waitFor('file added simple-file.js');
      await waitFor(/Build successful/);

      assert.true(await checkScripts(/js$/, originalContent), 'the file now exists');
      cli.clearOutput();

      const updatedContent = 'THREE IS A GREAT NUMBER TWO';
      assert.false(await checkScripts(/js$/, updatedContent), 'file has not been created yet');

      await fs.writeFile(path.join(app.dir, 'app/simple-file.js'), `export const two = "${updatedContent}";`);
      await waitFor('file changed simple-file.js');
      await waitFor(/Build successful/);

      // TODO: find a better way to test this; this seems to linger around
      // assert.false(await checkScripts(/js$/, originalContent), 'the original file does not exists');
      assert.true(await checkScripts(/js$/, updatedContent), 'the updated file now exists');
    });
  });
});
