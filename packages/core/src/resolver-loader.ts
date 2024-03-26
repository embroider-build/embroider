import { readJSONSync } from 'fs-extra';
import type { Options } from './module-resolver';
import { Resolver } from './module-resolver';
import { locateEmbroiderWorkingDir } from '@embroider/shared-internals';
import { join } from 'path';
import type { FSWatcher } from 'fs';
import { watch as fsWatch } from 'fs';

const instances = new Map();

export class ResolverLoader {
  #resolver: Resolver | undefined;
  #configFile: string;
  #watcher: FSWatcher | undefined;
  sharedConfig: any;

  constructor(readonly appRoot: string, watch = false) {
    this.#configFile = join(locateEmbroiderWorkingDir(this.appRoot), 'resolver.json');
    this.sharedConfig = {};

    if (instances.has(appRoot)) {
      return instances.get(appRoot);
    }
    instances.set(appRoot, this);

    if (watch) {
      this.#watcher = fsWatch(this.#configFile, { persistent: false }, () => {
        this.#resolver = undefined;
      });
    }
  }

  close() {
    this.#watcher?.close();
  }

  get resolver(): Resolver {
    if (!this.#resolver) {
      let config: Options = readJSONSync(join(locateEmbroiderWorkingDir(this.appRoot), 'resolver.json'));
      this.#resolver = new Resolver(config);
      this.#resolver.options.makeAbsolutePathToRwPackages = this.sharedConfig.excludeLegacyAddons;
    }
    return this.#resolver;
  }
}
