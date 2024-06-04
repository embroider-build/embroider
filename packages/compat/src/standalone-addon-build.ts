import type { Package, RewrittenPackageIndex } from '@embroider/core';
import { PackageCache, summarizePeerDepViolations, validatePeerDependencies } from '@embroider/core';
import V1InstanceCache from './v1-instance-cache';
import buildCompatAddon from './build-compat-addon';
import { Funnel } from 'broccoli-funnel';
import crypto from 'crypto';
import broccoliMergeTrees from 'broccoli-merge-trees';
import writeFile from 'broccoli-file-creator';
import type { Node } from 'broccoli-node-api';
import type CompatApp from './compat-app';
import { join } from 'path';

export function convertLegacyAddons(compatApp: CompatApp) {
  let packageCache = PackageCache.shared('embroider', compatApp.root);
  let instanceCache = new V1InstanceCache(compatApp, packageCache);

  let appPackage = compatApp.appPackage();

  let violations = validatePeerDependencies(appPackage).filter(({ dep }) => dep.isEmberAddon() && !dep.isV2Ember());
  if (violations.length > 0) {
    if (process.env.I_HAVE_BAD_PEER_DEPS_AND_WANT_A_BROKEN_BUILD) {
      console.warn(
        `You have set process.env.I_HAVE_BAD_PEER_DEPS_AND_WANT_A_BROKEN_BUILD, so we're ignoring your broken peer deps. Please don't bother reporting any Embroider bugs until you unset it.\n${summarizePeerDepViolations(
          violations
        )}`
      );
    } else {
      throw new Error(
        `Some V1 ember addons are resolving as incorrect peer dependencies. This makes it impossible for us to safely convert them to v2 format.

  👇 👇 👇
👉 See https://github.com/embroider-build/embroider/blob/main/docs/peer-dependency-resolution-issues.md for an explanation of the problem and suggestions for fixing it.
  👆 👆 👆

${summarizePeerDepViolations(violations)}

  👇 👇 👇
👉 See https://github.com/embroider-build/embroider/blob/main/docs/peer-dependency-resolution-issues.md for an explanation of the problem and suggestions for fixing it.
  👆 👆 👆`
      );
    }
  }

  let v1Addons = findV1Addons(appPackage);
  let index = buildAddonIndex(compatApp, appPackage, v1Addons);

  let interiorTrees: Node[] = [];
  let exteriorTrees = [...v1Addons].map(pkg => {
    let interior = buildCompatAddon(pkg, instanceCache);
    interiorTrees.push(interior);
    return new Funnel(interior, { destDir: index.packages[pkg.root] });
  });

  let fakeTargets = Object.values(index.packages).map(dir => {
    let segments = dir.split('/');
    while (segments[segments.length - 1] && segments[segments.length - 1] !== 'node_modules') {
      segments.pop();
    }
    segments.push('moved-package-target.js');
    return writeFile(join(...segments), '');
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
    ...fakeTargets,
  ]);
}

function buildAddonIndex(compatApp: CompatApp, appPackage: Package, packages: Set<Package>): RewrittenPackageIndex {
  let content: RewrittenPackageIndex = {
    packages: {},
    extraResolutions: {},
  };
  for (let oldPkg of packages) {
    let newRoot = `${oldPkg.name}.${hashed(oldPkg.root)}/node_modules/${oldPkg.name}`;
    content.packages[oldPkg.root] = newRoot;
    let nonResolvableDeps = oldPkg.nonResolvableDeps;
    if (nonResolvableDeps) {
      content.extraResolutions[newRoot] = [...nonResolvableDeps.values()].map(v => v.root);
    }
  }

  // adding an entry for the app itself to have a place in the
  // rewritten-packages, even though this stage hasn't actually put it there
  // yet. This directory lives outside our rewritten-pacakges directory because
  // it's produced by a separate build stage, and it's easier to have them
  // writing into separate directories.
  content.packages[compatApp.root] = join('..', 'rewritten-app');

  let nonResolvableDeps = appPackage.nonResolvableDeps;
  if (nonResolvableDeps) {
    let extraRoots = [...nonResolvableDeps.values()].map(v => v.root);

    // the app gets extraResolutions support just like every addon does
    content.extraResolutions[join('..', 'rewritten-app')] = extraRoots;

    // but it also gets extraResolutions registered against its *original*
    // location, because the app is unique because stage2 needs a Package
    // representing the *unmoved* app but seeing *moved* deps.
    content.extraResolutions[appPackage.root] = extraRoots;
  }

  return content;
}

function findV1Addons(pkg: Package, seen: Set<Package> = new Set(), output: Set<Package> = new Set()): Set<Package> {
  for (let dep of pkg.dependencies) {
    if (seen.has(dep)) {
      continue;
    }
    seen.add(dep);
    if (dep.isEmberAddon()) {
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
