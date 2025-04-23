import { existsSync, readJSONSync } from 'fs-extra';
import { buildResolverOptions, type Options } from './module-resolver-options';
import { Resolver } from './module-resolver';
import { locateEmbroiderWorkingDir } from '@embroider/shared-internals';
import { join } from 'path';
import type { FSWatcher } from 'fs';
import { watch as fsWatch } from 'fs';

type SplitRouteConfigType = { type: 'string'; value: string } | { type: 'regex'; value: string };

export class ResolverLoader {
  #resolver: Resolver | undefined;
  #configFile: string;
  #watcher: FSWatcher | undefined;

  constructor(readonly appRoot: string, watch = false) {
    this.#configFile = join(locateEmbroiderWorkingDir(this.appRoot), 'resolver.json');
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
      let config: Options;
      if (existsSync(this.#configFile)) {
        let rawConfig = readJSONSync(this.#configFile);

        rawConfig.splitAtRoutes = rawConfig.splitAtRoutes?.map((splitRouteConfig: SplitRouteConfigType) => {
          if (splitRouteConfig.type === 'regex') {
            const fragments = splitRouteConfig.value.match(/^\/(.*)\/([gimsuy]*)$/);
            if (!fragments) {
              throw new Error(`Unable to parse splitAtRoutes pattern ${splitRouteConfig.value}`);
            }
            const [, parsedPattern, parsedFlags] = fragments;
            return new RegExp(parsedPattern, parsedFlags);
          }
          return splitRouteConfig.value;
        });

        config = rawConfig;
      } else {
        config = buildResolverOptions({});
      }
      this.#resolver = new Resolver(config);
    }
    return this.#resolver;
  }
}
