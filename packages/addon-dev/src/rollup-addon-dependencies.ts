import type { Plugin } from 'rollup';
import { readJsonSync } from 'fs-extra';
import {
  emberVirtualPackages,
  emberVirtualPeerDeps,
  packageName,
  templateCompilationModules,
} from '@embroider/shared-internals';

const compilationModules = new Set(
  templateCompilationModules.map((m) => m.module)
);

function resolvableDependencies() {
  let deps = new Set();
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
  let deps = resolvableDependencies();

  return {
    name: 'ember-externals',

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
