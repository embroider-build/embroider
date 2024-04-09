import execa, { type Options, type ExecaChildProcess } from 'execa';
import path from 'path';

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
      // console.log(lines);
      this.lines.push(...lines);
      this.currentWaiter?.();
    });

    process.on('exit', code => {
      console.log('subprocess exited', code);
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
      console.log('hit the internalWait finally');
      this.currentWaiter = undefined;
    }
  }

  private searchLines(output: string | RegExp): boolean | RegExpExecArray {
    while (this.nextWaitedLine < this.lines.length) {
      let line = this.lines[this.nextWaitedLine++];
      console.log(line);
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

  async shutdown(): Promise<void> {
    if (this.exitCode != null) {
      console.log('exitCode is not null');
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

    console.log('waiting for exit');
    await this.waitForExit();
  }

  async waitForExit(): Promise<number> {
    while (true) {
      console.log('waiting for exit in waitForExit()', this.exitCode);
      if (this.exitCode != null) {
        console.log('exitCode is not null in waitForExit()');
        return this.exitCode;
      }
      console.log('about to wait for internal wait');
      await this.internalWait();
      console.log('finished waiting for internal wait');
    }
  }
}
