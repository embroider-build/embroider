import type { Plugin } from 'rollup';
import { readJsonSync } from 'fs-extra/esm';
// NOTE: @embroider/core is compiled to CJS, so its own `export * from shared-internals`
// doesn't work how we want (which is what would provide packageName
import eCore from '@embroider/core';
const {
  emberVirtualPackages,
  emberVirtualPeerDeps,
  packageName,
  templateCompilationModules,
} = eCore;

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
