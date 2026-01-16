import { readJsonSync } from 'fs-extra';
import {
  emberVirtualPackages,
  emberVirtualPeerDeps,
  packageName,
  templateCompilationModules,
} from '@embroider/core';
import type { Plugin } from 'rolldown';

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
  return deps;
}

export default function emberExternals(): Plugin {
  let deps: Set<string>;

  return {
    name: 'ember-externals',

    buildStart() {
      this.addWatchFile('package.json');
      deps = resolvableDependencies();
    },

    async resolveId(source) {
      let pkgName = packageName(source);
      if (!pkgName) {
        // No package name found means this is a relative import, which we don't
        // need to deal with.
        return;
      }

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
