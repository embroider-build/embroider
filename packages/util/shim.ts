import { resolve, relative, isAbsolute } from 'path';
import { readFileSync } from 'fs';
import {
  AddonMeta,
  AddonInstance,
  isDeepAddonInstance,
} from '@embroider/shared-internals';
import Funnel from 'broccoli-funnel';
import type { Node } from 'broccoli-node-api';

const MIN_SUPPORT_LEVEL = 1;

export interface ShimOptions {
  disabled?: (options: any) => boolean;
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
    included(this: AddonInstance, ...args: unknown[]) {
      this._super.included.apply(this, args);

      ensureAutoImport(this);

      let parentOptions: any;
      if (isDeepAddonInstance(this)) {
        // our parent is an addon
        parentOptions = this.parent.options;
      } else {
        // our parent is the app
        parentOptions = this.app.options;
      }
      if (options.disabled) {
        disabled = options.disabled(parentOptions);
      }
    },

    treeForApp(this: AddonInstance) {
      if (disabled) {
        return undefined;
      }
      let maybeAppJS = meta['app-js'];
      if (maybeAppJS) {
        const appJS = maybeAppJS;
        return new Funnel(rootTree(this), {
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
        return new Funnel(rootTree(this), {
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
  };
}

function isInside(parentDir: string, otherDir: string): boolean {
  let rel = relative(parentDir, otherDir);
  return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel);
}

function ensureAutoImport(instance: AddonInstance) {
  let autoImport = instance.parent.addons.find(
    (a) => a.name === 'ember-auto-import'
  );
  if (!autoImport) {
    throw new Error(
      `${
        instance.name
      } is a v2-formatted addon. To use it without Embroider, the package that depends on it (${parentName(
        instance
      )}) must have ember-auto-import.`
    );
  }
  let level = (autoImport as any).v2AddonSupportLevel ?? 0;
  if (level < MIN_SUPPORT_LEVEL) {
    throw new Error(
      `${
        instance.name
      } is using v2 addon features that require a newer ember-auto-import than the one that is present in ${parentName(
        instance
      )}`
    );
  }
}

function parentName(instance: AddonInstance): string {
  if (isDeepAddonInstance(instance)) {
    return instance.parent.name;
  } else {
    return instance.parent.name();
  }
}
