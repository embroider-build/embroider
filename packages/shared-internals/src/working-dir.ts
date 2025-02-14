import { resolve } from 'path';
import { existsSync } from 'fs';
import { readJSONSync } from 'fs-extra';

const cache = new Map();

// Most of this only exists because of classic dummy apps being weird.
export function locateEmbroiderWorkingDir(appRoot: string): string {
  if (cache.has(appRoot)) {
    return cache.get(appRoot);
  }
  if (process.env.EMBROIDER_WORKING_DIRECTORY) {
    let path = resolve(appRoot, process.env.EMBROIDER_WORKING_DIRECTORY);
    return path;
  } else if (existsSync(resolve(appRoot, 'package.json'))) {
    // the normal case
    let path = resolve(appRoot, 'node_modules', '.embroider');
    cache.set(appRoot, path);
    return path;
  } else {
    // probably in a dummy app (sigh), but let's do a little checking to
    // distinguish that case from someone pointing embroider at a nonsense
    // location
    if (existsSync(resolve(appRoot, '..', '..', 'package.json'))) {
      let pkg = readJSONSync(resolve(appRoot, '..', '..', 'package.json'));
      if (pkg.keywords?.includes('ember-addon')) {
        let path = resolve(appRoot, '..', '..', 'node_modules', '.embroider');
        cache.set(appRoot, path);
        return path;
      }
    }
    throw new Error('unable to locate app');
  }
}
