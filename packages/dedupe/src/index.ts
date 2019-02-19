import { Package } from '@embroider/core';
import sortBy from 'lodash/sortBy';
import { relative } from 'path';
import assertNever from 'assert-never';

interface Options {
  "project-dir": string;
  "level": string;
}

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
  let mod = await import('@embroider/core');
  let packageCache = new mod.PackageCache();
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
    let copies = versionMap.get(dep.name);
    if (copies) {
      copies.add(dep);
    } else {
      versionMap.set(dep.name, new Set([dep]));
    }
  }

  let duplicates = sortBy([...versionMap.values()].filter(versions => versions.size > 1), (list) => list.values().next().value.name);
  return { duplicates, consumers };
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
