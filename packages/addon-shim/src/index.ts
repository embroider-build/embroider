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
    included(this: AddonInstance, ...args: unknown[]) {
      if ((this.parent.pkg['ember-addon']?.version ?? 1) < 2) {
        let autoImportVersion = this.parent.addons.find(
          (a) => a.name === 'ember-auto-import'
        )?.pkg.version;

        if (!autoImportVersion) {
          throw new Error(
            `${this.parent.name} needs to depend on ember-auto-import in order to use ${this.name}`
          );
        }

        if (
          !satisfies(autoImportVersion, '>=2.0.0-alpha.0', {
            includePrerelease: true,
          })
        ) {
          throw new Error(
            `${this.parent.name} has ember-auto-import ${autoImportVersion} which is not new enough to use ${this.name}. It needs to upgrade to >=2.0`
          );
        }
      }

      let parentOptions;
      if (isDeepAddonInstance(this)) {
        parentOptions = this.parent.options;
      } else {
        parentOptions = this.app.options;
      }

      if (options.disabled) {
        disabled = options.disabled(parentOptions);
      }

      // this is here so that our possible exceptions above take precedence over
      // the one that ember-auto-import will also throw if the app doesn't have
      // ember-auto-import
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
