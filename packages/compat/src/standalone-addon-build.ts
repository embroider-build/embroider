import { EmberAppInstance, Package, PackageCache } from '@embroider/core';
import V1InstanceCache from './v1-instance-cache';
import Options, { optionsWithDefaults } from './options';
import buildCompatAddon from './build-compat-addon';
import { Funnel } from 'broccoli-funnel';
import crypto from 'crypto';
import broccoliMergeTrees from 'broccoli-merge-trees';
import writeFile from 'broccoli-file-creator';
import type { Node } from 'broccoli-node-api';

export function convertLegacyAddons(emberApp: EmberAppInstance, maybeOptions?: Options) {
  let options = optionsWithDefaults(maybeOptions);
  let instanceCache = V1InstanceCache.forApp(emberApp, options);
  let packageCache = PackageCache.shared('embroider-unified', instanceCache.app.root);
  let v1Addons = findV1Addons(packageCache.get(instanceCache.app.root));

  let addonIndex = Object.create(null);
  for (let pkg of v1Addons) {
    addonIndex[pkg.root] = `${pkg.name}.${hashed(pkg.root)}`;
  }

  let interiorTrees: Node[] = [];
  let exteriorTrees = [...v1Addons].map(pkg => {
    let interior = buildCompatAddon(pkg, instanceCache);
    interiorTrees.push(interior);
    return new Funnel(interior, { destDir: addonIndex[pkg.root] });
  });

  return broccoliMergeTrees([
    ...exteriorTrees,
    new Funnel(instanceCache.app.synthesizeStylesPackage(interiorTrees), {
      destDir: '@embroider/synthesized-styles',
    }),
    new Funnel(instanceCache.app.synthesizeVendorPackage(interiorTrees), {
      destDir: '@embroider/synthesized-vendor',
    }),
    writeFile('v1-addon-index.json', JSON.stringify({ v1Addons: addonIndex }, null, 2)),
  ]);
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
