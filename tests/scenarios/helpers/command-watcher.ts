import execa, { type Options, type ExecaChildProcess } from 'execa';
import path from 'path';
import stripAnsi from 'strip-ansi';

export const DEFAULT_TIMEOUT = process.env.CI ? 90000 : 30000;

export default class CommandWatcher {
  static launch(command: string, args: readonly string[], options: Options<string> = {}): CommandWatcher {
    return new CommandWatcher(
      execa(path.join(options.cwd as string, 'node_modules/.bin', command), [...args], {
        ...options,
        all: true,
      })
    );
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
      // TODO why can code be null here?
      this.exitCode = code ?? 0;
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

  private searchLines(output: string | RegExp): boolean | RegExpExecArray {
    while (this.nextWaitedLine < this.lines.length) {
      let line = stripAnsi(this.lines[this.nextWaitedLine++]);
      if (typeof output === 'string') {
        if (output === line) {
          return true;
        }
      } else {
        let result = output.exec(line);
        if (result) {
          return result;
        }
      }
    }
    return false;
  }

  private searchOutput(output: string | RegExp): boolean | RegExpExecArray {
    for (let rawLine of this.lines) {
      let line = stripAnsi(rawLine);

      if (typeof output === 'string') {
        if (output === line) {
          return true;
        }
      } else {
        let result = output.exec(line);
        if (result) {
          return result;
        }
      }
    }
    return false;
  }

  async waitFor(output: string | RegExp, timeout = DEFAULT_TIMEOUT): Promise<any> {
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
      let result = this.searchLines(output);
      if (result) {
        return result;
      }
      await this.internalWait(timedOut);
    }
  }

  clearLogs() {
    this.lines = [];
    this.nextWaitedLine = 0;
  }

  didEmit(line: string | RegExp) {
    let result = this.searchOutput(line);

    if (typeof result === 'boolean') return result;

    return {
      count: result.length,
    };
  }

  async shutdown(): Promise<void> {
    if (this.exitCode != null) {
      this.emitLogs();
      return;
    }

    this.process.kill('SIGINT');

    // on windows the subprocess won't close if you don't end all the sockets
    // we don't just end stdout because when you register a listener for stdout it auto registers stdin and stderr... for some reason :(
    this.process.stdio.forEach((socket: any) => {
      if (socket) {
        socket.end();
      }
    });

    await this.waitForExit();
    this.emitLogs();
  }

  private emitLogs() {
    console.log(`CommandWatcher dumping logs:`);
    console.log(this.lines.join('\n'));
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
