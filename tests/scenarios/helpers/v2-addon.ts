import { PreparedApp } from 'scenario-tester';
import { spawn } from 'child_process';

export class DevWatcher {
  #addon: PreparedApp;
  #singletonAbort?: AbortController;
  #waitForBuildPromise?: Promise<unknown>;
  #lastBuild?: string;

  constructor(addon: PreparedApp) {
    this.#addon = addon;
  }

  start = () => {
    if (this.#singletonAbort) this.#singletonAbort.abort();

    this.#singletonAbort = new AbortController();

    /**
     * NOTE: when running rollup in a non-TTY environemnt, the "watching for changes" message does not print.
     */
    let rollupProcess = spawn('pnpm', ['start'], {
      cwd: this.#addon.dir,
      signal: this.#singletonAbort.signal,
      stdio: ['pipe', 'pipe', 'pipe'],
      // Have to disable color so our regex / string matching works easier
      // Have to include process.env, so the spawned environment has access to `pnpm`
      env: { ...process.env, NO_COLOR: '1' },
    });

    let settle: (...args: unknown[]) => void;
    let error: (...args: unknown[]) => void;
    this.#waitForBuildPromise = new Promise((resolve, reject) => {
      settle = resolve;
      error = reject;
    });

    if (!rollupProcess.stdout) {
      throw new Error(`Failed to start process, pnpm start`);
    }
    if (!rollupProcess.stderr) {
      throw new Error(`Failed to start process, pnpm start`);
    }

    let handleData = (data: Buffer) => {
      let string = data.toString();
      let lines = string.split('\n');

      let build = lines.find(line => line.trim().match(/^created dist in (.+)$/));
      let problem = lines.find(line => line.includes('Error:'));
      let isAbort = lines.find(line => line.includes('AbortError:'));

      if (isAbort) {
        // Test may have ended, we want to kill the watcher,
        // but not error, because throwing an error causes the test to fail.
        return settle();
      }

      if (problem) {
        console.error('\n!!!\n', problem, '\n!!!\n');
        error(problem);
        return;
      }

      if (build) {
        this.#lastBuild = build[1];

        settle?.();

        this.#waitForBuildPromise = new Promise((resolve, reject) => {
          settle = resolve;
          error = reject;
        });
      }
    };

    // NOTE: rollup outputs to stderr only, not stdout
    rollupProcess.stderr.on('data', (...args) => handleData(...args));
    rollupProcess.on('error', handleData);
    rollupProcess.on('close', () => settle?.());
    rollupProcess.on('exit', () => settle?.());

    return this.#waitForBuildPromise;
  };

  stop = () => this.#singletonAbort?.abort();
  settled = () => this.#waitForBuildPromise;
  get lastBuild() {
    return this.#lastBuild;
  }
}
