import path from 'path';
import type { PreparedApp } from 'scenario-tester';
import { loadConfigFile } from 'rollup/loadConfigFile';
import rollup from 'rollup';
import type { RollupOptions, Plugin } from 'rollup';

export class DevWatcher {
  #counter: number;
  #expectedBuilds: number;
  #addon: PreparedApp;
  #watcher?: ReturnType<(typeof rollup)['watch']>;
  #waitForBuildPromise?: Promise<unknown>;
  #resolve?: (value: unknown) => void;
  #reject?: (error: unknown) => void;
  #originalDirectory: string;

  constructor(addon: PreparedApp) {
    this.#addon = addon;
    this.#originalDirectory = process.cwd();
    this.#counter = 1;
    this.#expectedBuilds = 1;
  }

  start = async (expectedBuilds = 1) => {
    if (this.#watcher) {
      throw new Error(`.start() may only be called once`);
    }

    this.#expectedBuilds = expectedBuilds;

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
        // for local debugging
        (options.plugins as Plugin[]).push({
          name: 'watch change',
          watchChange(id: string) {
            console.log('changed:', id);
          },
        });
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
          console.log('start');
          break;
        }
        case 'END': {
          console.log('end');
          this.#forceResolve?.('end');
          break;
        }
        case 'BUNDLE_END': {
          args.result.close();
          break;
        }
        case 'ERROR': {
          this.#forceReject?.(args.error);
          break;
        }
      }
    });

    this.#watcher.on('close', () => this.#forceResolve?.('close'));

    return this.nextBuild();
  };

  #defer = () => {
    if (this.#waitForBuildPromise) {
      // Need to finish prior work before deferring again
      // if we hit this use case, we may have mis-configured
      // the previous deferral
      return;
    }
    this.#counter = this.#expectedBuilds;
    this.#waitForBuildPromise = new Promise<unknown>((_resolve, _reject) => {
      this.#resolve = (...args) => {
        this.#counter -= 1;
        if (this.#counter === 0) {
          _resolve(...args);
        }
      };
      this.#reject = _reject;
    });
  };

  #forceResolve(state: unknown) {
    this.#resolve?.(state);
  }
  #forceReject(error: unknown) {
    this.#reject?.(error);
  }

  stop = async () => {
    await this.#watcher?.close();
    process.chdir(this.#originalDirectory);
  };

  nextBuild = async (expectedBuilds = 1) => {
    this.#expectedBuilds = expectedBuilds;
    this.#defer();
    try {
      await this.settled();
    } finally {
      this.#waitForBuildPromise = undefined;
    }
  };

  settled = async (timeout = 8_000) => {
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
