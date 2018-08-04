import Plugin from 'broccoli-plugin';
import ImportParser from './import-parser';
import flatMap from 'lodash/flatMap';
import makeDebug from 'debug';

const todo = makeDebug('ember-cli-vanilla:todo');

export default class DependencyAnalyzer extends Plugin {
  constructor(private importParsers: ImportParser[], private packageJSON, private isTopLevelApp: boolean) {
    super(importParsers, {
      annotation: 'ember-cli-vanilla-dependency-analyzer'
    });
  }

  // we have our own protocol for getting input from the analyzers and providing
  // our output via `externals`. But it's still important that we have a place
  // in the broccoli graph, so that everything runs in the proper order.
  build() {}

  get externals() {
    let externals = [];
    let imports = flatMap(this.importParsers, ip => ip.imports);
    let seen = new Set();
    let { dependencies, devDependencies, peerDependencies } = this.packageJSON;
    imports.forEach(imp => {
      let name = this.absolutePackageName(imp.specifier);
      if (name && !seen.has(name)) {
        seen.add(name);
        if (
          (dependencies && dependencies[name]) ||
          (peerDependencies && peerDependencies[name]) ||
          (this.isTopLevelApp && devDependencies && devDependencies[name])
        ) {
          // this is a valid static inter-package specifier
        } else {
          // this is not a valid inter-package specifier, so we defer it to
          // runtime by treating it as an external
          externals.push(name);
          if (name === this.packageJSON.name) {
            todo(`local specifiers need to be rewritten as relative in ${this.packageJSON.name}`);
          }
        }
      }
    });
    return externals;
  }

  private absolutePackageName(specifier) {
    if (specifier[0] === '.' || specifier[0] === '/') {
      // Not an absolute specifier
      return;
    }
    let parts = specifier.split('/');
    if (specifier[0] === '@') {
      return `${parts[0]}/${parts[1]}`;
    } else {
      return parts[0];
    }
  }
}
