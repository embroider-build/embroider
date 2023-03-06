import { resolve, relative, isAbsolute } from 'path';
import { readFileSync } from 'fs';
import {
  AddonMeta,
  AddonInstance,
  isDeepAddonInstance,
  PackageInfo,
} from '@embroider/shared-internals';
import buildFunnel from 'broccoli-funnel';
import type { Node } from 'broccoli-node-api';
import { satisfies } from 'semver';

export interface ShimOptions {
  disabled?: (options: any) => boolean;
}

function addonMeta(pkgJSON: PackageInfo): AddonMeta {
  let meta = pkgJSON['ember-addon'];
  if (meta?.version !== 2 || meta?.type !== 'addon') {
    throw new Error(`did not find valid v2 addon metadata in ${pkgJSON.name}`);
  }
  return meta as AddonMeta;
}

export function addonV1Shim(directory: string, options: ShimOptions = {}) {
  let pkg: PackageInfo = JSON.parse(
    readFileSync(resolve(directory, './package.json'), 'utf8')
  );

  let meta = addonMeta(pkg);
  let disabled = false;
  const rootTrees = new WeakMap<AddonInstance, Node>();

  function rootTree(addonInstance: AddonInstance): Node {
    let tree = rootTrees.get(addonInstance);
    if (!tree) {
      tree = addonInstance.treeGenerator(directory);
      rootTrees.set(addonInstance, tree);
    }
    return tree;
  }

  return {
    name: pkg.name,
    included(
      this: AddonInstance & {
        registerV2Addon(name: string, dir: string): void;
      },
      ...args: unknown[]
    ) {
      let parentOptions;
      if (isDeepAddonInstance(this)) {
        parentOptions = this.parent.options;
      } else {
        parentOptions = this.app.options;
      }

      this.registerV2Addon(this.name, directory);

      if (options.disabled) {
        disabled = options.disabled(parentOptions);
      }

      // this is at the end so we can find our own autoImportInstance before any
      // deeper v2 addons ask us to forward registrations upward to it
      this._super.included.apply(this, args);
    },

    treeForApp(this: AddonInstance) {
      if (disabled) {
        return undefined;
      }
      let maybeAppJS = meta['app-js'];
      if (maybeAppJS) {
        const appJS = maybeAppJS;
        return buildFunnel(rootTree(this), {
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
      // this never goes through broccoli -- it's always pulled into the app via
      // ember-auto-import, as needed. This means it always benefits from
      // tree-shaking.
      return undefined;
    },

    treeForPublic(this: AddonInstance) {
      if (disabled) {
        return undefined;
      }
      let maybeAssets = meta['public-assets'];
      if (maybeAssets) {
        const assets = maybeAssets;
        return buildFunnel(rootTree(this), {
          files: Object.keys(assets),
          getDestinationPath(relativePath: string): string {
            for (let [interiorName, exteriorName] of Object.entries(assets)) {
              if (relativePath === interiorName) {
                return exteriorName;
              }
            }
            throw new Error(
              `bug in addonV1Shim, no match for ${relativePath} in ${JSON.stringify(
                assets
              )}`
            );
          },
        });
      }
    },

    cacheKeyForTree(this: AddonInstance, treeType: string): string {
      return `embroider-addon-shim/${treeType}/${directory}`;
    },

    isDevelopingAddon(this: AddonInstance) {
      // if the app is inside our own directory, we must be under development.
      // This setting controls whether ember-cli will watch for changes in the
      // broccoli trees we expose, but it doesn't have any control over our
      // files that get auto-imported into the app. For that, you should use
      // ember-auto-import's watchDependencies option (and this should become
      // part of the blueprint for test apps).
      let appInstance = this._findHost();
      return isInside(directory, appInstance.project.root);
    },

    registerV2Addon(this: AddonInstance, name: string, root: string): void {
      let parentName: string;
      if (isDeepAddonInstance(this)) {
        parentName = this.parent.name;
      } else {
        parentName = this.parent.name();
      }

      // if we're being used by a v1 package, that package needs ember-auto-import 2
      if ((this.parent.pkg['ember-addon']?.version ?? 1) < 2) {
        let autoImport = locateAutoImport(this.parent.addons);
        if (!autoImport.present) {
          throw new Error(
            `${parentName} needs to depend on ember-auto-import in order to use ${this.name}`
          );
        }

        if (!autoImport.satisfiesV2) {
          throw new Error(
            `${parentName} has ember-auto-import ${autoImport.version} which is not new enough to use ${this.name}. It needs to upgrade to >=2.0`
          );
        }
        autoImport.instance.registerV2Addon(name, root);
      } else {
        // if we're being used by a v2 addon, it also has this shim and will
        // forward our registration onward to ember-auto-import
        (this.parent as EAI2Instance).registerV2Addon(name, root);
      }
    },
  };
}

function isInside(parentDir: string, otherDir: string): boolean {
  let rel = relative(parentDir, otherDir);
  return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel);
}

type EAI2Instance = AddonInstance & {
  registerV2Addon(name: string, root: string): void;
};

function locateAutoImport(addons: AddonInstance[]):
  | { present: false }
  | {
      present: true;
      version: string;
      satisfiesV2: false;
    }
  | {
      present: true;
      version: string;
      satisfiesV2: true;
      instance: EAI2Instance;
    } {
  let instance = addons.find((a) => a.name === 'ember-auto-import');
  if (!instance) {
    return { present: false };
  }
  let version = instance.pkg.version;
  let satisfiesV2 = satisfies(version, '>=2.0.0-alpha.0', {
    includePrerelease: true,
  });
  if (satisfiesV2) {
    return {
      present: true,
      version,
      satisfiesV2,
      instance: instance as EAI2Instance,
    };
  } else {
    return {
      present: true,
      version,
      satisfiesV2,
    };
  }
}
