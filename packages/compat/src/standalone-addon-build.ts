import { Package, PackageCache, RewrittenPackageIndex } from '@embroider/core';
import V1InstanceCache from './v1-instance-cache';
import buildCompatAddon from './build-compat-addon';
import { Funnel } from 'broccoli-funnel';
import crypto from 'crypto';
import broccoliMergeTrees from 'broccoli-merge-trees';
import writeFile from 'broccoli-file-creator';
import type { Node } from 'broccoli-node-api';
import CompatApp from './compat-app';

export function convertLegacyAddons(compatApp: CompatApp) {
  let packageCache = PackageCache.shared('embroider', compatApp.root);
  let instanceCache = new V1InstanceCache(compatApp, packageCache);

  let v1Addons = findV1Addons(packageCache.get(compatApp.root));
  let index = buildAddonIndex(compatApp, v1Addons);

  let interiorTrees: Node[] = [];
  let exteriorTrees = [...v1Addons].map(pkg => {
    let interior = buildCompatAddon(pkg, instanceCache);
    interiorTrees.push(interior);
    return new Funnel(interior, { destDir: index.packages[pkg.root] });
  });

  return broccoliMergeTrees([
    ...exteriorTrees,
    new Funnel(compatApp.synthesizeStylesPackage(interiorTrees), {
      destDir: '@embroider/synthesized-styles',
    }),
    new Funnel(compatApp.synthesizeVendorPackage(interiorTrees), {
      destDir: '@embroider/synthesized-vendor',
    }),
    writeFile('index.json', JSON.stringify(index, null, 2)),
  ]);
}

function buildAddonIndex(compatApp: CompatApp, packages: Set<Package>): RewrittenPackageIndex {
  let content: RewrittenPackageIndex = {
    packages: {},
    extraResolutions: {},
  };
  for (let oldPkg of packages) {
    let newRoot = `${oldPkg.name}.${hashed(oldPkg.root)}`;
    content.packages[oldPkg.root] = newRoot;
    let nonResolvableDeps = oldPkg.nonResolvableDeps;
    if (nonResolvableDeps) {
      content.extraResolutions[newRoot] = [...nonResolvableDeps.values()].map(v => v.root);
    }
  }

  // adding an entry for the app itself to have a place in the
  // rewritten-packages, even though this stage hasn't actually put it there
  // yet.
  content.packages[compatApp.root] = compatApp.name;

  return content;
}

function findV1Addons(pkg: Package, seen: Set<Package> = new Set(), output: Set<Package> = new Set()): Set<Package> {
  for (let dep of pkg.dependencies) {
    if (seen.has(dep)) {
      continue;
    }
    seen.add(dep);
    if (dep.isEmberPackage()) {
      if (!dep.isV2Addon()) {
        output.add(dep);
      }
      findV1Addons(dep, seen, output);
    }
  }
  return output;
}

function hashed(path: string): string {
  let h = crypto.createHash('sha1');
  return h.update(path).digest('hex').slice(0, 8);
}
