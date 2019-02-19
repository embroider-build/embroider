import { Package } from '@embroider/core';
import sortBy from 'lodash/sortBy';
import { relative } from 'path';

interface Options {
  "project-dir": string;
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

async function traverse(options: Options) {
  let mod = await import('@embroider/core');
  let packageCache = new mod.PackageCache();
  let app = packageCache.getApp(options['project-dir']);
  let versionMap: Map<string, Set<Package>> = new Map();
  let consumers: Map<Package, Set<Package>> = new Map();

  recordConsumers(app, consumers);
  for (let dep of app.findDescendants(dep => dep.isEmberPackage)) {
    recordConsumers(dep, consumers);
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
