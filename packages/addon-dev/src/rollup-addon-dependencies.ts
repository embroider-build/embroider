import type { Plugin } from 'rollup';
import { packageUpSync } from 'package-up';
import { readJsonSync } from 'fs-extra';
import {
  emberVirtualPackages,
  emberVirtualPeerDeps,
  packageName,
  templateCompilationModules,
} from '@embroider/core';
import { resolve } from 'node:path';

const compilationModules = new Set(
  templateCompilationModules.map((m) => m.module)
);

function resolvableDependencies(): Set<string> {
  let deps = new Set<string>();

  let pkg = readJsonSync('package.json');
  if (pkg.dependencies) {
    for (let name of Object.keys(pkg.dependencies)) {
      deps.add(name);
    }
  }
  if (pkg.peerDependencies) {
    for (let name of Object.keys(pkg.peerDependencies)) {
      deps.add(name);
    }
  }

  // well.. resolvable with embroider plugins
  // this feels bad, to hard-code ember-source.
  // but ember-source is always an implicit peer.
  // how would rollup eever know of its existence?
  for (let dep of [...deps.values(), 'ember-source']) {
    let depEntry = resolve(dep);
    if (!depEntry) continue;

    let depManifestPath = packageUpSync({ cwd: depEntry });
    if (!depManifestPath) continue;

    debugger;
    let depPkg = readJsonSync(depManifestPath);
    let renamedModules = depPkg['ember-addon']?.['renamed-modules'] || {};
    for (let name of Object.keys(renamedModules)) {
      let [first, second] = name.split('/');

      if (first.startsWith('@')) {
        deps.add(`${first}/${second}`);
        continue;
      }

      deps.add(first);
    }
  }
  return deps;
}

export default function emberExternals(): Plugin {
  let deps: Set<string>;

  return {
    name: 'ember-externals',

    buildStart() {
      this.addWatchFile('package.json');
      debugger;
      deps = resolvableDependencies();
    },

    async resolveId(source) {
      let pkgName = packageName(source);
      if (!pkgName) {
        // No package name found means this is a relative import, which we don't
        // need to deal with.
        return;
      }
      debugger;
      console.log(pkgName, deps.has(pkgName));

      if (
        deps.has(pkgName) ||
        emberVirtualPeerDeps.has(pkgName) ||
        emberVirtualPackages.has(pkgName) ||
        compilationModules.has(pkgName)
      ) {
        return { id: source, external: true };
      }
    },
  };
}
