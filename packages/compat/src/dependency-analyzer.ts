import Plugin from 'broccoli-plugin';
import ImportParser from './import-parser';
import flatMap from 'lodash/flatMap';
import { packageName as absolutePackageName, Package } from '@embroider/core';

export default class DependencyAnalyzer extends Plugin {
  constructor(private importParsers: ImportParser[], private pkg: Package) {
    super(importParsers, {
      annotation: '@embroider/core/dependency-analyzer',
    });
  }

  // we have our own protocol for getting input from the import parsers and
  // providing our output via `externals`. But it's still important that we have
  // a place in the broccoli graph, so that everything runs in the proper order.
  build() {}

  get externals() {
    let externals: string[] = [];
    let imports = flatMap(this.importParsers, ip => ip.imports);

    let seenSpecifiers = new Set();

    let dependencies: Map<string, Package> = new Map();
    for (let dep of this.pkg.dependencies) {
      dependencies.set(dep.name, dep);
    }

    for (let imp of imports) {
      // handle each specifier only once
      if (seenSpecifiers.has(imp.specifier)) {
        continue;
      }
      seenSpecifiers.add(imp.specifier);

      let name = absolutePackageName(imp.specifier);
      if (!name) {
        // must have been relative, we only care about absolute imports here
        continue;
      }

      if (name === this.pkg.name) {
        // Our own name is allowed in the appJS (because that is going to get
        // moved into the app, where our name will be resolvable). It would be
        // a problem in our Own JS, but that gets patched up by our
        // babel-plugin.
        continue;
      }

      let dep = dependencies.get(name);
      if (dep && (dep.isEmberPackage || dependencies.has('ember-auto-import'))) {
        // this is a valid inter-package specifier, either because it's an ember
        // addon (which we are going to ensure is resolvable by upgrading it to
        // v2) or because the package was using ember-auto-import to resolve
        // arbitrary NPM dependencies.
        continue;
      }

      // this is not something we know how to resolve, so we defer it to runtime
      externals.push(imp.specifier);
    }
    return externals;
  }
}
