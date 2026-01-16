import { readFileSync } from 'node:fs';
// import {
//   emberVirtualPackages,
//   emberVirtualPeerDeps,
//   packageName,
//   templateCompilationModules,
// } from '@embroider/shared-internals';

import type { Plugin } from 'rolldown';

// cjs 🙈
import pkg from '@embroider/core';
const { emberVirtualPackages, emberVirtualPeerDeps, packageName, templateCompilationModules } = pkg;

const compilationModules = new Set(templateCompilationModules.map(m => m.module));

function readJsonSync(path: string) {
  const file = readFileSync(path, { encoding: 'utf8' });

  return JSON.parse(file);
}

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

export function emberExternals(): Plugin {
  let deps: Set<string>;

  return {
    name: 'ember-externals',

    buildStart() {
      this.addWatchFile('package.json');
      deps = resolvableDependencies();
    },

    resolveId: {
      order: 'pre',
      async handler(source) {
        let pkgName = packageName(source);
        console.log('EXTERNAL', source, pkgName);
        if (!pkgName) {
          // No package name found means this is a relative import, which we don't
          // need to deal with.
          return;
        }
        // console.log({ emberVirtualPackages, emberVirtualPeerDeps, packageName, templateCompilationModules });

        if (
          deps.has(pkgName) ||
          emberVirtualPeerDeps.has(pkgName) ||
          emberVirtualPackages.has(pkgName) ||
          compilationModules.has(pkgName)
        ) {
          return { id: source, external: true };
        }
      },
    },
  };
}
