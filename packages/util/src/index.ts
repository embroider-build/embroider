import { resolve } from 'path';
import { readFileSync } from 'fs';

export interface ShimOptions {
  testApp?: string;
}

export function addonV2toV1Shim(directory: string, options: ShimOptions = {}) {
  let pkg = JSON.parse(readFileSync(resolve(directory, './package.json'), 'utf8'));
  return {
    name: pkg.name,
    treeForApp(this: AddonInstance) {
      let appJS = pkg['ember-addon']?.['app-js'];
      if (appJS) {
        return this.treeGenerator(resolve(directory, appJS));
      }
    },
    treeForAddon() {
      return undefined;
    },
    isDevelopingAddon(this: AddonInstance) {
      if (options.testApp) {
        let appInstance = this._findHost();
        return appInstance.project.root === resolve(directory, options.testApp);
      }
    },
  };
}

// minimal types to cover the parts of the Addon instance that we touch
interface AddonInstance {
  _findHost(): { project: { root: string } };
  treeGenerator(dir: string): unknown;
}
