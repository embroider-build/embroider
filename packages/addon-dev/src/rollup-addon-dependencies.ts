import type { Plugin } from 'rollup';
import { readJsonSync } from 'fs-extra';
import { createRequire } from 'module';
import { join } from 'path';
import {
  emberVirtualPackages,
  emberVirtualPeerDeps,
  packageName,
  templateCompilationModules,
} from '@embroider/core';

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

// ember-source declares the modules it provides in ember-addon.renamed-modules,
// so reading it stays in sync with modules added in newer ember-source releases
// that the static emberVirtualPackages list doesn't know about yet.
function emberSourceProvidedPackages(): {
  packages: Set<string>;
  packageJsonPath: string | undefined;
} {
  let packages = new Set<string>();
  let packageJsonPath: string | undefined;
  try {
    let require = createRequire(join(process.cwd(), 'package.json'));
    packageJsonPath = require.resolve('ember-source/package.json');
  } catch (err) {
    // ember-source is always external, so it's not guaranteed to be installed
    // where an addon builds. The static lists still cover that case.
    return { packages, packageJsonPath };
  }
  let renamedModules =
    readJsonSync(packageJsonPath)['ember-addon']?.['renamed-modules'] ?? {};
  for (let moduleName of Object.keys(renamedModules)) {
    let name = packageName(moduleName);
    if (name) {
      packages.add(name);
    }
  }
  return { packages, packageJsonPath };
}

export default function emberExternals(): Plugin {
  let deps: Set<string>;
  let emberProvided: Set<string>;

  return {
    name: 'ember-externals',

    buildStart() {
      this.addWatchFile('package.json');
      deps = resolvableDependencies();
      let emberSource = emberSourceProvidedPackages();
      emberProvided = emberSource.packages;
      if (emberSource.packageJsonPath) {
        this.addWatchFile(emberSource.packageJsonPath);
      }
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
        emberProvided.has(pkgName) ||
        emberVirtualPeerDeps.has(pkgName) ||
        emberVirtualPackages.has(pkgName) ||
        compilationModules.has(pkgName)
      ) {
        return { id: source, external: true };
      }
    },
  };
}
