import { Package, PackageCache } from '@embroider/core';
import { relative } from 'path';
import assertNever from 'assert-never';
import partition from 'lodash/partition';
import { satisfies, compare } from 'semver';
import { removeSync, symlinkSync } from 'fs-extra';

function warn(...args: any[]) {
  console.log(...args);
}

interface Options {
  "project-dir": string;
  "level": string;
  "include-safe-dupes": boolean;
}

export const knownSafeDupes = [
  // safe to duplicate because it's mostly a preprocessor. The only runtime code
  // is the polyfill, and that gets deduplicated via class vendor squashing.
  'ember-cli-babel',

  // safe to duplicate because these are only preprocessors.
  'ember-cli-htmlbars',
  'ember-cli-htmlbars-inline-precompile',

  // safe to duplicate because it doesn't do anything when included by an addon
  'broccoli-asset-rev',

  // safe to duplicate because it only emits things into the vendor and public
  // trees that gets squashed anyway.
  'ember-cli-node-assets',
];

function recordConsumers(pkg: Package, consumers: Map<Package, Set<Package>>) {
  for (let nextLevel of pkg.dependencies) {
    let c = consumers.get(nextLevel);
    if (c) {
      c.add(pkg);
    } else {
      consumers.set(nextLevel, new Set([pkg]));
    }
  }
}

function makePackageFilter(options: Options, consumers: Map<Package, Set<Package>>) {
  // this typecast is the only thing I've found so far that Yargs's typings
  // doesn't understand automatically.
  let level = options.level as 'only-addons' | 'addons-and-deps' | 'all';
  switch (level) {
    case 'only-addons':
      return (pkg: Package) => pkg.isEmberPackage;
    case 'addons-and-deps':
      return (pkg: Package) => pkg.isEmberPackage || Boolean([...consumers.get(pkg)!].find(c => c.isEmberPackage));
    case 'all':
      return (_: Package) => true;
  }
  assertNever(level);
}

async function traverse(options: Options) {
  let packageCache = new PackageCache();
  let app = packageCache.getApp(options['project-dir']);
  let versionMap: Map<string, Set<Package>> = new Map();
  let consumers: Map<Package, Set<Package>> = new Map();

  let packageFilter = makePackageFilter(options, consumers);

  recordConsumers(app, consumers);
  let deps = app.findDescendants(dep => {
    recordConsumers(dep, consumers);
    // for now we're limiting ourselves only to ember addons. We can relax this
    // to eventually also include things that are directly consumed by ember
    // addons, or even the entire node_modules graph.
    return packageFilter(dep);
  });

  for (let dep of deps) {
    if (!options['include-safe-dupes'] && knownSafeDupes.includes(dep.name)) {
      continue;
    }
    let copies = versionMap.get(dep.name);
    if (copies) {
      copies.add(dep);
    } else {
      versionMap.set(dep.name, new Set([dep]));
    }
  }

  let duplicates = [...versionMap.values()].filter(versions => versions.size > 1);
  return { duplicates, consumers };
}

function optimize(duplicates: Set<Package>[], consumers: Map<Package, Set<Package>>, options: Options) {
  // this is where we're going to record our final decisions. Keys are
  // packages-to-be-replaced, values are packages-doing-the-replacing.
  let replacements: Map<Package, Package> = new Map();

  // first, all identical copies are trivially replaceable. So we do that first
  // to reduce the search space.
  for (let set of duplicates) {
    let packages = [...set];
    while (packages.length > 0) {
      let target = packages.shift()!;
      let [matched, remaining] = partition(packages, pkg => pkg.version === target.version);
      for (let m of matched) {
        replacements.set(m, target);
        set.delete(m);
      }
      packages = remaining;
    }
  }

  // the identical copy reduction may have completely solved some packages so
  // they have no dups remaining.
  duplicates = duplicates.filter(versions => versions.size > 1);

  let candidates = findCandidates(duplicates, consumers, options);
  for (let [replaced, choices] of candidates) {
    // we can't go wrong if we choose to use a package that can't be removed
    // anyway (because it has no replacement candidates).
    let safeChoices = [...choices].filter(choice => !candidates.has(choice));
    if (safeChoices.length === 1) {
      replacements.set(replaced, safeChoices[0]);
    } else if (safeChoices.length > 1) {
      safeChoices.sort((a,b) => compare(b.version, a.version));
      replacements.set(replaced, safeChoices[0]);
    }
  }

  return { replacements };
}

function findCandidates(duplicates: Set<Package>[], consumers: Map<Package, Set<Package>>, options: Options) {
  let candidates: Map<Package, Set<Package>> = new Map();
  for (let set of duplicates) {
    for (let pkg of set) {
      let requirements = [...consumers.get(pkg)!].map(c => {
        // we already make the correct distinction within Package between when
        // to care about devDependencies vs dependencies, so it is correct here
        // to always look in all the sections. Here we're really just trying to
        // extract the version dependency after having already discovered
        // elsewhere that the dependency is relevant.
        for (let section of ['dependencies', 'peerDependencies', 'devDependencies']) {
          let range = c.packageJSON[section] && c.packageJSON[section][pkg.name];
          if (range) {
            if (!satisfies(pkg.version, range)) {
              warn(`npm bug detected: ${c.name} located at ${relative(options['project-dir'], c.root)} started with an invalid version of ${pkg.name}. ${pkg.version} does not satisfy ${range}.`);
            }
            return c.packageJSON[section][pkg.name];
          }
        }
        throw new Error(`bug: didn't find required version of ${pkg.name} in ${c.root}`);
      });

      let choices = new Set();

      for (let otherPkg of set) {
        if (otherPkg === pkg) {
          continue;
        }
        if (requirements.every(requirement => satisfies(otherPkg.version, requirement))) {
          choices.add(otherPkg);
        }
      }
      if (choices.size > 0) {
        candidates.set(pkg, choices);
      }
    }
  }
  return candidates;
}

export async function inspect(options: Options) {
  let { duplicates, consumers } = await traverse(options);
  for (let list of duplicates) {
    for (let pkg of list) {
      console.log(`${pkg.name} ${pkg.version} ${relative(options['project-dir'], pkg.root)}`);
      for (let consumer of consumers.get(pkg)!) {
        console.log(`    ${consumer.name} ${consumer.version}`);
      }
    }
  }
}

export async function plan(options: Options) {
  let { duplicates, consumers } = await traverse(options);
  let { replacements } = optimize(duplicates, consumers, options);
  for (let [replaced, replacer] of replacements) {
    console.log(`replace ${replaced.name} ${replaced.version} at ${relative(options['project-dir'], replaced.root)}`);
    console.log(`   with ${replacer.name} ${replacer.version} at ${relative(options['project-dir'], replacer.root)}`);
  }
}

export async function run(options: Options) {
  let { duplicates, consumers } = await traverse(options);
  let { replacements } = optimize(duplicates, consumers, options);
  for (let [replaced, replacer] of replacements) {
    removeSync(replaced.root);
    // the junction argument is ignored everywhere other than windows, where it
    // is appropriate because we're always linking directories.
    symlinkSync(replacer.root, replaced.root, 'junction');
  }
}
