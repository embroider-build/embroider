import path from 'path';
import type { PreparedApp } from 'scenario-tester';
import { loadConfigFile } from 'rollup/loadConfigFile';
import rollup from 'rollup';
import type { RollupOptions } from 'rollup';

export class DevWatcher {
  #addon: PreparedApp;
  #watcher?: ReturnType<(typeof rollup)['watch']>;
  #waitForBuildPromise?: Promise<unknown>;
  #resolve?: (value: unknown) => void;
  #reject?: (error: unknown) => void;
  #originalDirectory: string;

  constructor(addon: PreparedApp) {
    this.#addon = addon;
    this.#originalDirectory = process.cwd();
  }

  start = async () => {
    if (this.#watcher) {
      throw new Error(`.start() may only be called once`);
    }

    let buildDirectory = this.#addon.dir;

    /**
     * Rollup does not have a way to build/watch in other directories,
     * unless we prepend / modifier all the input/output/include/exclude paths
     */
    process.chdir(buildDirectory);

    let configPath = path.resolve(this.#addon.dir, 'rollup.config.mjs');
    let configFile = await loadConfigFile(configPath, undefined);
    configFile.warnings.flush();

    this.#watcher = rollup.watch(
      configFile.options.map((options: RollupOptions) => {
        options.watch = {
          buildDelay: 20,
        };
        return options;
      })
    );

    this.#defer();

    /**
     * NOTE: there is a bit of a delay between a file change and the next "START"
     */
    this.#watcher.on('event', args => {
      switch (args.code) {
        case 'START': {
          this.#defer();
          break;
        }
        case 'END': {
          this.#forceResolve?.('end');
          break;
        }
        case 'ERROR': {
          this.#forceReject?.(args.error);
          break;
        }
      }
    });

    this.#watcher.on('close', () => this.#forceResolve?.('close'));

    return this.settled();
  };

  #defer = () => {
    if (this.#waitForBuildPromise) {
      // Need to finish prior work before deferring again
      // if we hit this use case, we may have mis-configured
      // the previosu deferral
      return;
    }
    this.#waitForBuildPromise = new Promise<unknown>((_resolve, _reject) => {
      this.#resolve = _resolve;
      this.#reject = _reject;
    });
  };

  #forceResolve(state: unknown) {
    this.#resolve?.(state);
    this.#waitForBuildPromise = undefined;
  }
  #forceReject(error: unknown) {
    this.#reject?.(error);
    this.#waitForBuildPromise = undefined;
  }

  stop = async () => {
    await this.#watcher?.close();
    process.chdir(this.#originalDirectory);
  };

  nextBuild = async () => {
    this.#defer();
    await this.settled();
  };

  settled = async (timeout = 5_000) => {
    if (!this.#waitForBuildPromise) {
      console.debug(`There is nothing to wait for`);
      return;
    }

    await Promise.race([
      this.#waitForBuildPromise,
      new Promise((_, reject) => setTimeout(() => reject('[DevWatcher] rollup.watch timed out'), timeout)),
    ]);
  };
}
