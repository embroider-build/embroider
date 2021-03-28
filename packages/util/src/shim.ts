import { resolve } from 'path';
import { readFileSync } from 'fs';
import type { AddonMeta } from '@embroider/shared-internals';
import Funnel from 'broccoli-funnel';

export interface ShimOptions {
  testApp?: string;
}

function addonMeta(pkgJSON: any): AddonMeta {
  let meta = pkgJSON['ember-addon'];
  if (meta?.version !== 2 || meta?.type !== 'addon') {
    throw new Error(`did not find valid v2 addon metadata in ${pkgJSON.name}`);
  }
  return meta as AddonMeta;
}

export function addonV1Shim(directory: string, options: ShimOptions = {}) {
  let pkg = JSON.parse(
    readFileSync(resolve(directory, './package.json'), 'utf8')
  );
  let meta = addonMeta(pkg);
  return {
    name: pkg.name,
    treeForApp(this: AddonInstance) {
      let maybeAppJS = meta['app-js'];
      if (maybeAppJS) {
        const appJS = maybeAppJS;
        return new Funnel(this.treeGenerator(directory), {
          files: Object.values(appJS),
          getDestinationPath(relativePath: string): string {
            for (let [exteriorName, interiorName] of Object.entries(appJS)) {
              if (relativePath === interiorName) {
                return exteriorName;
              }
            }
            throw new Error(
              `bug in addonV1Shim, no match for ${relativePath} in ${JSON.stringify(
                appJS
              )}`
            );
          },
        });
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
