import Plugin from 'broccoli-plugin';
import ImportParser from './import-parser';
import flatMap from 'lodash/flatMap';
import absolutePackageName from './package-name';

export default class DependencyAnalyzer extends Plugin {
  constructor(private importParsers: ImportParser[], private packageJSON, private isTopLevelApp: boolean) {
    super(importParsers, {
      annotation: 'ember-cli-vanilla-dependency-analyzer'
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

    let { dependencies, devDependencies, peerDependencies } = this.packageJSON;
    imports.forEach(imp => {

      // handle each specifier only once
      if (!seenSpecifiers.has(imp.specifier)) {
        seenSpecifiers.add(imp.specifier);

        let name = absolutePackageName(imp.specifier);
        if (name) {
          if (
            (dependencies && dependencies[name]) ||
            (peerDependencies && peerDependencies[name]) ||
            (this.isTopLevelApp && devDependencies && devDependencies[name]) ||
            (name === this.packageJSON.name)
          ) {
            // this is either a valid inter-package specifier or our own
            // name.
            //
            // Our own name is allowed in the appJS (because that is going to get
            // moved into the app, where our name will be resolvable). It would be
            // a problem in our Own JS, but that gets patched up by our
            // babel-plugin.
          } else {
            // this is not a valid inter-package specifier, so we defer it to
            // runtime by treating it as an external
            externals.push(imp.specifier);
          }
        }
      }
    });
    return externals;
  }
}
