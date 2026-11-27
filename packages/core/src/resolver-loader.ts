import { buildResolverOptions, type Options } from './module-resolver-options';
import { Resolver } from './module-resolver';
import { withUserConfig } from './embroider-config';
import { readResolverConfig, resolverConfigFile } from './prebuild-state';
import type { FSWatcher } from 'fs';
import { watch as fsWatch } from 'fs';

/**
 * The resolver options of an app: the prebuild state if there is one,
 * with the user options of the Embroider config file on top.
 */
export function loadResolverOptions<T extends Options = Options>(appRoot: string): T {
  let prebuilt = readResolverConfig<T>(appRoot);
  return withUserConfig(appRoot, prebuilt ?? (buildResolverOptions({}) as T), Boolean(prebuilt));
}

export class ResolverLoader {
  #resolver: Resolver | undefined;
  #configFile: string;
  #watcher: FSWatcher | undefined;

  constructor(readonly appRoot: string, watch = false) {
    this.#configFile = resolverConfigFile(this.appRoot);
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
      this.#resolver = new Resolver(loadResolverOptions(this.appRoot));
    }
    return this.#resolver;
  }
}
