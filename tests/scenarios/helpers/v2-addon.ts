import path from 'path';
import { PreparedApp } from 'scenario-tester';
import { loadConfigFile } from 'rollup/loadConfigFile';
import rollup from 'rollup';

export class DevWatcher {
  #addon: PreparedApp;
  #watcher?: ReturnType<(typeof rollup)['watch']>;
  #waitForBuildPromise?: Promise<void>;

  constructor(addon: PreparedApp) {
    this.#addon = addon;
  }

  start = async () => {
    let originalDirectory = process.cwd();
    let buildDirectory = this.#addon.dir;
    let configPath = path.resolve(this.#addon.dir, 'rollup.config.mjs');

    process.chdir(buildDirectory);

    let configFile = await loadConfigFile(configPath);
    configFile.warnings.flush();

    this.#watcher = rollup.watch(configFile.options);

    let resolve: () => void | undefined;
    let reject: () => void | undefined;

    this.#watcher.on('event', args => {
      switch (args.code) {
        case 'START': {
          process.chdir(buildDirectory);
          resolve?.();
          this.#waitForBuildPromise = new Promise((_resolve, _reject) => {
            resolve = _resolve;
            reject = _reject;
          });
          break;
        }
        // case 'BUNDLE_START'
        // case 'BUNDLE_END'
        case 'END': {
          resolve?.();
          process.chdir(originalDirectory);
          break;
        }
        case 'ERROR': {
          reject?.();
          process.chdir(originalDirectory);
          break;
        }
      }

      console.log('event', args);
    });

    this.#watcher.on('change', args => {
      console.log('change', args);
    });
    this.#watcher.on('close', () => {
      console.debug('closing watcher');
      resolve?.();
    });

    this.#watcher.on('restart', args => {
      console.log('restart', args);
    });

    return this.#waitForBuildPromise;
  };

  stop = () => this.#watcher?.close();
  settled = () => this.#waitForBuildPromise;
}
